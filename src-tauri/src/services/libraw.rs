//! LibRaw FFI 绑定模块
//!
//! 提供 LibRaw 库的 Rust 封装，用于从 RAW 文件中提取嵌入预览图。
//! 采用动态链接方式，运行时加载 libraw.dll。

use std::ffi::{c_char, c_int, c_uint, c_void, CString};
use std::path::Path;
use std::sync::OnceLock;

use image::{DynamicImage, RgbImage};

// LibRaw 错误码
const LIBRAW_SUCCESS: c_int = 0;
const LIBRAW_NO_THUMBNAIL: c_int = -2;

// LibRaw 缩略图格式
const LIBRAW_THUMBNAIL_JPEG: c_int = 1;
const LIBRAW_THUMBNAIL_BITMAP: c_int = 2;

/// LibRaw 处理后的图像结构
#[repr(C)]
struct LibrawProcessedImage {
    image_type: c_int,      // 图像类型
    height: c_uint,         // 高度
    width: c_uint,          // 宽度
    colors: c_uint,         // 颜色通道数
    bits: c_uint,           // 每通道位数
    data_size: c_uint,      // 数据大小
    data: [u8; 1],          // 柔性数组（实际数据）
}

/// LibRaw 函数指针类型
type LibrawInit = unsafe extern "C" fn(flags: c_uint) -> *mut c_void;
type LibrawOpenFile = unsafe extern "C" fn(data: *mut c_void, file: *const c_char) -> c_int;
type LibrawUnpackThumb = unsafe extern "C" fn(data: *mut c_void) -> c_int;
type LibrawDcrawMakeMemThumb = unsafe extern "C" fn(data: *mut c_void, errcode: *mut c_int) -> *mut LibrawProcessedImage;
type LibrawDcrawClearMem = unsafe extern "C" fn(img: *mut LibrawProcessedImage);
type LibrawClose = unsafe extern "C" fn(data: *mut c_void);
type LibrawRecycle = unsafe extern "C" fn(data: *mut c_void);

/// LibRaw 动态库句柄和函数指针
struct LibrawLib {
    _lib: libloading::Library,
    init: LibrawInit,
    open_file: LibrawOpenFile,
    unpack_thumb: LibrawUnpackThumb,
    dcraw_make_mem_thumb: LibrawDcrawMakeMemThumb,
    dcraw_clear_mem: LibrawDcrawClearMem,
    close: LibrawClose,
    recycle: LibrawRecycle,
}

// 全局 LibRaw 库实例（懒加载）
static LIBRAW: OnceLock<Option<LibrawLib>> = OnceLock::new();

/// 初始化 LibRaw 库
fn get_libraw() -> Option<&'static LibrawLib> {
    LIBRAW.get_or_init(|| {
        load_libraw().ok()
    }).as_ref()
}

/// 加载 LibRaw 动态库
fn load_libraw() -> Result<LibrawLib, String> {
    // 获取应用程序目录
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()));

    // 构建搜索路径列表（按优先级）
    let mut search_paths: Vec<std::path::PathBuf> = Vec::new();

    // 1. 打包后的资源目录 (exe_dir/libraw/)
    if let Some(ref dir) = exe_dir {
        search_paths.push(dir.join("libraw").join("libraw.dll"));
        search_paths.push(dir.join("libraw").join("raw.dll"));
    }

    // 2. exe 同级目录
    if let Some(ref dir) = exe_dir {
        search_paths.push(dir.join("libraw.dll"));
        search_paths.push(dir.join("raw.dll"));
    }

    // 3. 开发时的 resources 目录
    if let Some(ref dir) = exe_dir {
        // 开发模式：target/debug/ -> src-tauri/resources/libraw/
        let dev_path = dir.join("..").join("..").join("resources").join("libraw").join("libraw.dll");
        search_paths.push(dev_path);
    }

    // 4. 系统 PATH
    search_paths.push(std::path::PathBuf::from("libraw.dll"));
    search_paths.push(std::path::PathBuf::from("raw.dll"));

    let mut last_error = String::new();

    for path in &search_paths {
        match unsafe { libloading::Library::new(path) } {
            Ok(lib) => {
                match load_symbols(lib) {
                    Ok(libraw) => {
                        tracing::info!("LibRaw 加载成功: {:?}", path);
                        return Ok(libraw);
                    }
                    Err(e) => {
                        last_error = e;
                        continue;
                    }
                }
            }
            Err(e) => {
                last_error = format!("{:?}: {}", path, e);
            }
        }
    }

    tracing::debug!("LibRaw 未找到，RAW 预览将使用回退方法");
    Err(last_error)
}

/// 从已加载的库中获取函数符号
fn load_symbols(lib: libloading::Library) -> Result<LibrawLib, String> {
    unsafe {
        let init: LibrawInit = *lib.get(b"libraw_init\0")
            .map_err(|e| format!("libraw_init: {}", e))?;
        let open_file: LibrawOpenFile = *lib.get(b"libraw_open_file\0")
            .map_err(|e| format!("libraw_open_file: {}", e))?;
        let unpack_thumb: LibrawUnpackThumb = *lib.get(b"libraw_unpack_thumb\0")
            .map_err(|e| format!("libraw_unpack_thumb: {}", e))?;
        let dcraw_make_mem_thumb: LibrawDcrawMakeMemThumb = *lib.get(b"libraw_dcraw_make_mem_thumb\0")
            .map_err(|e| format!("libraw_dcraw_make_mem_thumb: {}", e))?;
        let dcraw_clear_mem: LibrawDcrawClearMem = *lib.get(b"libraw_dcraw_clear_mem\0")
            .map_err(|e| format!("libraw_dcraw_clear_mem: {}", e))?;
        let close: LibrawClose = *lib.get(b"libraw_close\0")
            .map_err(|e| format!("libraw_close: {}", e))?;
        let recycle: LibrawRecycle = *lib.get(b"libraw_recycle\0")
            .map_err(|e| format!("libraw_recycle: {}", e))?;

        Ok(LibrawLib {
            _lib: lib,
            init,
            open_file,
            unpack_thumb,
            dcraw_make_mem_thumb,
            dcraw_clear_mem,
            close,
            recycle,
        })
    }
}

/// LibRaw 预览提取结果
pub enum PreviewResult {
    /// JPEG 数据
    Jpeg(Vec<u8>),
    /// RGB 位图数据
    Bitmap { width: u32, height: u32, data: Vec<u8> },
}

/// 检查 LibRaw 是否可用
pub fn is_available() -> bool {
    get_libraw().is_some()
}

/// 从 RAW 文件中提取嵌入预览图
///
/// 这是 LibRaw 集成的核心函数，只调用 unpack_thumb / dcraw_make_mem_thumb，
/// 不做 RAW 全量解码。
pub fn extract_preview(path: &Path) -> Option<PreviewResult> {
    let libraw = get_libraw()?;

    // 将路径转换为 C 字符串
    let path_str = path.to_str()?;
    let c_path = CString::new(path_str).ok()?;

    unsafe {
        // 创建 LibRaw 实例（每次调用独立实例，线程安全）
        let data = (libraw.init)(0);
        if data.is_null() {
            tracing::debug!("LibRaw init 失败");
            return None;
        }

        // 确保资源被正确释放
        let _guard = scopeguard::guard(data, |d| {
            (libraw.recycle)(d);
            (libraw.close)(d);
        });

        // 打开文件
        let ret = (libraw.open_file)(data, c_path.as_ptr());
        if ret != LIBRAW_SUCCESS {
            tracing::debug!("LibRaw open_file 失败: {}", ret);
            return None;
        }

        // 解包缩略图
        let ret = (libraw.unpack_thumb)(data);
        if ret != LIBRAW_SUCCESS {
            if ret == LIBRAW_NO_THUMBNAIL {
                tracing::debug!("RAW 文件无嵌入缩略图: {:?}", path);
            } else {
                tracing::debug!("LibRaw unpack_thumb 失败: {}", ret);
            }
            return None;
        }

        // 生成内存中的缩略图
        let mut errcode: c_int = 0;
        let img = (libraw.dcraw_make_mem_thumb)(data, &mut errcode);
        if img.is_null() || errcode != LIBRAW_SUCCESS {
            tracing::debug!("LibRaw dcraw_make_mem_thumb 失败: {}", errcode);
            return None;
        }

        // 确保图像内存被释放
        let _img_guard = scopeguard::guard(img, |i| {
            (libraw.dcraw_clear_mem)(i);
        });

        // 读取图像数据
        let img_ref = &*img;
        let data_size = img_ref.data_size as usize;
        let data_ptr = img_ref.data.as_ptr();
        let data_slice = std::slice::from_raw_parts(data_ptr, data_size);

        match img_ref.image_type {
            LIBRAW_THUMBNAIL_JPEG => {
                tracing::debug!("LibRaw 提取到 JPEG 预览: {} bytes", data_size);
                Some(PreviewResult::Jpeg(data_slice.to_vec()))
            }
            LIBRAW_THUMBNAIL_BITMAP => {
                tracing::debug!(
                    "LibRaw 提取到 Bitmap 预览: {}x{}, {} colors",
                    img_ref.width, img_ref.height, img_ref.colors
                );
                Some(PreviewResult::Bitmap {
                    width: img_ref.width,
                    height: img_ref.height,
                    data: data_slice.to_vec(),
                })
            }
            _ => {
                tracing::debug!("LibRaw 未知缩略图类型: {}", img_ref.image_type);
                None
            }
        }
    }
}

/// 从 RAW 文件提取预览并转换为 DynamicImage
pub fn extract_preview_image(path: &Path) -> Option<DynamicImage> {
    let preview = extract_preview(path)?;

    match preview {
        PreviewResult::Jpeg(data) => {
            image::load_from_memory(&data).ok()
        }
        PreviewResult::Bitmap { width, height, data } => {
            // LibRaw 返回的 bitmap 是 RGB 格式
            RgbImage::from_raw(width, height, data)
                .map(DynamicImage::ImageRgb8)
        }
    }
}

/// 带超时的 RAW 预览提取（避免单个 RAW 文件卡住整个队列）
///
/// 超时后返回 None，调用方应使用占位图
pub fn extract_preview_image_with_timeout(
    path: &Path,
    timeout_ms: u64,
) -> Option<DynamicImage> {
    use std::sync::mpsc;
    use std::thread;
    use std::time::Duration;

    let path = path.to_path_buf();
    let (tx, rx) = mpsc::channel();

    // 在独立线程中执行提取，避免阻塞调用线程
    thread::spawn(move || {
        let result = extract_preview_image(&path);
        let _ = tx.send(result);
    });

    // 等待结果或超时
    match rx.recv_timeout(Duration::from_millis(timeout_ms)) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            tracing::warn!("RAW 预览提取超时 ({}ms)", timeout_ms);
            None
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            tracing::warn!("RAW 预览提取线程异常退出");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_libraw_availability() {
        // 这个测试只检查 is_available 不会 panic
        let available = is_available();
        println!("LibRaw available: {}", available);
    }
}
