# PhotoWall 缩略图加载方案

## 一、架构概览

PhotoWall 采用 **事件驱动 + 优先级队列 + 三级缓存** 的缩略图架构。

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ PhotoGrid   │───▶│ useThumbnail│───▶│ ThumbnailStore      │  │
│  │ (虚拟滚动)  │    │ (Hook)      │    │ (内存缓存+事件监听) │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Tauri IPC
┌─────────────────────────────▼───────────────────────────────────┐
│                        后端 (Rust)                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ Commands    │───▶│ Thumbnail   │───▶│ ThumbnailService    │  │
│  │ (IPC入口)   │    │ Queue       │    │ (生成+缓存)         │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                                              │                   │
│                     ┌────────────────────────┼────────────────┐  │
│                     ▼                        ▼                ▼  │
│              ┌──────────┐            ┌──────────┐      ┌────────┐│
│              │ WIC加速  │            │ LibRaw   │      │ image  ││
│              │ (Windows)│            │ (RAW)    │      │ crate  ││
│              └──────────┘            └──────────┘      └────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 二、尺寸规格

| 尺寸名称 | 像素大小 | 用途 | 优先级加成 |
|---------|---------|------|-----------|
| `tiny` | 50×50 | 模糊占位图 | +10 |
| `small` | 300×300 | 网格列表 | 0 |
| `medium` | 500×500 | 中等预览 | 0 |
| `large` | 800×800 | 查看器 | 0 |

## 三、三级缓存架构

```
请求缩略图
    │
    ▼
┌─────────────────────────┐
│ L1: 内存缓存 (前端)      │  ← ThumbnailStore (Map<key, url>)
│ • 即时返回              │
│ • 无 IPC 开销           │
│ • 生命周期: 会话级       │
└───────────┬─────────────┘
            │ 未命中
            ▼
┌─────────────────────────┐
│ L2: 磁盘缓存 (后端)      │  ← %AppData%\PhotoWall\Thumbnails\
│ • IPC 查询路径          │
│ • WebP 格式存储         │
│ • 生命周期: 持久化       │
└───────────┬─────────────┘
            │ 未命中
            ▼
┌─────────────────────────┐
│ L3: 生成队列 (后端)      │  ← ThumbnailQueue (优先级队列)
│ • 异步生成              │
│ • 事件通知前端          │
│ • 多工作线程并行        │
└─────────────────────────┘
```

### 3.1 磁盘缓存目录结构

```
%AppData%\PhotoWall\Thumbnails\
├── tiny\
│   ├── {file_hash}.webp
│   └── ...
├── small\
│   ├── {file_hash}.webp
│   └── ...
├── medium\
│   └── ...
└── large\
    └── ...
```

### 3.2 缓存键设计

```typescript
// 前端缓存键
const cacheKey = `${fileHash}_${size}`;  // 例: "abc123_small"

// 后端缓存路径
// {cache_dir}/{size}/{file_hash}.webp
```

## 四、前端实现详解

### 4.1 核心 Hook: `useThumbnail`

**文件**: `src/hooks/useThumbnail.ts`

```typescript
export interface ThumbnailOptions {
  size?: ThumbnailSize;           // 尺寸: tiny | small | medium | large
  priority?: number;              // 优先级 (数值越大越优先)
  enabled?: boolean;              // 是否启用
  suspendNewRequests?: boolean;   // 滚动时暂停新请求
  loadDelay?: number;             // 防抖延迟 (ms)
  width?: number;                 // 原图宽度 (用于小图跳过判断)
  height?: number;                // 原图高度
}

export interface UseThumbnailResult {
  thumbnailUrl: string | null;    // 缩略图 URL
  isLoading: boolean;             // 加载中
  error: Error | null;            // 错误信息
  reload: () => void;             // 重新加载
  cancel: () => void;             // 取消请求
}
```

**加载流程**:

```
useThumbnail(filePath, fileHash, options)
    │
    ├─▶ 1. 检查内存缓存 (ThumbnailStore)
    │       └─▶ 命中 → 直接返回 URL
    │
    ├─▶ 2. 检查 suspendNewRequests
    │       └─▶ true → 保留已缓存结果，不发起新请求
    │
    ├─▶ 3. 应用 loadDelay 防抖
    │       └─▶ 延迟后继续
    │
    ├─▶ 4. 调用 get_thumbnail_cache_path (IPC)
    │       └─▶ 命中磁盘缓存 → 转换为 asset URL → 存入内存缓存
    │
    └─▶ 5. 调用 enqueue_thumbnail (IPC)
            └─▶ 入队生成 → 等待 thumbnail-ready 事件
```

### 4.2 渐进式加载: `useThumbnailProgressive`

**策略**: 先加载极小模糊图，再加载目标尺寸

```typescript
export function useThumbnailProgressive(
  filePath: string,
  fileHash: string,
  options: ThumbnailOptions
): {
  tinyUrl: string | null;    // 50px 模糊占位图
  fullUrl: string | null;    // 目标尺寸缩略图
  showTiny: boolean;         // 是否显示模糊图
  isLoading: boolean;
}
```

**渲染逻辑**:

```tsx
// PhotoThumbnail.tsx
const { tinyUrl, fullUrl, showTiny } = useThumbnailProgressive(
  photo.filePath,
  photo.fileHash,
  { size: 'small', suspendNewRequests: isScrolling, loadDelay: 80 }
);

return (
  <div className="relative">
    {/* 模糊占位图 */}
    {tinyUrl && showTiny && (
      <img src={tinyUrl} className="blur-md scale-105 absolute inset-0" />
    )}

    {/* 完整缩略图 */}
    {fullUrl && (
      <img
        src={fullUrl}
        className={`transition-opacity ${fullLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setFullLoaded(true)}
      />
    )}

    {/* 加载骨架屏 */}
    {isLoading && !tinyUrl && (
      <div className="animate-pulse bg-zinc-100 absolute inset-0" />
    )}
  </div>
);
```

### 4.3 内存缓存: `ThumbnailStore`

**文件**: `src/services/ThumbnailStore.ts`

```typescript
class ThumbnailStore {
  private cache: Map<string, string>;           // 缓存: key → URL
  private listeners: Map<string, Set<Function>>; // 订阅者

  // 获取缓存
  get(fileHash: string, size: ThumbnailSize): string | null;

  // 设置缓存
  set(fileHash: string, size: ThumbnailSize, url: string): void;

  // 订阅更新 (用于事件驱动模式)
  subscribe(fileHash: string, size: ThumbnailSize, callback: (url: string) => void): () => void;
}
```

**事件监听**:

```typescript
// 监听后端 thumbnail-ready 事件
listen<ThumbnailReadyPayload>('thumbnail-ready', (event) => {
  const { fileHash, size, path, isPlaceholder, placeholderBase64 } = event.payload;

  let url: string;
  if (isPlaceholder && placeholderBase64) {
    // 占位图使用 data URL，不缓存到内存
    url = `data:image/webp;base64,${placeholderBase64}`;
  } else {
    // 正常缩略图转换为 asset URL 并缓存
    url = convertFileSrc(path);
    this.cache.set(key, url);
  }

  // 通知所有订阅者
  this.listeners.get(key)?.forEach(listener => listener(url));
});
```

### 4.4 网格组件优化: `PhotoGrid`

**文件**: `src/components/photo/PhotoGrid.tsx`

**优化策略**:

| 优化项 | 实现方式 | 效果 |
|--------|---------|------|
| 虚拟滚动 | react-virtuoso | 只渲染可见区域 DOM |
| 滚动状态传递 | `isScrolling` prop | 滚动时暂停新请求 |
| 批量预加载 | `rangeChanged` 回调 | 减少 IPC 调用次数 |
| 防抖处理 | 150ms debounce | 避免频繁预加载 |

**预加载逻辑**:

```typescript
const handleRangeChanged = useCallback((range: ListRange) => {
  // 防抖 150ms
  clearTimeout(preloadDebounceRef.current);
  preloadDebounceRef.current = setTimeout(async () => {
    // 1. 获取可见范围内的照片
    const visiblePhotos = getPhotosInRange(range);

    // 2. 批量检查磁盘缓存状态
    const checkItems = visiblePhotos.map(p => ({
      fileHash: p.fileHash,
      size: 'small'
    }));
    const cacheStatus = await checkThumbnailsCached(checkItems);

    // 3. 将已缓存的添加到内存
    for (const [key, status] of cacheStatus) {
      if (status.cached && status.path) {
        thumbnailStore.set(fileHash, size, convertFileSrc(status.path));
      }
    }

    // 4. 批量入队未缓存的任务
    const tasks = visiblePhotos
      .filter(p => !cacheStatus.get(p.fileHash)?.cached)
      .map(p => ({
        sourcePath: p.filePath,
        fileHash: p.fileHash,
        size: 'small',
        priority: calculatePriority(p, range)
      }));

    await enqueueThumbnails(tasks);
  }, 150);
}, [/* deps */]);
```

## 五、后端实现详解

### 5.1 缩略图服务: `ThumbnailService`

**文件**: `src-tauri/src/services/thumbnail.rs`

#### 5.1.1 生成策略优先级

```
生成缩略图
    │
    ├─▶ 1. 小图跳过检查
    │       └─▶ < 200万像素 → 直接使用原图
    │
    ├─▶ 2. WIC 加速 (Windows)
    │       └─▶ 成功 → 返回
    │       └─▶ 失败 → 继续
    │
    ├─▶ 3. JPEG 快速提取
    │       └─▶ 从 EXIF 提取嵌入缩略图
    │
    ├─▶ 4. RAW 格式处理 (分级策略)
    │       ├─▶ Tiny/Small/Medium: 仅提取嵌入预览
    │       └─▶ Large: 允许 RAW 硬解码
    │
    └─▶ 5. 普通格式
            └─▶ image::open() 加载并缩放
```

#### 5.1.2 小图跳过逻辑

```rust
// 低于 200 万像素直接使用原图
const SMALL_IMAGE_PIXEL_THRESHOLD: u64 = 2_000_000;

if let Some((w, h)) = original_dimensions {
    let pixels = w as u64 * h as u64;
    if pixels < SMALL_IMAGE_PIXEL_THRESHOLD {
        return Ok(ThumbnailResult {
            path: source_path.to_path_buf(),
            use_original: true,
            hit_cache: false,
            is_placeholder: false,
            ..Default::default()
        });
    }
}
```

#### 5.1.3 去重机制

使用 `Condvar` 确保同一张图 + 同一尺寸只生成一次：

```rust
pub fn get_or_generate(&self, ...) -> AppResult<ThumbnailResult> {
    let key = format!("{}_{}", file_hash, size);

    // 获取锁
    let (lock, cvar) = &*self.in_flight;
    let mut tracker = lock.lock().unwrap();

    // 等待其他线程完成相同任务
    while tracker.in_flight.contains(&key) {
        tracker = cvar.wait(tracker).unwrap();
        // 再次检查缓存（可能已被其他线程生成）
        if self.is_cached(file_hash, size) {
            return Ok(ThumbnailResult { hit_cache: true, ... });
        }
    }

    // 标记正在处理
    tracker.in_flight.insert(key.clone());
    drop(tracker);

    // 执行生成...
    let result = self.generate_internal(...);

    // 移除标记并通知等待者
    let mut tracker = lock.lock().unwrap();
    tracker.in_flight.remove(&key);
    cvar.notify_all();

    result
}
```

### 5.2 优先级队列: `ThumbnailQueue`

**文件**: `src-tauri/src/services/thumbnail_queue.rs`

#### 5.2.1 任务结构

```rust
pub struct ThumbnailTask {
    pub source_path: PathBuf,
    pub file_hash: String,
    pub size: ThumbnailSize,
    pub priority: i32,              // 优先级 (越大越优先)
    pub seq: u64,                   // 序列号 (相同优先级时 FIFO)
    pub original_dimensions: Option<(u32, u32)>,
}

impl Ord for ThumbnailTask {
    fn cmp(&self, other: &Self) -> Ordering {
        // 优先级高的排前面，相同优先级按序列号
        other.priority.cmp(&self.priority)
            .then_with(|| self.seq.cmp(&other.seq))
    }
}
```

#### 5.2.2 工作线程

```rust
fn spawn_worker(&self, worker_id: usize) {
    let state = self.state.clone();
    let service = self.thumbnail_service.clone();
    let app_handle = self.app_handle.clone();

    thread::spawn(move || {
        loop {
            // 等待任务
            let task = {
                let mut guard = state.lock().unwrap();
                while guard.queue.is_empty() && !guard.shutdown {
                    guard = state.cvar.wait(guard).unwrap();
                }
                if guard.shutdown { break; }
                guard.queue.pop()
            };

            if let Some(task) = task {
                // 检查是否已取消
                if state.lock().unwrap().cancelled.contains(&task.file_hash) {
                    continue;
                }

                // 执行生成
                match service.get_or_generate(
                    &task.source_path,
                    &task.file_hash,
                    task.size,
                    task.original_dimensions
                ) {
                    Ok(result) => {
                        // 发送事件通知前端
                        emit_thumbnail_ready(
                            &app_handle,
                            &task.file_hash,
                            task.size,
                            &result.path,
                            result.is_placeholder,
                            result.placeholder_bytes.as_deref(),
                            result.use_original,
                        );
                    }
                    Err(e) => {
                        log::error!("Thumbnail generation failed: {}", e);
                    }
                }
            }
        }
    });
}
```

### 5.3 RAW 格式处理

#### 5.3.1 分级策略

| 尺寸 | 策略 | 超时 | 说明 |
|-----|------|-----|------|
| Tiny | 仅提取嵌入预览 | 800ms | 快速失败，生成占位图 |
| Small | 仅提取嵌入预览 | 1500ms | 快速失败，生成占位图 |
| Medium | 仅提取嵌入预览 | 1500ms | 快速失败，生成占位图 |
| Large | 允许硬解码 | 3000ms | 尝试所有方法 |

#### 5.3.2 提取链路

```rust
fn extract_raw_preview(&self, path: &Path, size: ThumbnailSize) -> Option<DynamicImage> {
    let timeout_ms = match size {
        ThumbnailSize::Tiny => 800,
        ThumbnailSize::Small | ThumbnailSize::Medium => 1500,
        ThumbnailSize::Large => 3000,
    };

    // 方法1: LibRaw 提取嵌入预览（首选）
    if libraw::is_available() {
        if let Some(img) = libraw::extract_preview_image_with_timeout(path, timeout_ms) {
            return Some(img);
        }
    }

    // 方法2: EXIF 嵌入 JPEG
    if let Some(img) = self.extract_raw_embedded_jpeg(path) {
        return Some(img);
    }

    // 方法3 & 4: 仅 Large 尺寸使用
    if size != ThumbnailSize::Large {
        return None;
    }

    // 方法3: 扫描文件查找 JPEG（限制 32MB）
    if let Some(img) = self.scan_embedded_jpeg_limited(path, 32 * 1024 * 1024, 50 * 1024) {
        return Some(img);
    }

    // 方法4: RAW 硬解码（Bayer 去马赛克）
    self.decode_raw_image(path)
}
```

#### 5.3.3 占位图生成

RAW 提取失败时生成占位图：

```rust
fn generate_raw_placeholder(&self, size: ThumbnailSize) -> DynamicImage {
    let dim = size.dimensions();
    let mut img = RgbImage::new(dim, dim);

    // 灰色背景
    for pixel in img.pixels_mut() {
        *pixel = Rgb([128, 128, 128]);
    }

    // 绘制边框
    draw_border(&mut img, Rgb([100, 100, 100]));

    // 绘制 "RAW" 文字 (5x7 位图字体)
    draw_text(&mut img, "RAW", center_x, center_y);

    DynamicImage::ImageRgb8(img)
}
```

**注意**: 占位图不缓存到磁盘，通过 `AppError::PlaceholderGenerated(bytes)` 返回 Base64 数据。

### 5.4 WIC 加速

**文件**: `src-tauri/src/services/wic.rs`

Windows Imaging Component 提供原生硬件加速：

```rust
pub fn load_and_resize(
    &self,
    path: &Path,
    target_width: u32,
    target_height: u32
) -> AppResult<(Vec<u8>, u32, u32)> {
    unsafe {
        // 创建解码器
        let decoder = self.factory.CreateDecoderFromFilename(
            &HSTRING::from(path.to_string_lossy().as_ref()),
            None,
            GENERIC_READ,
            WICDecodeMetadataCacheOnDemand,
        )?;

        let frame = decoder.GetFrame(0)?;
        let (orig_w, orig_h) = frame.GetSize()?;

        // 计算缩放比例（保持宽高比）
        let scale = (target_width as f64 / orig_w as f64)
            .min(target_height as f64 / orig_h as f64);
        let new_w = (orig_w as f64 * scale).round() as u32;
        let new_h = (orig_h as f64 * scale).round() as u32;

        // 创建缩放器（高质量三次插值）
        let scaler = self.factory.CreateBitmapScaler()?;
        scaler.Initialize(
            &frame,
            new_w,
            new_h,
            WICBitmapInterpolationModeHighQualityCubic
        )?;

        // 转换为 BGRA 格式
        let converter = self.factory.CreateFormatConverter()?;
        converter.Initialize(
            &scaler,
            &GUID_WICPixelFormat32bppBGRA,
            WICBitmapDitherTypeNone,
            None,
            0.0,
            WICBitmapPaletteTypeCustom,
        )?;

        // 复制像素数据
        let stride = new_w * 4;
        let mut buffer = vec![0u8; (stride * new_h) as usize];
        converter.CopyPixels(None, stride, &mut buffer)?;

        Ok((buffer, new_w, new_h))
    }
}
```

### 5.5 LibRaw 集成

**文件**: `src-tauri/src/services/libraw.rs`

#### 5.5.1 动态加载

```rust
lazy_static! {
    static ref LIBRAW: Option<LibRaw> = {
        // 尝试加载 libraw.dll
        unsafe {
            libloading::Library::new("libraw.dll")
                .ok()
                .map(|lib| LibRaw::from_library(lib))
        }
    };
}

pub fn is_available() -> bool {
    LIBRAW.is_some()
}
```

#### 5.5.2 工作线程池

```rust
struct RawPreviewWorker {
    tx: crossbeam_channel::Sender<RawPreviewJob>,
}

impl RawPreviewWorker {
    fn global() -> &'static Self {
        static INSTANCE: OnceCell<RawPreviewWorker> = OnceCell::new();
        INSTANCE.get_or_init(|| {
            let (tx, rx) = crossbeam_channel::bounded(32);

            // 启动 4 个工作线程
            for _ in 0..4 {
                let rx = rx.clone();
                thread::spawn(move || {
                    while let Ok(job) = rx.recv() {
                        match job {
                            RawPreviewJob::Decode { path, result_tx } => {
                                let result = extract_preview_internal(&path);
                                let _ = result_tx.send(result);
                            }
                        }
                    }
                });
            }

            RawPreviewWorker { tx }
        })
    }
}
```

## 六、Tauri IPC 命令

**文件**: `src-tauri/src/commands/thumbnail.rs`

### 6.1 命令列表

| 命令 | 功能 | 参数 |
|-----|------|-----|
| `generate_thumbnail` | 同步生成缩略图 | source_path, file_hash, size, width, height |
| `enqueue_thumbnail` | 入队异步生成 | source_path, file_hash, size, priority, width, height |
| `get_thumbnail_cache_path` | 查询缓存路径 | file_hash, size |
| `check_thumbnails_cached` | 批量检查缓存 | items: [{fileHash, size}] |
| `enqueue_thumbnails` | 批量入队 | tasks: [{sourcePath, fileHash, size, priority}] |
| `warm_thumbnail_cache` | 预热缓存 | strategy, limit |
| `cancel_thumbnail` | 取消任务 | file_hash |
| `get_thumbnail_stats` | 获取统计信息 | - |

### 6.2 关键命令实现

#### 6.2.1 `generate_thumbnail`

```rust
#[tauri::command]
pub async fn generate_thumbnail(
    state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<ThumbnailResponse, CommandError> {
    let size = ThumbnailSize::from_str(&size.unwrap_or("small".into()));
    let cache_path = state.thumbnail_service.get_cache_path(&file_hash, size);

    // Fast path: 缓存命中
    if cache_path.exists() {
        CACHE_HITS.fetch_add(1, Ordering::Relaxed);
        return Ok(ThumbnailResponse {
            path: cache_path.to_string_lossy().to_string(),
            hit_cache: true,
            ..Default::default()
        });
    }

    CACHE_MISSES.fetch_add(1, Ordering::Relaxed);

    // RAW 和普通格式使用不同的并发限制
    let limiter = if is_raw_file(&source_path) {
        state.thumbnail_limiter_raw.clone()  // 1 个并发
    } else {
        state.thumbnail_limiter.clone()       // N 个并发
    };

    let _permit = limiter.acquire_owned().await?;

    // 在阻塞线程中生成
    let result = tauri::async_runtime::spawn_blocking(move || {
        service.get_or_generate(&path_buf, &file_hash, size, original_dimensions)
    }).await??;

    // 处理占位图
    let placeholder_base64 = result.placeholder_bytes.as_ref()
        .map(|bytes| STANDARD.encode(bytes));

    Ok(ThumbnailResponse {
        path: result.path.to_string_lossy().to_string(),
        is_placeholder: result.is_placeholder,
        placeholder_base64,
        use_original: result.use_original,
        hit_cache: result.hit_cache,
        generation_time_ms: result.generation_time_ms,
    })
}
```

#### 6.2.2 `enqueue_thumbnail`

```rust
#[tauri::command]
pub async fn enqueue_thumbnail(
    state: State<'_, AppState>,
    source_path: String,
    file_hash: String,
    size: Option<String>,
    priority: Option<i32>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<(), CommandError> {
    let task = ThumbnailTask::with_dimensions(
        PathBuf::from(source_path),
        file_hash,
        ThumbnailSize::from_str(&size.unwrap_or("small".into())),
        priority.unwrap_or(0),
        width,
        height,
    );

    state.thumbnail_queue.enqueue(task);
    Ok(())
}
```

#### 6.2.3 `warm_thumbnail_cache`

```rust
#[tauri::command]
pub async fn warm_thumbnail_cache(
    state: State<'_, AppState>,
    strategy: WarmCacheStrategy,  // Recent | FirstPage
    limit: Option<usize>,
) -> Result<WarmCacheResult, CommandError> {
    let limit = limit.unwrap_or(100);

    // 根据策略获取照片列表
    let photos = match strategy {
        WarmCacheStrategy::Recent => db.get_recent_photos(limit)?,
        WarmCacheStrategy::FirstPage => db.get_first_page_photos(limit)?,
    };

    let mut tasks = Vec::new();
    let mut already_cached = 0;

    for photo in photos {
        // 检查 tiny 尺寸
        if !service.is_cached(&photo.file_hash, ThumbnailSize::Tiny) {
            tasks.push(ThumbnailTask::new(
                photo.file_path.clone(),
                photo.file_hash.clone(),
                ThumbnailSize::Tiny,
                10,  // 高优先级
            ));
        } else {
            already_cached += 1;
        }

        // 检查 small 尺寸
        if !service.is_cached(&photo.file_hash, ThumbnailSize::Small) {
            tasks.push(ThumbnailTask::new(
                photo.file_path,
                photo.file_hash,
                ThumbnailSize::Small,
                10,
            ));
        } else {
            already_cached += 1;
        }
    }

    let queued = tasks.len();
    queue.enqueue_batch(tasks);

    Ok(WarmCacheResult { queued, already_cached })
}
```

## 七、事件通信

### 7.1 事件定义

| 事件名 | 方向 | 载荷 | 说明 |
|-------|------|-----|------|
| `thumbnail-ready` | 后端 → 前端 | ThumbnailReadyPayload | 缩略图生成完成 |

### 7.2 事件载荷

```typescript
interface ThumbnailReadyPayload {
  fileHash: string;           // 文件哈希
  size: string;               // 尺寸: tiny | small | medium | large
  path: string;               // 缓存文件路径
  isPlaceholder: boolean;     // 是否为占位图
  placeholderBase64?: string; // 占位图 Base64 数据
  useOriginal: boolean;       // 是否使用原图
}
```

### 7.3 事件发送

```rust
fn emit_thumbnail_ready(
    app_handle: &AppHandle,
    file_hash: &str,
    size: ThumbnailSize,
    path: &Path,
    is_placeholder: bool,
    placeholder_bytes: Option<&[u8]>,
    use_original: bool,
) {
    let payload = ThumbnailReadyPayload {
        file_hash: file_hash.to_string(),
        size: size.to_string(),
        path: path.to_string_lossy().to_string(),
        is_placeholder,
        placeholder_base64: placeholder_bytes.map(|b| STANDARD.encode(b)),
        use_original,
    };

    let _ = app_handle.emit("thumbnail-ready", payload);
}
```

## 八、性能优化总结

### 8.1 前端优化

| 优化项 | 实现方式 | 效果 |
|--------|---------|------|
| 虚拟滚动 | react-virtuoso | 只渲染可见区域，减少 DOM 节点 |
| 滚动防抖 | `suspendNewRequests` + `loadDelay: 80ms` | 快速滚动时不发起请求 |
| 渐进式加载 | tiny → full | 先显示模糊占位，提升感知速度 |
| 批量预加载 | `enqueueThumbnails` | 减少 IPC 调用次数 |
| 内存缓存 | `ThumbnailStore` | 避免重复请求 |
| 事件驱动 | `thumbnail-ready` 事件 | 避免轮询，减少 CPU 占用 |

### 8.2 后端优化

| 优化项 | 实现方式 | 效果 |
|--------|---------|------|
| WIC 加速 | Windows Imaging Component | 原生 API，性能提升 2-3x |
| JPEG 快速提取 | EXIF 嵌入缩略图 | 避免解码整个图像 |
| RAW 分级策略 | Tiny/Small/Medium 禁止硬解码 | 避免滚动卡顿 |
| 小图跳过 | < 200 万像素直接用原图 | 减少不必要的生成 |
| 去重机制 | Condvar 同步 | 避免重复生成 |
| 优先级队列 | BinaryHeap | 可见区域优先生成 |
| 并发限制 | Semaphore (RAW: 1, 普通: N) | 避免 RAW 阻塞队列 |
| LibRaw 超时 | 800-3000ms | 避免单个文件卡住队列 |
| WebP 格式 | 有损压缩 quality=85 | 体积小，质量高 |

### 8.3 性能指标

| 指标 | 目标值 | 说明 |
|-----|-------|------|
| 缓存命中响应 | < 5ms | 内存缓存直接返回 |
| 磁盘缓存响应 | < 20ms | IPC + 文件存在检查 |
| 普通图生成 | < 200ms | WIC 加速 |
| RAW 预览提取 | < 1500ms | LibRaw 嵌入预览 |
| RAW 硬解码 | < 5000ms | 仅 Large 尺寸 |

## 九、配置项

**文件**: `src-tauri/src/models/settings.rs`

```rust
pub struct ThumbnailSettings {
    /// 缓存大小限制 (MB)，默认 1024
    pub cache_size_mb: u64,

    /// 质量 0-100，默认 85
    pub quality: u8,

    /// 自动清理，默认 true
    pub auto_cleanup: bool,

    /// 清理阈值 (%)，默认 90
    pub cleanup_threshold: u8,

    /// 启用 LibRaw，默认 true
    pub libraw_enabled: bool,
}

pub struct PerformanceSettings {
    /// 工作线程数，0 = 自动，默认 4
    pub thumbnail_threads: usize,
}
```

## 十、文件清单

### 10.1 前端文件

| 文件路径 | 功能 |
|---------|------|
| `src/hooks/useThumbnail.ts` | 缩略图加载 Hook（核心逻辑） |
| `src/services/ThumbnailStore.ts` | 内存缓存 + 事件监听 |
| `src/components/photo/PhotoGrid.tsx` | 网格组件 + 预加载 |
| `src/components/photo/PhotoThumbnail.tsx` | 缩略图组件 + 渐进式加载 |
| `src/services/api.ts` | Tauri IPC 封装 |

### 10.2 后端文件

| 文件路径 | 功能 |
|---------|------|
| `src-tauri/src/services/thumbnail.rs` | 缩略图生成服务（核心逻辑） |
| `src-tauri/src/services/thumbnail_queue.rs` | 优先级队列 + 工作线程 |
| `src-tauri/src/commands/thumbnail.rs` | Tauri IPC 命令 |
| `src-tauri/src/services/libraw.rs` | LibRaw FFI 绑定 |
| `src-tauri/src/services/wic.rs` | WIC 加速 |
| `src-tauri/src/models/settings.rs` | 配置数据结构 |

## 十一、流程图

### 11.1 完整加载流程

```
用户滚动到新区域
        │
        ▼
┌───────────────────┐
│ PhotoGrid         │
│ rangeChanged      │
└─────────┬─────────┘
          │ 防抖 150ms
          ▼
┌───────────────────┐
│ 批量检查缓存状态   │ ──▶ checkThumbnailsCached (IPC)
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
已缓存        未缓存
    │           │
    ▼           ▼
存入内存    批量入队
    │           │
    │           ▼
    │    ┌───────────────────┐
    │    │ ThumbnailQueue    │
    │    │ (优先级排序)       │
    │    └─────────┬─────────┘
    │              │
    │              ▼
    │    ┌───────────────────┐
    │    │ Worker Thread     │
    │    │ get_or_generate   │
    │    └─────────┬─────────┘
    │              │
    │              ▼
    │    ┌───────────────────┐
    │    │ emit thumbnail-   │
    │    │ ready event       │
    │    └─────────┬─────────┘
    │              │
    └──────┬───────┘
           ▼
┌───────────────────┐
│ ThumbnailStore    │
│ 更新缓存 + 通知    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ PhotoThumbnail    │
│ 渲染图片          │
└───────────────────┘
```

### 11.2 RAW 处理流程

```
RAW 文件请求
      │
      ▼
┌─────────────────┐
│ 检查尺寸        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
Tiny/Small  Large
/Medium
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────────────┐
│ 仅提取  │ │ 完整提取链路            │
│ 嵌入    │ │ 1. LibRaw 嵌入预览      │
│ 预览    │ │ 2. EXIF 嵌入 JPEG       │
└────┬────┘ │ 3. 扫描文件查找 JPEG    │
     │      │ 4. RAW 硬解码           │
     │      └───────────┬─────────────┘
     │                  │
     ▼                  ▼
┌─────────┐      ┌─────────┐
│ 成功?   │      │ 成功?   │
└────┬────┘      └────┬────┘
   ┌─┴─┐           ┌──┴──┐
   ▼   ▼           ▼     ▼
  是   否         是    否
   │    │          │     │
   ▼    ▼          ▼     ▼
缩放  生成        缩放  生成
保存  占位图      保存  占位图
      (不缓存)          (不缓存)
```
