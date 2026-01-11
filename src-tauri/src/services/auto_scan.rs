//! 自动扫描服务
//!
//! 实现混合方案：实时监控 (FileWatcher) + 定时扫描 (Scheduler) + 阶梯式扫描频率

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::db::Database;
use crate::services::indexer::{IndexOptions, PhotoIndexer};
use crate::services::scanner::Scanner;
use crate::services::watcher::{FileChangeEvent, FileChangeType, FileWatcher};
use crate::utils::error::AppResult;

/// 阶梯式扫描配置
#[derive(Debug, Clone)]
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
pub struct FrequencyChangedPayload {
    pub dir_path: String,
    pub old_multiplier: i32,
    pub new_multiplier: i32,
}

/// 内部扫描事件
enum ScanEvent {
    FileChanged(FileChangeEvent),
    ScheduledScan(String),
}

/// 自动扫描管理器
pub struct AutoScanManager {
    db: Arc<Database>,
    config: StepScanConfig,
    watchers: Arc<Mutex<HashMap<String, FileWatcher>>>,
    running: Arc<AtomicBool>,
    scanning: Arc<AtomicBool>,
    event_tx: mpsc::Sender<ScanEvent>,
    stop_tx: Option<mpsc::Sender<()>>,
}

impl AutoScanManager {
    /// 创建新的自动扫描管理器
    pub fn new(db: Arc<Database>, config: StepScanConfig) -> Self {
        let (event_tx, _) = mpsc::channel(100);
        Self {
            db,
            config,
            watchers: Arc::new(Mutex::new(HashMap::new())),
            running: Arc::new(AtomicBool::new(false)),
            scanning: Arc::new(AtomicBool::new(false)),
            event_tx,
            stop_tx: None,
        }
    }

    /// 使用默认配置创建
    pub fn with_defaults(db: Arc<Database>) -> Self {
        Self::new(db, StepScanConfig::default())
    }

    /// 启动自动扫描服务
    pub async fn start(&mut self, app: AppHandle, watched_folders: Vec<String>) -> AppResult<()> {
        if self.running.load(Ordering::SeqCst) {
            tracing::warn!("自动扫描服务已在运行");
            return Ok(());
        }

        tracing::info!("启动自动扫描服务，监控 {} 个文件夹", watched_folders.len());

        self.running.store(true, Ordering::SeqCst);

        // 创建新的事件通道
        let (event_tx, event_rx) = mpsc::channel::<ScanEvent>(100);
        let (stop_tx, stop_rx) = mpsc::channel::<()>(1);
        self.event_tx = event_tx.clone();
        self.stop_tx = Some(stop_tx);

        // 启动文件监控
        for folder in &watched_folders {
            if let Err(e) = self.add_watch_path_internal(folder, event_tx.clone()) {
                tracing::error!("无法监控文件夹 {}: {}", folder, e);
            }
        }

        // 初始化扫描目录状态
        for folder in &watched_folders {
            self.init_scan_directory(folder)?;
        }

        // 启动事件处理循环
        let db = self.db.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        let scanning = self.scanning.clone();
        let app_clone = app.clone();

        tokio::spawn(async move {
            Self::event_loop(
                event_rx,
                stop_rx,
                db,
                config,
                running,
                scanning,
                app_clone,
            )
            .await;
        });

        // 启动定时扫描调度器
        let db = self.db.clone();
        let config = self.config.clone();
        let running = self.running.clone();
        let event_tx_clone = self.event_tx.clone();

        tokio::spawn(async move {
            Self::scheduler_loop(db, config, running, event_tx_clone).await;
        });

        Ok(())
    }

    /// 停止自动扫描服务
    pub fn stop(&mut self) {
        if !self.running.load(Ordering::SeqCst) {
            return;
        }

        tracing::info!("停止自动扫描服务");
        self.running.store(false, Ordering::SeqCst);

        // 发送停止信号
        if let Some(stop_tx) = self.stop_tx.take() {
            let _ = stop_tx.try_send(());
        }

        // 停止所有文件监控
        if let Ok(mut watchers) = self.watchers.lock() {
            watchers.clear();
        }
    }

    /// 添加监控路径
    pub fn add_watch_path(&mut self, path: &str) -> AppResult<()> {
        self.add_watch_path_internal(path, self.event_tx.clone())
    }

    /// 内部添加监控路径
    fn add_watch_path_internal(
        &self,
        path: &str,
        event_tx: mpsc::Sender<ScanEvent>,
    ) -> AppResult<()> {
        let path_buf = PathBuf::from(path);
        if !path_buf.exists() {
            tracing::warn!("监控路径不存在: {}", path);
            return Ok(());
        }

        let mut watchers = self.watchers.lock().map_err(|e| {
            crate::utils::error::AppError::General(format!("锁获取失败: {}", e))
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
            crate::utils::error::AppError::General(format!("锁获取失败: {}", e))
        })?;
        if let Some(mut watcher) = watchers.remove(path) {
            watcher.unwatch(Path::new(path))?;
            tracing::info!("已移除文件监控: {}", path);
        }
        Ok(())
    }

    /// 获取状态
    pub fn status(&self) -> AutoScanStatus {
        let watched_paths = self
            .watchers
            .lock()
            .map(|w| w.keys().cloned().collect())
            .unwrap_or_default();
        AutoScanStatus {
            running: self.running.load(Ordering::SeqCst),
            scanning: self.scanning.load(Ordering::SeqCst),
            watched_paths,
        }
    }

    /// 检查是否正在扫描
    pub fn is_scanning(&self) -> bool {
        self.scanning.load(Ordering::SeqCst)
    }

    /// 手动触发扫描
    pub async fn trigger_scan(&self, dir_path: &str) -> AppResult<()> {
        let _ = self
            .event_tx
            .send(ScanEvent::ScheduledScan(dir_path.to_string()))
            .await;
        Ok(())
    }

    /// 初始化扫描目录状态
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
    async fn event_loop(
        mut event_rx: mpsc::Receiver<ScanEvent>,
        mut stop_rx: mpsc::Receiver<()>,
        db: Arc<Database>,
        config: StepScanConfig,
        running: Arc<AtomicBool>,
        scanning: Arc<AtomicBool>,
        app: AppHandle,
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
                            Self::handle_file_change(&db, &config, &scanning, &app, change_event).await;
                        }
                        ScanEvent::ScheduledScan(dir_path) => {
                            Self::handle_scheduled_scan(&db, &config, &scanning, &app, &dir_path).await;
                        }
                    }
                }
            }
        }

        tracing::info!("自动扫描事件循环已退出");
    }

    /// 定时扫描调度器
    async fn scheduler_loop(
        db: Arc<Database>,
        _config: StepScanConfig,
        running: Arc<AtomicBool>,
        event_tx: mpsc::Sender<ScanEvent>,
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
    async fn handle_file_change(
        db: &Arc<Database>,
        _config: &StepScanConfig,
        scanning: &Arc<AtomicBool>,
        app: &AppHandle,
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
        let _ = app.emit(
            "auto-scan:file-changed",
            FileChangedPayload {
                path: path_str.clone(),
                change_type: change_type_str.to_string(),
            },
        );

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
                // 索引单个文件
                if scanning.swap(true, Ordering::SeqCst) {
                    // 已有扫描在进行，跳过
                    return;
                }

                let indexer = PhotoIndexer::new(db.clone(), IndexOptions::default());
                match indexer.index_single_file(&event.path) {
                    Ok(indexed) => {
                        if indexed {
                            tracing::info!("已索引文件: {}", path_str);
                            // 重置该目录的扫描频率
                            let _ = db.reset_scan_frequency(&dir_path);
                        }
                    }
                    Err(e) => {
                        tracing::error!("索引文件失败 {}: {}", path_str, e);
                    }
                }

                scanning.store(false, Ordering::SeqCst);
            }
            FileChangeType::Removed => {
                // 标记文件为已删除
                if let Err(e) = db.soft_delete_photo_by_path(&path_str) {
                    tracing::error!("标记删除失败 {}: {}", path_str, e);
                }
            }
        }
    }

    /// 处理定时扫描
    async fn handle_scheduled_scan(
        db: &Arc<Database>,
        config: &StepScanConfig,
        scanning: &Arc<AtomicBool>,
        app: &AppHandle,
        dir_path: &str,
    ) {
        // 检查是否已有扫描在进行
        if scanning.swap(true, Ordering::SeqCst) {
            tracing::debug!("已有扫描在进行，跳过: {}", dir_path);
            return;
        }

        tracing::info!("开始定时扫描: {}", dir_path);

        // 发送扫描开始事件
        let _ = app.emit(
            "auto-scan:started",
            ScanStartedPayload {
                dir_path: dir_path.to_string(),
                scan_type: "scheduled".to_string(),
            },
        );

        // 获取之前的状态
        let old_state = db.get_scan_directory(dir_path).ok().flatten();
        let old_file_count = old_state.as_ref().map(|s| s.file_count).unwrap_or(0);
        let old_multiplier = old_state.as_ref().map(|s| s.scan_multiplier).unwrap_or(1);

        // 执行扫描
        let indexer = PhotoIndexer::new(db.clone(), IndexOptions::default());
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
        let _ = app.emit(
            "auto-scan:completed",
            ScanCompletedPayload {
                dir_path: dir_path.to_string(),
                indexed,
                skipped,
                has_changes,
                new_multiplier,
            },
        );

        // 如果倍率变化，发送频率变化事件
        if new_multiplier != old_multiplier {
            let _ = app.emit(
                "auto-scan:frequency-changed",
                FrequencyChangedPayload {
                    dir_path: dir_path.to_string(),
                    old_multiplier,
                    new_multiplier,
                },
            );
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
