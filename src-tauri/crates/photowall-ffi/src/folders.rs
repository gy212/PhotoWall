//! Folder API.

use crate::error::{clear_last_error, set_last_error};
use crate::handle::PhotowallHandle;
use photowall_core::models::{PaginationParams, PhotoSortOptions};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;

fn string_to_cstr(s: &str) -> *mut c_char {
    CString::new(s)
        .map(|cs| cs.into_raw())
        .unwrap_or(std::ptr::null_mut())
}

unsafe fn cstr_to_str(ptr: *const c_char) -> Option<&'static str> {
    if ptr.is_null() {
        return None;
    }
    CStr::from_ptr(ptr).to_str().ok()
}

#[derive(Debug, Default)]
struct FolderNodeBuilder {
    path: String,
    name: String,
    direct_count: i64,
    children: BTreeSet<String>,
    parent: Option<String>,
}

/// Folder tree node for JSON output.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderNode {
    path: String,
    name: String,
    photo_count: i64,
    has_children: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    children: Vec<FolderNode>,
}

fn node_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn parent_path(path: &str) -> Option<String> {
    let parent = Path::new(path).parent()?;
    let parent_str = parent.to_string_lossy().to_string();
    if parent_str.is_empty() || parent_str == path {
        None
    } else {
        Some(parent_str)
    }
}

fn ensure_node(nodes: &mut HashMap<String, FolderNodeBuilder>, path: &str) {
    nodes.entry(path.to_string()).or_insert_with(|| FolderNodeBuilder {
        path: path.to_string(),
        name: node_name(path),
        direct_count: 0,
        children: BTreeSet::new(),
        parent: None,
    });
}

fn build_tree_nodes(counts: &HashMap<String, i64>) -> HashMap<String, FolderNodeBuilder> {
    let mut nodes: HashMap<String, FolderNodeBuilder> = HashMap::new();

    for (path, count) in counts {
        ensure_node(&mut nodes, path);
        if let Some(node) = nodes.get_mut(path) {
            node.direct_count += *count;
        }

        let mut current = path.clone();
        while let Some(parent) = parent_path(&current) {
            ensure_node(&mut nodes, &parent);
            if let Some(parent_node) = nodes.get_mut(&parent) {
                parent_node.children.insert(current.clone());
            }
            if let Some(child_node) = nodes.get_mut(&current) {
                if child_node.parent.is_none() {
                    child_node.parent = Some(parent.clone());
                }
            }
            current = parent;
        }
    }

    nodes
}

fn build_folder_node(path: &str, nodes: &HashMap<String, FolderNodeBuilder>) -> FolderNode {
    let node = nodes.get(path).expect("node exists");
    let mut children: Vec<FolderNode> = Vec::new();
    let mut children_count = 0i64;

    for child_path in &node.children {
        let child_node = build_folder_node(child_path, nodes);
        children_count += child_node.photo_count;
        children.push(child_node);
    }

    let photo_count = node.direct_count + children_count;
    let has_children = !node.children.is_empty();

    FolderNode {
        path: node.path.clone(),
        name: node.name.clone(),
        photo_count,
        has_children,
        children,
    }
}

fn build_folder_tree(counts: &HashMap<String, i64>) -> Vec<FolderNode> {
    let nodes = build_tree_nodes(counts);
    let mut roots: Vec<String> = nodes
        .values()
        .filter(|node| node.parent.is_none())
        .map(|node| node.path.clone())
        .collect();
    roots.sort();

    roots
        .iter()
        .map(|path| build_folder_node(path, &nodes))
        .collect()
}

fn build_folder_children(counts: &HashMap<String, i64>, parent: &str) -> Vec<FolderNode> {
    let nodes = build_tree_nodes(counts);
    let mut children: Vec<String> = if parent.is_empty() {
        nodes
            .values()
            .filter(|node| node.parent.is_none())
            .map(|node| node.path.clone())
            .collect()
    } else {
        nodes
            .get(parent)
            .map(|node| node.children.iter().cloned().collect())
            .unwrap_or_default()
    };

    children.sort();
    children
        .iter()
        .map(|path| build_folder_node(path, &nodes))
        .collect()
}

/// Get folder tree with photo counts as JSON.
#[no_mangle]
pub unsafe extern "C" fn photowall_get_folder_tree_json(
    handle: *mut PhotowallHandle,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || out_json.is_null() {
            set_last_error("handle or out_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        match db.get_folder_photo_counts() {
            Ok(counts) => {
                let tree = build_folder_tree(&counts);
                let json = serde_json::to_string(&tree).unwrap_or_else(|_| "[]".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_folder_photo_counts failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_folder_tree_json");
        -1
    })
}

/// Get folder children as JSON array.
#[no_mangle]
pub unsafe extern "C" fn photowall_get_folder_children_json(
    handle: *mut PhotowallHandle,
    folder_path: *const c_char,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || out_json.is_null() {
            set_last_error("handle or out_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let parent_path = if folder_path.is_null() {
            ""
        } else {
            match CStr::from_ptr(folder_path).to_str() {
                Ok(s) => s,
                Err(_) => {
                    set_last_error("invalid UTF-8 in folder_path");
                    return -1;
                }
            }
        };

        match db.get_folder_photo_counts() {
            Ok(counts) => {
                let children = build_folder_children(&counts, parent_path);
                let json = serde_json::to_string(&children).unwrap_or_else(|_| "[]".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_folder_photo_counts failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_folder_children_json");
        -1
    })
}

/// Get photos in a folder with pagination.
#[no_mangle]
pub unsafe extern "C" fn photowall_get_folder_photos_json(
    handle: *mut PhotowallHandle,
    folder_path: *const c_char,
    include_subfolders: i32,
    page: u32,
    page_size: u32,
    sort_json: *const c_char,
    out_json: *mut *mut c_char,
) -> i32 {
    clear_last_error();

    let result = catch_unwind(AssertUnwindSafe(|| {
        if handle.is_null() || folder_path.is_null() || out_json.is_null() {
            set_last_error("handle, folder_path, or out_json is null");
            return -1;
        }

        let handle = &*handle;
        let db = handle.core.database();

        let path_str = match CStr::from_ptr(folder_path).to_str() {
            Ok(s) => s,
            Err(_) => {
                set_last_error("invalid UTF-8 in folder_path");
                return -1;
            }
        };

        let pagination = PaginationParams { page, page_size };

        let sort: PhotoSortOptions = cstr_to_str(sort_json)
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        match db.get_photos_by_folder(path_str, include_subfolders != 0, &pagination, &sort) {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
                *out_json = string_to_cstr(&json);
                0
            }
            Err(e) => {
                set_last_error(format!("get_photos_by_folder failed: {}", e));
                -1
            }
        }
    }));

    result.unwrap_or_else(|_| {
        set_last_error("panic in photowall_get_folder_photos_json");
        -1
    })
}
