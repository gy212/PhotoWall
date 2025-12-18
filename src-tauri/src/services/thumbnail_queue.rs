//! 缩略图优先级队列

use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::services::{ThumbnailService, ThumbnailSize};
use crate::utils::error::AppResult;

/// 缩略图生成完成事件的 payload
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailReadyPayload {
    pub file_hash: String,
    pub size: String,
    pub path: String,
}

/// 全局 AppHandle 存储（用于 worker 线程发送事件）
static APP_HANDLE: RwLock<Option<AppHandle>> = RwLock::new(None);

/// 设置全局 AppHandle（在应用启动时调用）
pub fn set_app_handle(handle: AppHandle) {
    if let Ok(mut guard) = APP_HANDLE.write() {
        *guard = Some(handle);
    }
}

/// 发送 thumbnail-ready 事件
fn emit_thumbnail_ready(file_hash: &str, size: ThumbnailSize, path: &str) {
    if let Ok(guard) = APP_HANDLE.read() {
        if let Some(ref handle) = *guard {
            let payload = ThumbnailReadyPayload {
                file_hash: file_hash.to_string(),
                size: size.name().to_string(),
                path: path.to_string(),
            };
            let _ = handle.emit("thumbnail-ready", payload);
        }
    }
}

#[derive(Debug, Clone)]
pub struct ThumbnailTask {
    pub source_path: PathBuf,
    pub file_hash: String,
    pub size: ThumbnailSize,
    /// 数字越大优先级越高
    pub priority: i32,
    /// 简单的序号用于稳定排序（先进先出）
    pub(crate) seq: u64,
}

impl ThumbnailTask {
    /// 创建新的缩略图任务（seq 将由队列自动设置）
    pub fn new(
        source_path: PathBuf,
        file_hash: String,
        size: ThumbnailSize,
        priority: i32,
    ) -> Self {
        Self {
            source_path,
            file_hash,
            size,
            priority,
            seq: 0,
        }
    }
}

impl PartialEq for ThumbnailTask {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority && self.seq == other.seq
    }
}

impl Eq for ThumbnailTask {}

impl PartialOrd for ThumbnailTask {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ThumbnailTask {
    fn cmp(&self, other: &Self) -> Ordering {
        // 优先级高的先出，其次按序号小的先出
        self.priority.cmp(&other.priority).then(self.seq.cmp(&other.seq)).reverse()
    }
}

/// 队列内部共享状态
struct Inner {
    heap: BinaryHeap<ThumbnailTask>,
    seq: u64,
    /// 被取消的 file_hash 集合
    cancelled: HashSet<String>,
    /// 停止标志
    stopped: bool,
}

/// 缩略图优先级队列服务（多工作线程并行处理）
pub struct ThumbnailQueue {
    service: ThumbnailService,
    inner: Arc<(Mutex<Inner>, Condvar)>,
    /// 工作线程数量
    worker_count: usize,
}

impl ThumbnailQueue {
    /// 默认工作线程数（根据 CPU 核心数自动调整）
    const DEFAULT_WORKER_COUNT: usize = 4;

    pub fn new(service: ThumbnailService) -> AppResult<Self> {
        Self::with_worker_count(service, Self::DEFAULT_WORKER_COUNT)
    }

    pub fn with_worker_count(service: ThumbnailService, worker_count: usize) -> AppResult<Self> {
        let count = worker_count.max(1).min(8); // 限制 1-8 个线程
        let inner = Inner {
            heap: BinaryHeap::new(),
            seq: 0,
            cancelled: HashSet::new(),
            stopped: false,
        };
        let queue = Self {
            service,
            inner: Arc::new((Mutex::new(inner), Condvar::new())),
            worker_count: count,
        };

        // 启动多个后台工作线程
        for i in 0..count {
            queue.spawn_worker(i);
        }
        Ok(queue)
    }

    fn spawn_worker(&self, worker_id: usize) {
        let inner = self.inner.clone();
        let service = self.service.clone();
        thread::spawn(move || {
            tracing::debug!("Thumbnail worker {} started", worker_id);
            loop {
                // 取任务
                let task_opt = {
                    let (lock, cvar) = &*inner;
                    let mut state = lock.lock().unwrap();
                    // 等待直到有任务或停止
                    while state.heap.is_empty() && !state.stopped {
                        state = cvar.wait(state).unwrap();
                    }
                    if state.stopped {
                        return;
                    }
                    state.heap.pop()
                };

                if let Some(task) = task_opt {
                    // 取消检查
                    {
                        let (lock, _) = &*inner;
                        let state = lock.lock().unwrap();
                        if state.cancelled.contains(&task.file_hash) {
                            tracing::debug!("跳过已取消任务: {}", task.file_hash);
                            continue;
                        }
                    }

                    // 执行
                    match service.get_or_generate(&task.source_path, &task.file_hash, task.size) {
                        Ok(result) => {
                            // 发送 thumbnail-ready 事件
                            emit_thumbnail_ready(
                                &task.file_hash,
                                task.size,
                                &result.path.to_string_lossy(),
                            );
                        }
                        Err(e) => {
                            tracing::warn!("缩略图任务失败: {} -> {}", task.source_path.display(), e);
                        }
                    }
                }
            }
        });
    }

    /// 入队
    pub fn enqueue(&self, mut task: ThumbnailTask) {
        let (lock, cvar) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.seq += 1;
        task.seq = state.seq;
        state.heap.push(task);
        cvar.notify_one();
    }

    /// 批量入队
    pub fn enqueue_batch(&self, tasks: Vec<ThumbnailTask>) {
        for t in tasks {
            self.enqueue(t);
        }
    }

    /// 按 file_hash 取消后续任务
    pub fn cancel_by_hash(&self, file_hash: &str) {
        let (lock, _) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.cancelled.insert(file_hash.to_string());
    }

    /// 清空取消列表（可选）
    pub fn clear_cancellations(&self) {
        let (lock, _) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.cancelled.clear();
    }

    /// 获取当前队列长度
    pub fn len(&self) -> usize {
        let (lock, _) = &*self.inner;
        let state = lock.lock().unwrap();
        state.heap.len()
    }

    /// 停止工作线程
    pub fn stop(&self) {
        let (lock, cvar) = &*self.inner;
        let mut state = lock.lock().unwrap();
        state.stopped = true;
        cvar.notify_all();
    }
}

impl Drop for ThumbnailQueue {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Clone for ThumbnailQueue {
    fn clone(&self) -> Self {
        Self {
            service: self.service.clone(),
            inner: self.inner.clone(),
            worker_count: self.worker_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_image(path: &PathBuf) {
        let img = image::DynamicImage::new_rgb8(200, 200);
        img.save(path).unwrap();
    }

    #[test]
    fn test_enqueue_and_process() {
        let tmp = TempDir::new().unwrap();
        let cache_dir = tmp.path().join("cache");
        let src = tmp.path().join("a.jpg");
        create_test_image(&src);

        let service = ThumbnailService::new(cache_dir).unwrap();
        let queue = ThumbnailQueue::new(service).unwrap();
        queue.enqueue(ThumbnailTask {
            source_path: src.clone(),
            file_hash: "hash1".into(),
            size: ThumbnailSize::Small,
            priority: 10,
            seq: 0,
        });

        // 简单等待处理
        std::thread::sleep(std::time::Duration::from_millis(300));

        assert!(queue.service.is_cached("hash1", ThumbnailSize::Small));
    }
}
