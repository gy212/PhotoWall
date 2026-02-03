//! 自动扫描服务
//!
//! 实现混合方案：实时监控 (FileWatcher) + 定时扫描 (Scheduler) + 阶梯式扫描频率
//!
//! Note: This module requires the `tokio-runtime` feature to be enabled for full async functionality.

#[cfg(feature = "tokio-runtime")]
use std::collections::HashSet;
use std::collections::HashMap;
use std::path::Path;
#[cfg(feature = "tokio-runtime")]
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
#[cfg(feature = "tokio-runtime")]
use std::time::Duration;

use std::sync::Mutex;

use crate::db::Database;
#[cfg(feature = "tokio-runtime")]
use crate::events::EventSinkExt;
use crate::events::SharedEventSink;
use crate::models::AppSettings;
use crate::services::indexer::IndexOptions;
#[cfg(feature = "tokio-runtime")]
use crate::services::indexer::PhotoIndexer;
use crate::services::scanner::ScanOptions;
#[cfg(feature = "tokio-runtime")]
use crate::services::scanner::Scanner;
#[cfg(feature = "tokio-runtime")]
use crate::services::watcher::{FileChangeEvent, FileChangeType};
use crate::services::watcher::FileWatcher;
use crate::utils::error::{AppError, AppResult};

/// 阶梯式扫描配置
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepScanConfig {
    /// 基础扫描间隔（秒）
    pub base_interval_secs: u64,
    /// 最大倍率
    pub max_multiplier: i32,
}

impl Default for StepScanConfig {
    fn default() -> Self {
        Self {
            base_interval_secs: 300, // 5分钟
            max_multiplier: 8,
        }
    }
}

/// 自动扫描状态
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoScanStatus {
    pub running: bool,
    pub scanning: bool,
    pub watched_paths: Vec<String>,
    pub realtime_watch: bool,
    pub active_watch_paths: Vec<String>,
}

/// 扫描事件 payload
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStartedPayload {
    pub dir_path: String,
    pub scan_type: String, // "realtime" | "scheduled" | "manual"
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompletedPayload {
    pub dir_path: String,
    pub indexed: usize,
    pub skipped: usize,
    pub has_changes: bool,
    pub new_multiplier: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangedPayload {
    pub path: String,
    pub change_type: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeIndexedPayload {
    pub path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyChangedPayload {
    pub dir_path: String,
    pub old_multiplier: i32,
    pub new_multiplier: i32,
}

/// 内部扫描事件
#[cfg(feature = "tokio-runtime")]
enum ScanEvent {
    FileChanged(FileChangeEvent),
    ScheduledScan(String),
}

#[cfg(feature = "tokio-runtime")]
#[derive(Debug, Clone)]
struct RealtimeJob {
    dir_path: String,
    file_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AutoScanRuntimeConfig {
    watched_folders: Vec<String>,
    step_config: StepScanConfig,
    index_options: IndexOptions,
    realtime_watch: bool,
}

/// 自动扫描管理器
#[allow(dead_code)]
pub struct AutoScanManager {
    db: Arc<Database>,
    config: StepScanConfig,
    watchers: Arc<Mutex<HashMap<String, FileWatcher>>>,
    running: Arc<AtomicBool>,
    scanning: Arc<AtomicBool>,
    watched_folders: Vec<String>,
    realtime_watch: bool,
    index_options: IndexOptions,
    event_sink: Option<SharedEventSink>,
    runtime_config: Option<AutoScanRuntimeConfig>,
    generation: Arc<AtomicU64>,
    #[cfg(feature = "tokio-runtime")]
    event_tx: tokio::sync::mpsc::Sender<ScanEvent>,
    #[cfg(feature = "tokio-runtime")]
    stop_tx: Option<tokio::sync::mpsc::Sender<()>>,
    #[cfg(feature = "tokio-runtime")]
    event_loop_handle: Option<tokio::task::JoinHandle<()>>,
    #[cfg(feature = "tokio-runtime")]
    scheduler_handle: Option<tokio::task::JoinHandle<()>>,
    #[cfg(feature = "tokio-runtime")]
    realtime_tx: Option<tokio::sync::mpsc::Sender<RealtimeJob>>,
    #[cfg(feature = "tokio-runtime")]
    realtime_handle: Option<tokio::task::JoinHandle<()>>,
}

impl AutoScanManager {
    /// 创建新的自动扫描管理器
    #[cfg(feature = "tokio-runtime")]
    pub fn new(db: Arc<Database>, config: StepScanConfig) -> Self {
        let (event_tx, _) = tokio::sync::mpsc::channel(100);
        Self {
            db,
            config,
            watchers: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(false)),
            scanning: Arc::new(AtomicBool::new(false)),
            event_tx,
            stop_tx: None,
            watched_folders: Vec::new(),
            realtime_watch: true,
            index_options: IndexOptions::default(),
            event_sink: None,
            runtime_config: None,
            event_loop_handle: None,
            scheduler_handle: None,
            realtime_tx: None,
            realtime_handle: None,
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    /// 创建新的自动扫描管理器 (无 tokio)
    #[cfg(not(feature = "tokio-runtime"))]
    pub fn new(db: Arc<Database>, config: StepScanConfig) -> Self {
        Self {
            db,
            config,
            watchers: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(false)),
            scanning: Arc::new(AtomicBool::new(false)),
            watched_folders: Vec::new(),
            realtime_watch: true,
            index_options: IndexOptions::default(),
            event_sink: None,
            runtime_config: None,
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    /// 使用默认配置创建
    pub fn with_defaults(db: Arc<Database>) -> Self {
        Self::new(db, StepScanConfig::default())
    }

    /// 设置事件发送器
    pub fn set_event_sink(&mut self, sink: SharedEventSink) {
        self.event_sink = Some(sink);
    }

    #[allow(dead_code)]
    fn normalize_watched_folders(mut watched_folders: Vec<String>) -> Vec<String> {
        watched_folders.sort();
        watched_folders.dedup();
        watched_folders
    }

    #[allow(dead_code)]
    fn runtime_config_from_settings(settings: &AppSettings) -> AutoScanRuntimeConfig {
        let mut step_config = StepScanConfig::default();
        step_config.base_interval_secs = settings.scan.scan_interval.max(60);

        let mut scan_options = ScanOptions::new();
        scan_options.recursive = settings.scan.recursive;
        if !settings.scan.excluded_patterns.is_empty() {
            scan_options.exclude_dirs = settings.scan.excluded_patterns.clone();
        }

        let mut index_options = IndexOptions::default();
        index_options.scan_options = scan_options;

        AutoScanRuntimeConfig {
            watched_folders: Self::normalize_watched_folders(settings.scan.watched_folders.clone()),
            step_config,
            index_options,
            realtime_watch: settings.scan.realtime_watch,
        }
    }

    #[cfg(feature = "tokio-runtime")]
    fn spawn_realtime_worker(
        db: Arc<Database>,
        scanning: Arc<AtomicBool>,
        running: Arc<AtomicBool>,
        generation_shared: Arc<AtomicU64>,
        generation: u64,
        index_options: IndexOptions,
        event_sink: Option<SharedEventSink>,
        mut rx: tokio::sync::mpsc::Receiver<RealtimeJob>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut pending: HashSet<String> = HashSet::new();

            while let Some(job) = rx.recv().await {
                if !running.load(Ordering::SeqCst) || generation_shared.load(Ordering::SeqCst) != generation {
                    break;
                }

                let key = job.file_path.display().to_string();
                if pending.contains(&key) {
                    continue;
                }
                pending.insert(key.clone());

                tokio::time::sleep(Duration::from_millis(800)).await;

                if !running.load(Ordering::SeqCst) || generation_shared.load(Ordering::SeqCst) != generation {
                    pending.remove(&key);
                    break;
                }

                // Wait for the scan lock (avoid overlap with scheduled scans).
                loop {
                    if !running.load(Ordering::SeqCst) || generation_shared.load(Ordering::SeqCst) != generation {
                        pending.remove(&key);
                        return;
                    }
                    if !scanning.swap(true, Ordering::SeqCst) {
                        break;
                    }
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }

                // Index in a blocking task (DB + image parsing).
                let mut indexed_any = false;
                for attempt in 0..3 {
                    if !running.load(Ordering::SeqCst) || generation_shared.load(Ordering::SeqCst) != generation {
                        break;
                    }

                    let db_for_task = db.clone();
                    let index_options_for_task = index_options.clone();
                    let file_path_for_task = job.file_path.clone();

                    let result = tokio::task::spawn_blocking(move || {
                        let indexer = PhotoIndexer::new(db_for_task, index_options_for_task);
                        indexer.index_single_file(file_path_for_task.as_path())
                    })
                    .await;

                    match result {
                        Ok(Ok(indexed)) => {
                            indexed_any = indexed;
                            break;
                        }
                        Ok(Err(_e)) => {
                            tokio::time::sleep(Duration::from_millis(400 * (attempt + 1) as u64)).await;
                        }
                        Err(_e) => break,
                    }
                }

                if indexed_any
                    && running.load(Ordering::SeqCst)
                    && generation_shared.load(Ordering::SeqCst) == generation
                {
                    let _ = db.reset_scan_frequency(&job.dir_path);
                    if let Some(ref sink) = event_sink {
                        sink.emit_typed(
                            "auto-scan:realtime-indexed",
                            &RealtimeIndexedPayload { path: key.clone() },
                        );
                    }
                }

                scanning.store(false, Ordering::SeqCst);
                pending.remove(&key);
            }
        })
    }

    /// 应用设置（异步版本）
    #[cfg(feature = "tokio-runtime")]
    pub async fn apply_settings(&mut self, settings: &AppSettings) -> AppResult<()> {
        let desired_enabled = settings.scan.auto_scan && !settings.scan.watched_folders.is_empty();
        if !desired_enabled {
            if let Some(cfg) = &self.runtime_config {
                for dir_path in &cfg.watched_folders {
                    let _ = self.db.deactivate_scan_directory(dir_path);
                }
            }
            self.stop();
            return Ok(());
        }

        let desired_config = Self::runtime_config_from_settings(settings);
        if self.running.load(Ordering::SeqCst) && self.runtime_config.as_ref() == Some(&desired_config) {
            return Ok(());
        }

        self.stop();
        self.start(
            desired_config.watched_folders,
            desired_config.step_config,
            desired_config.index_options,
            desired_config.realtime_watch,
        )
        .await
    }

    /// 启动自动扫描服务
    #[cfg(feature = "tokio-runtime")]
    pub async fn start(
        &mut self,
        watched_folders: Vec<String>,
        config: StepScanConfig,
        index_options: IndexOptions,
        realtime_watch: bool,
    ) -> AppResult<()> {
        if self.running.load(Ordering::SeqCst) {
            tracing::warn!("自动扫描服务已在运行");
            return Ok(());
        }

        tracing::info!("启动自动扫描服务，监控 {} 个文件夹", watched_folders.len());

        let watched_folders = Self::normalize_watched_folders(watched_folders);

        self.config = config.clone();
        self.index_options = index_options.clone();
        self.realtime_watch = realtime_watch;
        self.watched_folders = watched_folders.clone();
        self.runtime_config = Some(AutoScanRuntimeConfig {
            watched_folders: watched_folders.clone(),
            step_config: config.clone(),
            index_options: index_options.clone(),
            realtime_watch,
        });

        self.running.store(true, Ordering::SeqCst);
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;

        // 创建新的事件通道
        let (event_tx, event_rx) = tokio::sync::mpsc::channel::<ScanEvent>(100);
        let (stop_tx, stop_rx) = tokio::sync::mpsc::channel::<()>(1);
        self.event_tx = event_tx.clone();
        self.stop_tx = Some(stop_tx);

        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.clear();
        }

        self.sync_active_scan_directories(&watched_folders)?;

        // Realtime indexing worker (bounded + dedup).
        let (realtime_tx, realtime_rx) = tokio::sync::mpsc::channel::<RealtimeJob>(256);
        self.realtime_tx = Some(realtime_tx);
        let realtime_handle = Self::spawn_realtime_worker(
            self.db.clone(),
            self.scanning.clone(),
            self.running.clone(),
            self.generation.clone(),
            generation,
            self.index_options.clone(),
            self.event_sink.clone(),
            realtime_rx,
        );
        self.realtime_handle = Some(realtime_handle);

        // 启动文件监控
        if realtime_watch {
            for folder in &watched_folders {
                if let Err(e) = self.add_watch_path_internal(folder, event_tx.clone()) {
                    tracing::error!("无法监控文件夹 {}: {}", folder, e);
                }
            }
        }

        // 初始化扫描目录状态
        for folder in &watched_folders {
            self.init_scan_directory(folder)?;
        }

        // 启动事件处理循环
        let db = self.db.clone();
        let config = self.config.clone();
        let index_options = self.index_options.clone();
        let running = self.running.clone();
        let scanning = self.scanning.clone();
        let event_sink = self.event_sink.clone();
        let realtime_tx = self.realtime_tx.clone();
        let generation_shared = self.generation.clone();
        let generation_for_loop = generation;

        self.event_loop_handle = Some(tokio::spawn(async move {
            Self::event_loop(
                event_rx,
                stop_rx,
                db,
                config,
                index_options,
                realtime_tx,
                generation_shared,
                generation_for_loop,
                running,
                scanning,
                event_sink,
            )
            .await;
        }));

        // 启动定时扫描调度器
        let db = self.db.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        let event_tx_clone = self.event_tx.clone();

        self.scheduler_handle = Some(tokio::spawn(async move {
            Self::scheduler_loop(db, config, running, event_tx_clone).await;
        }));

        Ok(())
    }

    /// 停止自动扫描服务
    #[cfg(feature = "tokio-runtime")]
    pub fn stop(&mut self) {
        if !self.running.load(Ordering::SeqCst) {
            self.scanning.store(false, Ordering::SeqCst);
            if let Some(handle) = self.event_loop_handle.take() {
                handle.abort();
            }
            if let Some(handle) = self.scheduler_handle.take() {
                handle.abort();
            }
            if let Some(handle) = self.realtime_handle.take() {
                handle.abort();
            }
            self.realtime_tx = None;
            self.runtime_config = None;
            self.watched_folders.clear();
            if let Ok(mut watchers) = self.watchers.lock() {
                watchers.clear();
            }
            return;
        }

        tracing::info!("停止自动扫描服务");
        self.running.store(false, Ordering::SeqCst);
        self.scanning.store(false, Ordering::SeqCst);
        self.generation.fetch_add(1, Ordering::SeqCst);

        // 发送停止信号
        if let Some(stop_tx) = self.stop_tx.take() {
            let _ = stop_tx.try_send(());
        }

        // 停止所有文件监控
        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.clear();
        }

        if let Some(handle) = self.event_loop_handle.take() {
            handle.abort();
        }
        if let Some(handle) = self.scheduler_handle.take() {
            handle.abort();
        }
        if let Some(handle) = self.realtime_handle.take() {
            handle.abort();
        }
        self.realtime_tx = None;

        self.runtime_config = None;
        self.watched_folders.clear();
    }

    /// 停止自动扫描服务 (无 tokio)
    #[cfg(not(feature = "tokio-runtime"))]
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        self.scanning.store(false, Ordering::SeqCst);
        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.clear();
        }
        self.runtime_config = None;
        self.watched_folders.clear();
    }

    /// 添加监控路径
    #[cfg(feature = "tokio-runtime")]
    pub fn add_watch_path(&mut self, path: &str) -> AppResult<()> {
        self.add_watch_path_internal(path, self.event_tx.clone())
    }

    /// 内部添加监控路径
    #[cfg(feature = "tokio-runtime")]
    fn add_watch_path_internal(
        &self,
        path: &str,
        event_tx: tokio::sync::mpsc::Sender<ScanEvent>,
    ) -> AppResult<()> {
        let path_buf = PathBuf::from(path);
        if !path_buf.exists() {
            tracing::warn!("监控路径不存在: {}", path);
            return Ok(());
        }

        let mut watchers = self.watchers.lock().map_err(|e| {
            AppError::General(format!("锁获取失败: {}", e))
        })?;
        if watchers.contains_key(path) {
            return Ok(());
        }

        let mut watcher = FileWatcher::with_defaults();
        let event_tx_clone = event_tx.clone();

        watcher.watch(&path_buf, move |event| {
            let _ = event_tx_clone.blocking_send(ScanEvent::FileChanged(event));
        })?;

        watchers.insert(path.to_string(), watcher);
        tracing::info!("已添加文件监控: {}", path);

        Ok(())
    }

    /// 移除监控路径
    pub fn remove_watch_path(&mut self, path: &str) -> AppResult<()> {
        let mut watchers = self.watchers.lock().map_err(|e| {
            AppError::General(format!("锁获取失败: {}", e))
        })?;
        if let Some(mut watcher) = watchers.remove(path) {
            watcher.unwatch(Path::new(path))?;
            tracing::info!("已移除文件监控: {}", path);
        }
        Ok(())
    }

    /// 获取状态
    pub fn status(&self) -> AutoScanStatus {
        let watched_paths = self.watched_folders.clone();
        let active_watch_paths = self
            .watchers
            .lock()
            .map(|w| w.keys().cloned().collect())
            .unwrap_or_default();
        AutoScanStatus {
            running: self.running.load(Ordering::SeqCst),
            scanning: self.scanning.load(Ordering::SeqCst),
            watched_paths,
            realtime_watch: self.realtime_watch,
            active_watch_paths,
        }
    }

    /// 检查是否正在运行
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// 检查是否正在扫描
    pub fn is_scanning(&self) -> bool {
        self.scanning.load(Ordering::SeqCst)
    }

    /// 手动触发扫描
    #[cfg(feature = "tokio-runtime")]
    pub async fn trigger_scan(&self, dir_path: &str) -> AppResult<()> {
        let _ = self
            .event_tx
            .send(ScanEvent::ScheduledScan(dir_path.to_string()))
            .await;
        Ok(())
    }

    #[cfg(feature = "tokio-runtime")]
    fn sync_active_scan_directories(&self, watched_folders: &[String]) -> AppResult<()> {
        let watched: HashSet<&str> = watched_folders.iter().map(|p| p.as_str()).collect();

        // Deactivate directories no longer watched.
        for dir in self.db.get_all_scan_directories()? {
            if !watched.contains(dir.dir_path.as_str()) {
                let _ = self.db.deactivate_scan_directory(&dir.dir_path);
            }
        }

        // Ensure watched directories are active and scheduled.
        for dir_path in watched_folders {
            let existing = self.db.get_scan_directory(dir_path)?;
            let needs_schedule = existing
                .as_ref()
                .map(|s| !s.is_active || s.next_scan_time.is_none())
                .unwrap_or(true);
            let file_count = existing.as_ref().map(|s| s.file_count).unwrap_or(0);

            self.db.upsert_scan_directory(dir_path, file_count)?;

            if needs_schedule {
                let next_scan = chrono::Utc::now()
                    + chrono::Duration::seconds(self.config.base_interval_secs as i64);
                let _ = self
                    .db
                    .set_next_scan_time(dir_path, &next_scan.to_rfc3339())?;
            }
        }

        Ok(())
    }

    /// 初始化扫描目录状态
    #[cfg(feature = "tokio-runtime")]
    fn init_scan_directory(&self, dir_path: &str) -> AppResult<()> {
        // 检查是否已存在
        if self.db.get_scan_directory(dir_path)?.is_some() {
            return Ok(());
        }

        // 计算初始文件数
        let scanner = Scanner::with_defaults();
        let scan_result = scanner.scan_directory(Path::new(dir_path))?;
        let file_count = scan_result.files.len() as i64;

        // 插入记录
        self.db.upsert_scan_directory(dir_path, file_count)?;

        // 设置下次扫描时间
        let next_scan = chrono::Utc::now()
            + chrono::Duration::seconds(self.config.base_interval_secs as i64);
        self.db
            .set_next_scan_time(dir_path, &next_scan.to_rfc3339())?;

        Ok(())
    }

    /// 事件处理循环
    #[cfg(feature = "tokio-runtime")]
    async fn event_loop(
        mut event_rx: tokio::sync::mpsc::Receiver<ScanEvent>,
        mut stop_rx: tokio::sync::mpsc::Receiver<()>,
        db: Arc<Database>,
        config: StepScanConfig,
        index_options: IndexOptions,
        realtime_tx: Option<tokio::sync::mpsc::Sender<RealtimeJob>>,
        generation_shared: Arc<AtomicU64>,
        generation: u64,
        running: Arc<AtomicBool>,
        scanning: Arc<AtomicBool>,
        event_sink: Option<SharedEventSink>,
    ) {
        tracing::info!("自动扫描事件循环已启动");

        loop {
            tokio::select! {
                _ = stop_rx.recv() => {
                    tracing::info!("收到停止信号，退出事件循环");
                    break;
                }
                Some(event) = event_rx.recv() => {
                    if !running.load(Ordering::SeqCst) {
                        break;
                    }

                    match event {
                        ScanEvent::FileChanged(change_event) => {
                            Self::handle_file_change(
                                &db,
                                &config,
                                &index_options,
                                realtime_tx.as_ref(),
                                &generation_shared,
                                generation,
                                &running,
                                &scanning,
                                &event_sink,
                                change_event,
                            )
                            .await;
                        }
                        ScanEvent::ScheduledScan(dir_path) => {
                            Self::handle_scheduled_scan(&db, &config, &index_options, &scanning, &event_sink, &dir_path).await;
                        }
                    }
                }
            }
        }

        tracing::info!("自动扫描事件循环已退出");
    }

    /// 定时扫描调度器
    #[cfg(feature = "tokio-runtime")]
    async fn scheduler_loop(
        db: Arc<Database>,
        _config: StepScanConfig,
        running: Arc<AtomicBool>,
        event_tx: tokio::sync::mpsc::Sender<ScanEvent>,
    ) {
        tracing::info!("定时扫描调度器已启动");

        // 每分钟检查一次是否有需要扫描的目录
        let mut interval = tokio::time::interval(Duration::from_secs(60));

        loop {
            interval.tick().await;

            if !running.load(Ordering::SeqCst) {
                break;
            }

            // 获取需要扫描的目录
            match db.get_directories_due_for_scan() {
                Ok(dirs) => {
                    for dir in dirs {
                        tracing::debug!("调度扫描: {}", dir.dir_path);
                        let _ = event_tx
                            .send(ScanEvent::ScheduledScan(dir.dir_path))
                            .await;
                    }
                }
                Err(e) => {
                    tracing::error!("获取待扫描目录失败: {}", e);
                }
            }
        }

        tracing::info!("定时扫描调度器已退出");
    }

    /// 处理文件变化事件
    #[cfg(feature = "tokio-runtime")]
    async fn handle_file_change(
        db: &Arc<Database>,
        _config: &StepScanConfig,
        index_options: &IndexOptions,
        realtime_tx: Option<&tokio::sync::mpsc::Sender<RealtimeJob>>,
        generation_shared: &Arc<AtomicU64>,
        generation: u64,
        running: &Arc<AtomicBool>,
        scanning: &Arc<AtomicBool>,
        event_sink: &Option<SharedEventSink>,
        event: FileChangeEvent,
    ) {
        let path_str = event.path.display().to_string();
        let change_type_str = match event.change_type {
            FileChangeType::Created => "created",
            FileChangeType::Modified => "modified",
            FileChangeType::Removed => "removed",
        };

        tracing::info!("文件变化: {} ({})", path_str, change_type_str);

        // 发送文件变化事件
        if let Some(ref sink) = event_sink {
            sink.emit_typed(
                "auto-scan:file-changed",
                &FileChangedPayload {
                    path: path_str.clone(),
                    change_type: change_type_str.to_string(),
                },
            );
        }

        // 找到对应的监控目录
        let dir_path = match event.path.parent() {
            Some(p) => {
                // 向上查找监控的根目录
                let mut current = p;
                loop {
                    if let Ok(Some(_)) = db.get_scan_directory(&current.display().to_string()) {
                        break current.display().to_string();
                    }
                    match current.parent() {
                        Some(parent) => current = parent,
                        None => break p.display().to_string(),
                    }
                }
            }
            None => return,
        };

        // 根据变化类型处理
        match event.change_type {
            FileChangeType::Created | FileChangeType::Modified => {
                // Best-effort realtime indexing (bounded + dedup) with cancellation checks.
                if let Some(tx) = realtime_tx {
                    if running.load(Ordering::SeqCst) && generation_shared.load(Ordering::SeqCst) == generation {
                        let job = RealtimeJob {
                            dir_path: dir_path.clone(),
                            file_path: event.path.clone(),
                        };
                        if tx.try_send(job).is_err() {
                            tracing::debug!("实时索引队列已满，跳过: {}", path_str);
                        }
                    }
                } else {
                    // Fallback: if no realtime worker, do a direct index (blocking).
                    if scanning.swap(true, Ordering::SeqCst) {
                        return;
                    }
                    let db_for_task = db.clone();
                    let index_options_for_task = index_options.clone();
                    let file_path_for_task = event.path.clone();
                    let dir_path_for_task = dir_path.clone();
                    let _ = tokio::task::spawn_blocking(move || {
                        let indexer = PhotoIndexer::new(db_for_task.clone(), index_options_for_task);
                        if indexer.index_single_file(file_path_for_task.as_path()).unwrap_or(false) {
                            let _ = db_for_task.reset_scan_frequency(&dir_path_for_task);
                        }
                    })
                    .await;
                    scanning.store(false, Ordering::SeqCst);
                }
            }
            FileChangeType::Removed => {
                // 标记文件为已删除
                if let Err(e) = db.soft_delete_photo_by_path(&path_str) {
                    tracing::error!("标记删除失败 {}: {}", path_str, e);
                } else if let Some(ref sink) = event_sink {
                    sink.emit_typed(
                        "auto-scan:realtime-deleted",
                        &RealtimeIndexedPayload { path: path_str.clone() },
                    );
                }
            }
        }
    }

    /// 处理定时扫描
    #[cfg(feature = "tokio-runtime")]
    async fn handle_scheduled_scan(
        db: &Arc<Database>,
        config: &StepScanConfig,
        index_options: &IndexOptions,
        scanning: &Arc<AtomicBool>,
        event_sink: &Option<SharedEventSink>,
        dir_path: &str,
    ) {
        // 检查是否已有扫描在进行
        if scanning.swap(true, Ordering::SeqCst) {
            tracing::debug!("已有扫描在进行，跳过: {}", dir_path);
            return;
        }

        tracing::info!("开始定时扫描: {}", dir_path);

        // 发送扫描开始事件
        if let Some(ref sink) = event_sink {
            sink.emit_typed(
                "auto-scan:started",
                &ScanStartedPayload {
                    dir_path: dir_path.to_string(),
                    scan_type: "scheduled".to_string(),
                },
            );
        }

        // 获取之前的状态
        let old_state = db.get_scan_directory(dir_path).ok().flatten();
        let old_file_count = old_state.as_ref().map(|s| s.file_count).unwrap_or(0);
        let old_multiplier = old_state.as_ref().map(|s| s.scan_multiplier).unwrap_or(1);

        // 执行扫描
        let indexer = PhotoIndexer::new(db.clone(), index_options.clone());
        let result = indexer.index_directory(Path::new(dir_path));

        let (indexed, skipped, new_file_count) = match result {
            Ok(r) => (r.indexed, r.skipped, (r.indexed + r.skipped) as i64),
            Err(e) => {
                tracing::error!("扫描失败 {}: {}", dir_path, e);
                scanning.store(false, Ordering::SeqCst);
                return;
            }
        };

        // 判断是否有变化
        let has_changes = indexed > 0 || new_file_count != old_file_count;

        // 更新扫描状态
        let new_multiplier = db
            .update_scan_result(dir_path, has_changes, new_file_count, config.base_interval_secs)
            .unwrap_or(1);

        // 发送扫描完成事件
        if let Some(ref sink) = event_sink {
            sink.emit_typed(
                "auto-scan:completed",
                &ScanCompletedPayload {
                    dir_path: dir_path.to_string(),
                    indexed,
                    skipped,
                    has_changes,
                    new_multiplier,
                },
            );
        }

        // 如果倍率变化，发送频率变化事件
        if new_multiplier != old_multiplier {
            if let Some(ref sink) = event_sink {
                sink.emit_typed(
                    "auto-scan:frequency-changed",
                    &FrequencyChangedPayload {
                        dir_path: dir_path.to_string(),
                        old_multiplier,
                        new_multiplier,
                    },
                );
            }
        }

        tracing::info!(
            "定时扫描完成: {} (indexed={}, has_changes={}, multiplier={})",
            dir_path,
            indexed,
            has_changes,
            new_multiplier
        );

        scanning.store(false, Ordering::SeqCst);
    }
}

impl Drop for AutoScanManager {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_step_scan_config_default() {
        let config = StepScanConfig::default();
        assert_eq!(config.base_interval_secs, 300);
        assert_eq!(config.max_multiplier, 8);
    }

    #[test]
    fn test_auto_scan_manager_creation() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();
        let manager = AutoScanManager::with_defaults(Arc::new(db));
        assert!(!manager.is_running());
        assert!(!manager.is_scanning());
    }

    #[test]
    fn test_auto_scan_status() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();
        let manager = AutoScanManager::with_defaults(Arc::new(db));
        let status = manager.status();
        assert!(!status.running);
        assert!(!status.scanning);
        assert!(status.watched_paths.is_empty());
        assert!(status.realtime_watch);
        assert!(status.active_watch_paths.is_empty());
    }

    #[test]
    fn test_normalize_watched_folders() {
        let folders = vec![
            "C:\\Photos".to_string(),
            "D:\\Images".to_string(),
            "C:\\Photos".to_string(), // duplicate
        ];
        let normalized = AutoScanManager::normalize_watched_folders(folders);
        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0], "C:\\Photos");
        assert_eq!(normalized[1], "D:\\Images");
    }

    #[test]
    fn test_auto_scan_stop_when_not_running() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();
        let mut manager = AutoScanManager::with_defaults(Arc::new(db));
        // Should not panic when stopping a non-running manager
        manager.stop();
        assert!(!manager.is_running());
    }

    #[cfg(feature = "tokio-runtime")]
    #[tokio::test]
    async fn test_auto_scan_start_stop() {
        let db = Database::open_in_memory().unwrap();
        db.init().unwrap();
        let mut manager = AutoScanManager::with_defaults(Arc::new(db));

        // Start with empty folders should still work
        let result = manager
            .start(
                vec![],
                StepScanConfig::default(),
                IndexOptions::default(),
                false,
            )
            .await;
        assert!(result.is_ok());
        assert!(manager.is_running());

        // Stop
        manager.stop();
        assert!(!manager.is_running());
    }

    #[test]
    fn test_runtime_config_from_settings() {
        let mut settings = AppSettings::default();
        settings.scan.watched_folders = vec!["C:\\Photos".to_string()];
        settings.scan.scan_interval = 600;
        settings.scan.recursive = true;
        settings.scan.realtime_watch = false;

        let config = AutoScanManager::runtime_config_from_settings(&settings);
        assert_eq!(config.watched_folders, vec!["C:\\Photos".to_string()]);
        assert_eq!(config.step_config.base_interval_secs, 600);
        assert!(!config.realtime_watch);
    }
}
