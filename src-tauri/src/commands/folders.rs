//! 文件夹视图 Tauri 命令
//!
//! 提供获取文件夹结构、照片统计和按文件夹查询照片的功能

use crate::models::{PaginatedResult, PaginationParams, Photo, PhotoSortOptions, PhotoSortField, SortOrder};
use crate::utils::error::CommandError;
use crate::AppState;
use std::collections::HashMap;
use std::path::Path;
use tauri::State;

/// 文件夹节点信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    /// 文件夹路径
    pub path: String,
    /// 文件夹名称
    pub name: String,
    /// 直接包含的照片数量
    pub photo_count: i64,
    /// 包含子文件夹的总照片数量
    pub total_photo_count: i64,
    /// 子文件夹列表
    pub children: Vec<FolderNode>,
    /// 是否已加载子文件夹
    pub loaded: bool,
}

/// 文件夹统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderStats {
    /// 总文件夹数
    pub total_folders: i64,
    /// 总照片数
    pub total_photos: i64,
    /// 根文件夹列表
    pub root_folders: Vec<FolderNode>,
}

/// 获取所有根文件夹及其统计信息
#[tauri::command]
pub async fn get_folder_tree(state: State<'_, AppState>) -> Result<FolderStats, CommandError> {
    let db = &state.db;
    
    // 获取所有照片的文件夹路径和数量统计
    let folder_counts = db.get_folder_photo_counts().map_err(CommandError::from)?;
    
    // 构建文件夹树
    let root_folders = build_folder_tree(&folder_counts);
    
    let total_folders = count_folders(&root_folders);
    let total_photos: i64 = folder_counts.values().sum();
    
    Ok(FolderStats {
        total_folders,
        total_photos,
        root_folders,
    })
}

/// 获取指定文件夹的子文件夹
#[tauri::command]
pub async fn get_folder_children(
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<Vec<FolderNode>, CommandError> {
    let db = &state.db;
    
    // 获取指定路径下的子文件夹统计
    let folder_counts = db.get_subfolder_photo_counts(&folder_path).map_err(CommandError::from)?;
    
    let mut children: Vec<FolderNode> = folder_counts
        .into_iter()
        .map(|(path, count)| {
            let name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            
            FolderNode {
                path,
                name,
                photo_count: count,
                total_photo_count: count,
                children: vec![],
                loaded: false,
            }
        })
        .collect();
    
    children.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(children)
}

/// 获取指定文件夹中的照片
#[tauri::command]
pub async fn get_photos_by_folder(
    state: State<'_, AppState>,
    folder_path: String,
    include_subfolders: bool,
    pagination: PaginationParams,
    sort: Option<PhotoSortOptions>,
) -> Result<PaginatedResult<Photo>, CommandError> {
    let db = &state.db;
    
    let sort_options = sort.unwrap_or(PhotoSortOptions {
        field: PhotoSortField::DateTaken,
        order: SortOrder::Desc,
    });
    
    let result = db
        .get_photos_by_folder(&folder_path, include_subfolders, &pagination, &sort_options)
        .map_err(CommandError::from)?;
    
    Ok(result)
}

/// 获取文件夹路径的照片数量
#[tauri::command]
pub async fn get_folder_photo_count(
    state: State<'_, AppState>,
    folder_path: String,
    include_subfolders: bool,
) -> Result<i64, CommandError> {
    let db = &state.db;
    
    let count = db
        .get_folder_photo_count(&folder_path, include_subfolders)
        .map_err(CommandError::from)?;
    
    Ok(count)
}

// ============ 辅助函数 ============

/// 构建文件夹树结构
fn build_folder_tree(folder_counts: &HashMap<String, i64>) -> Vec<FolderNode> {
    let mut root_paths: HashMap<String, i64> = HashMap::new();
    
    // 找出所有唯一的根路径（驱动器盘符或第一级目录）
    for (path, count) in folder_counts {
        if let Some(root) = get_root_path(path) {
            *root_paths.entry(root).or_insert(0) += count;
        }
    }
    
    // 为每个根路径构建子树
    let mut roots: Vec<FolderNode> = root_paths
        .into_iter()
        .map(|(path, total_count)| {
            let name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());
            
            // 计算直接在根目录下的照片数量
            let direct_count = folder_counts.get(&path).copied().unwrap_or(0);
            
            FolderNode {
                path,
                name,
                photo_count: direct_count,
                total_photo_count: total_count,
                children: vec![],
                loaded: false,
            }
        })
        .collect();
    
    roots.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    roots
}

/// 获取路径的根目录
fn get_root_path(path: &str) -> Option<String> {
    let path = Path::new(path);
    
    // Windows 路径处理
    if cfg!(windows) {
        // 获取第一级目录（例如 C:\Users\xxx\Pictures 中的 C:\Users\xxx\Pictures 或更浅的路径）
        let components: Vec<_> = path.components().collect();
        if components.len() >= 2 {
            // 返回第一级有效的文件夹路径（通常是扫描添加的根目录）
            let mut root = std::path::PathBuf::new();
            for (i, comp) in components.iter().enumerate() {
                root.push(comp);
                // 返回前3级目录作为根（如 C:\Users\xxx）
                if i >= 2 {
                    break;
                }
            }
            return Some(root.to_string_lossy().to_string());
        }
    }
    
    // Unix 路径处理
    let components: Vec<_> = path.components().collect();
    if components.len() >= 2 {
        let mut root = std::path::PathBuf::new();
        for (i, comp) in components.iter().enumerate() {
            root.push(comp);
            if i >= 2 {
                break;
            }
        }
        return Some(root.to_string_lossy().to_string());
    }
    
    Some(path.to_string_lossy().to_string())
}

/// 递归统计文件夹数量
fn count_folders(folders: &[FolderNode]) -> i64 {
    let mut count = folders.len() as i64;
    for folder in folders {
        count += count_folders(&folder.children);
    }
    count
}
