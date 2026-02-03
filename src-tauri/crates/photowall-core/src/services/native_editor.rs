//! Native Editor FFI 封装
//!
//! 通过 FFI 调用 C/C++ 实现的 libvips 图像处理

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_float, c_int};
use std::path::Path;
use std::sync::OnceLock;

use libloading::{Library, Symbol};

use crate::utils::error::{AppError, AppResult};

/// 调整参数 (与 C 结构体对应)
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct PwAdjustments {
    pub brightness: f32,
    pub contrast: f32,
    pub saturation: f32,
    pub exposure: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub temperature: f32,
    pub tint: f32,
    pub sharpen: f32,
    pub blur: f32,
    pub vignette: f32,
}

// 函数类型定义
type PwEditorInit = unsafe extern "C" fn() -> c_int;
type PwEditorCleanup = unsafe extern "C" fn();
type PwGetLastError = unsafe extern "C" fn() -> *const c_char;
type PwApplyAdjustments = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    adjustments: *const PwAdjustments,
    quality: c_int,
) -> c_int;
type PwBlur = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    sigma: c_float,
) -> c_int;
type PwSharpen = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    sigma: c_float,
    amount: c_float,
) -> c_int;
type PwAdjustExposure = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    ev: c_float,
) -> c_int;
type PwAdjustHighlights = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    amount: c_float,
) -> c_int;
type PwAdjustShadows = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    amount: c_float,
) -> c_int;
type PwAdjustTemperature = unsafe extern "C" fn(
    input_path: *const c_char,
    output_path: *const c_char,
    kelvin_shift: c_float,
) -> c_int;

/// Native Editor 库封装
pub struct NativeEditor {
    _library: Library,
    init: Symbol<'static, PwEditorInit>,
    cleanup: Symbol<'static, PwEditorCleanup>,
    get_last_error: Symbol<'static, PwGetLastError>,
    apply_adjustments: Symbol<'static, PwApplyAdjustments>,
    blur: Symbol<'static, PwBlur>,
    sharpen: Symbol<'static, PwSharpen>,
    adjust_exposure: Symbol<'static, PwAdjustExposure>,
    adjust_highlights: Symbol<'static, PwAdjustHighlights>,
    adjust_shadows: Symbol<'static, PwAdjustShadows>,
    adjust_temperature: Symbol<'static, PwAdjustTemperature>,
    initialized: bool,
}

// 全局实例
static NATIVE_EDITOR: OnceLock<Result<NativeEditor, String>> = OnceLock::new();

impl NativeEditor {
    /// 加载 native editor 库
    pub fn load() -> AppResult<&'static NativeEditor> {
        let result = NATIVE_EDITOR.get_or_init(|| {
            Self::load_internal().map_err(|e| e.to_string())
        });

        match result {
            Ok(editor) => Ok(editor),
            Err(e) => Err(AppError::General(format!("Failed to load native editor: {}", e))),
        }
    }

    fn load_internal() -> AppResult<NativeEditor> {
        // 尝试多个可能的 DLL 路径
        let dll_paths = [
            "photowall_editor.dll",
            "./photowall_editor.dll",
            "../native/build/Release/photowall_editor.dll",
            "../native/build/Debug/photowall_editor.dll",
        ];

        let mut last_error = None;
        let library = dll_paths.iter().find_map(|path| {
            match unsafe { Library::new(path) } {
                Ok(lib) => Some(lib),
                Err(e) => {
                    last_error = Some(e);
                    None
                }
            }
        }).ok_or_else(|| {
            AppError::General(format!(
                "Failed to load photowall_editor.dll: {:?}",
                last_error
            ))
        })?;

        // 加载函数符号
        unsafe {
            let init: Symbol<PwEditorInit> = library
                .get(b"pw_editor_init")
                .map_err(|e| AppError::General(format!("Symbol pw_editor_init not found: {}", e)))?;

            let cleanup: Symbol<PwEditorCleanup> = library
                .get(b"pw_editor_cleanup")
                .map_err(|e| AppError::General(format!("Symbol pw_editor_cleanup not found: {}", e)))?;

            let get_last_error: Symbol<PwGetLastError> = library
                .get(b"pw_get_last_error")
                .map_err(|e| AppError::General(format!("Symbol pw_get_last_error not found: {}", e)))?;

            let apply_adjustments: Symbol<PwApplyAdjustments> = library
                .get(b"pw_apply_adjustments")
                .map_err(|e| AppError::General(format!("Symbol pw_apply_adjustments not found: {}", e)))?;

            let blur: Symbol<PwBlur> = library
                .get(b"pw_blur")
                .map_err(|e| AppError::General(format!("Symbol pw_blur not found: {}", e)))?;

            let sharpen: Symbol<PwSharpen> = library
                .get(b"pw_sharpen")
                .map_err(|e| AppError::General(format!("Symbol pw_sharpen not found: {}", e)))?;

            let adjust_exposure: Symbol<PwAdjustExposure> = library
                .get(b"pw_adjust_exposure")
                .map_err(|e| AppError::General(format!("Symbol pw_adjust_exposure not found: {}", e)))?;

            let adjust_highlights: Symbol<PwAdjustHighlights> = library
                .get(b"pw_adjust_highlights")
                .map_err(|e| AppError::General(format!("Symbol pw_adjust_highlights not found: {}", e)))?;

            let adjust_shadows: Symbol<PwAdjustShadows> = library
                .get(b"pw_adjust_shadows")
                .map_err(|e| AppError::General(format!("Symbol pw_adjust_shadows not found: {}", e)))?;

            let adjust_temperature: Symbol<PwAdjustTemperature> = library
                .get(b"pw_adjust_temperature")
                .map_err(|e| AppError::General(format!("Symbol pw_adjust_temperature not found: {}", e)))?;

            // 延长生命周期 (库会一直保持加载)
            let init: Symbol<'static, PwEditorInit> = std::mem::transmute(init);
            let cleanup: Symbol<'static, PwEditorCleanup> = std::mem::transmute(cleanup);
            let get_last_error: Symbol<'static, PwGetLastError> = std::mem::transmute(get_last_error);
            let apply_adjustments: Symbol<'static, PwApplyAdjustments> = std::mem::transmute(apply_adjustments);
            let blur: Symbol<'static, PwBlur> = std::mem::transmute(blur);
            let sharpen: Symbol<'static, PwSharpen> = std::mem::transmute(sharpen);
            let adjust_exposure: Symbol<'static, PwAdjustExposure> = std::mem::transmute(adjust_exposure);
            let adjust_highlights: Symbol<'static, PwAdjustHighlights> = std::mem::transmute(adjust_highlights);
            let adjust_shadows: Symbol<'static, PwAdjustShadows> = std::mem::transmute(adjust_shadows);
            let adjust_temperature: Symbol<'static, PwAdjustTemperature> = std::mem::transmute(adjust_temperature);

            let mut editor = NativeEditor {
                _library: library,
                init,
                cleanup,
                get_last_error,
                apply_adjustments,
                blur,
                sharpen,
                adjust_exposure,
                adjust_highlights,
                adjust_shadows,
                adjust_temperature,
                initialized: false,
            };

            // 初始化 libvips
            editor.initialize()?;

            Ok(editor)
        }
    }

    /// 初始化编辑器
    fn initialize(&mut self) -> AppResult<()> {
        if self.initialized {
            return Ok(());
        }

        let result = unsafe { (self.init)() };
        if result != 0 {
            return Err(AppError::General(format!(
                "Failed to initialize native editor: {}",
                self.last_error()
            )));
        }

        self.initialized = true;
        Ok(())
    }

    /// 获取最后一次错误信息
    fn last_error(&self) -> String {
        unsafe {
            let ptr = (self.get_last_error)();
            if ptr.is_null() {
                "Unknown error".to_string()
            } else {
                CStr::from_ptr(ptr).to_string_lossy().into_owned()
            }
        }
    }

    /// 应用综合调整
    pub fn apply_adjustments(
        &self,
        input_path: &Path,
        output_path: &Path,
        adjustments: &PwAdjustments,
        quality: i32,
    ) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe {
            (self.apply_adjustments)(input.as_ptr(), output.as_ptr(), adjustments, quality)
        };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to apply adjustments: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 应用模糊
    pub fn blur(&self, input_path: &Path, output_path: &Path, sigma: f32) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe { (self.blur)(input.as_ptr(), output.as_ptr(), sigma) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to apply blur: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 应用锐化
    pub fn sharpen(
        &self,
        input_path: &Path,
        output_path: &Path,
        sigma: f32,
        amount: f32,
    ) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe { (self.sharpen)(input.as_ptr(), output.as_ptr(), sigma, amount) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to apply sharpen: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 调整曝光
    pub fn adjust_exposure(&self, input_path: &Path, output_path: &Path, ev: f32) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe { (self.adjust_exposure)(input.as_ptr(), output.as_ptr(), ev) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to adjust exposure: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 调整高光
    pub fn adjust_highlights(
        &self,
        input_path: &Path,
        output_path: &Path,
        amount: f32,
    ) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe { (self.adjust_highlights)(input.as_ptr(), output.as_ptr(), amount) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to adjust highlights: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 调整阴影
    pub fn adjust_shadows(
        &self,
        input_path: &Path,
        output_path: &Path,
        amount: f32,
    ) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result = unsafe { (self.adjust_shadows)(input.as_ptr(), output.as_ptr(), amount) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to adjust shadows: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }

    /// 调整色温
    pub fn adjust_temperature(
        &self,
        input_path: &Path,
        output_path: &Path,
        kelvin_shift: f32,
    ) -> AppResult<()> {
        let input = path_to_cstring(input_path)?;
        let output = path_to_cstring(output_path)?;

        let result =
            unsafe { (self.adjust_temperature)(input.as_ptr(), output.as_ptr(), kelvin_shift) };

        if result != 0 {
            Err(AppError::General(format!(
                "Failed to adjust temperature: {}",
                self.last_error()
            )))
        } else {
            Ok(())
        }
    }
}

impl Drop for NativeEditor {
    fn drop(&mut self) {
        if self.initialized {
            unsafe {
                (self.cleanup)();
            }
        }
    }
}

// 路径转 CString
fn path_to_cstring(path: &Path) -> AppResult<CString> {
    let path_str = path.to_str().ok_or_else(|| {
        AppError::General("Invalid path encoding".to_string())
    })?;

    CString::new(path_str).map_err(|_| {
        AppError::General("Path contains null byte".to_string())
    })
}

/// 检查 native editor 是否可用
pub fn is_native_editor_available() -> bool {
    NativeEditor::load().is_ok()
}
