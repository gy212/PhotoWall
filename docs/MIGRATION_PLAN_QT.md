# PhotoWall 前端迁移计划：React → Qt QML

> 本文档记录从 Tauri + React 迁移到 Qt QML + Rust FFI 的技术方案

---

## 概述

将 PhotoWall 的前端从 Tauri + React 迁移到 Qt，同时保留 Rust 后端通过 FFI 调用。

## 前提与约束（本计划适用范围）

- **平台**：仅 Windows（现阶段不考虑 macOS/Linux 适配）。
- **开源与许可**：业务代码保持 MIT；使用 Qt 时遵守 Qt 开源许可（通常为 LGPL），需要在发布物中提供相应的第三方许可与替换/动态链接要求说明。
- **数据目录**：Qt 版本使用新目录（建议：`%APPDATA%/PhotoWallQt/`），不与现有 Tauri 版本共享 settings/db/cache/log（可选：后续提供导入旧数据工具/流程）。
- **长任务取消**：索引/导入/导出等长任务必须支持取消（FFI + Qt UI 全链路）。
- **验证策略**：不单独做 POC 项目，但每个阶段都需要产出“可运行版本”作为里程碑验收；若在关键里程碑无法推进，则及时止损回到现有 Tauri 版本。

## 技术路线

```
当前架构:  React (WebView) ←→ Tauri IPC ←→ Rust 后端 ←→ SQLite
目标架构:  Qt QML UI ←→ Rust FFI (C ABI) ←→ Rust 后端 ←→ SQLite
```

## 迁移动机

| 方面 | 当前 (Tauri + React) | 目标 (Qt QML) |
|------|---------------------|---------------|
| 包体积 | ~25MB (含 WebView2) | <15MB |
| 冷启动 | ~2-3s | <1s |
| 内存占用 | ~150MB | <80MB |
| 原生体验 | 模拟原生 (CSS) | 真正原生控件 |

## 迁移范围

### 保留（尽量复用，但需要“去 Tauri 化”）
- `src-tauri/src/db/` - 数据库层（建议迁入 core crate 后复用）
- `src-tauri/src/services/` - 业务逻辑（多数可复用，但需要移除对 `tauri::AppHandle/Emitter` 的直接依赖）
- `src-tauri/src/models/` - 数据模型（建议迁入 core crate，并与 QML 侧字段保持一致）
- SQLite 数据库结构（复用）

> 说明：当前后端并非完全与 Tauri 解耦，存在直接依赖 Tauri 的服务（如 settings/auto_scan/thumbnail_queue 等）。要做到 `cdylib` + Qt，需要先把“路径获取、事件派发、窗口句柄相关操作”等抽象出来。

### 需要修改
- `src-tauri/src/commands/` - 逐步收敛为“core 调用入口”（Tauri 继续用 commands；Qt 走 FFI），避免把 commands 直接改成 FFI 导出导致双端难维护
- `src-tauri/src/lib.rs` - **不建议**直接在同一个 crate 上“移除 Tauri 改 cdylib”；更稳的方案是拆分 crate（见“阶段零”）
- `src-tauri/src/window_effects.rs` - 现有实现依赖 `tauri::WebviewWindow`，Qt 版本需要改为接收 `HWND` 或在 C++ 侧重写

### 需要重写（Qt QML）
- 全部前端 UI (13,946 行 React 代码)
- 状态管理（Zustand → Qt 信号槽 + Q_PROPERTY）
- 事件系统（Tauri events → Qt 信号）

---

## 阶段零：后端去 Tauri 化 & 双前端并存（强烈建议）

目标：在不破坏现有 Tauri 版本的前提下，抽出一个“纯 Rust 后端核心库”，同时服务 Tauri 与 Qt。

### 0.1 建议的 Rust Workspace/Crate 划分

建议把 `src-tauri/` 逐步演进为 workspace：

```
src-tauri/
├── crates/
│   ├── photowall-core/      # 纯 Rust：db/models/services/utils（不依赖 tauri）
│   ├── photowall-tauri/     # 现有 Tauri 壳：commands + UI 事件桥接
│   └── photowall-ffi/       # cdylib：对外 C ABI（给 Qt 调用）
└── Cargo.toml               # workspace root（或保留原结构，按实际改造）
```

### 0.2 去耦要点（把“平台能力”抽象出来）

- **路径/目录**：把“settings/db/cache/log 目录”的来源统一到 core 内部（Windows: `%APPDATA%/PhotoWallQt`），不要再从 `tauri::AppHandle.path()` 取，也不要与旧 Tauri 版本共用目录。
- **事件派发**：core 内部不要直接依赖 `tauri::Emitter`；改为 `EventSink`/回调接口，由宿主（Tauri 或 Qt）提供实现。
- **异步运行时**：core 不持有全局 runtime；由宿主负责创建 tokio runtime，并以“同步 API + spawn_blocking/任务队列”方式驱动，避免 cdylib 生命周期不清晰。

### 0.3 阶段零验收标准（不做 POC，但要可运行）

- Tauri 版本功能不回归（可先保证核心链路：索引、缩略图、搜索、标签/相册、回收站）。
- photowall-core 通过现有单元测试（db/settings 等），并新增少量针对新抽象（EventSink）的测试桩。

## 阶段一：Rust FFI 层改造

### 1.1 创建 C ABI 导出层

在 `src-tauri/` 中新建 FFI 模块：

```rust
// src-tauri/src/ffi/mod.rs
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[repr(C)]
pub struct FFIPhoto {
    pub photo_id: i64,
    pub file_path: *mut c_char,
    pub file_name: *mut c_char,
    pub file_hash: *mut c_char,
    pub width: i32,
    pub height: i32,
    // ... 其他字段
}

#[no_mangle]
pub extern "C" fn photowall_get_photos(
    limit: i32,
    cursor_json: *const c_char,
    out_json: *mut *mut c_char
) -> i32 {
    // 调用现有 Rust 逻辑，返回 JSON
}

#[no_mangle]
pub extern "C" fn photowall_free_string(s: *mut c_char) {
    // 释放 Rust 分配的字符串
}
```

### 1.1.1 建议补充：初始化、错误与事件回调（避免后期返工）

为确保 Qt 侧能安全地接收进度/完成事件，并能定位错误，建议在第一版 FFI 就把以下“骨架”定下来：

- **初始化/销毁**：`photowall_init(config_json, callbacks) -> *mut PhotowallHandle`、`photowall_shutdown(handle)`
- **错误获取**：`photowall_last_error(handle) -> *const c_char`（或线程局部 last_error）
- **事件推送**：支持注册事件回调（注意：回调可能发生在后台线程；Qt 侧必须转发到 UI 线程）
- **任务取消**：长任务返回 `job_id`，并提供 `photowall_cancel_job(handle, job_id)`（至少覆盖 index/import/export）

示例（概念，具体以实现为准）：

```c
typedef void (*photowall_event_cb)(const char* event_name, const char* payload_json, void* user_data);

typedef struct photowall_callbacks {
  photowall_event_cb on_event;
  void* user_data;
} photowall_callbacks;
```

### 1.2 建议的 ABI 约定（Windows-only 但仍要稳定）

- 所有跨边界字符串统一 UTF-8（Qt/C++ 侧负责转 QString）。
- Rust 分配的内存必须由 Rust 提供 free 函数释放（不要让 Qt 侧 `free()`）。
- 所有 API 返回值用“错误码 + out 参数”模式，避免 panic 穿透边界；Rust 内部用 `catch_unwind` 做兜底。

### 1.2 修改 Cargo.toml

```toml
[lib]
name = "photowall_core"
crate-type = ["cdylib", "staticlib"]

[dependencies]
# 移除 tauri 相关依赖
# 保留: rusqlite, image, tokio, rayon, xxhash-rust 等
```

### 1.3 需要导出的核心 API（99 个命令精简为 ~30 个 FFI 函数）

| 功能组 | FFI 函数 |
|--------|----------|
| 照片查询 | `get_photos_cursor`, `search_photos_cursor`, `get_photo` |
| 索引 | `index_directory`, `get_database_stats` |
| 缩略图 | `get_thumbnail_path`, `enqueue_thumbnail`, `check_cached` |
| 标签 | `get_all_tags`, `add_tag_to_photo`, `remove_tag_from_photo` |
| 相册 | `get_all_albums`, `add_photo_to_album` |
| 回收站 | `soft_delete`, `restore`, `permanent_delete` |
| 设置 | `get_settings`, `save_settings` |

---

## 阶段二：Qt 项目搭建

### 2.1 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| UI 框架 | **Qt QML** | 声明式 UI，动画流畅，更接近 React 开发体验 |
| 构建系统 | CMake | 现代 Qt 标准 |
| Qt 版本 | Qt 6.5+ | 长期支持，QML 性能更好 |
| C++/QML 集成 | QML 前端 + C++ 后端模型 | 性能敏感逻辑用 C++ |

### 2.0 Windows 打包/构建要点（建议写入计划，避免后期卡住）

- **工具链统一**：Qt（MSVC 版本）与 Rust（`x86_64-pc-windows-msvc`）保持一致，避免 CRT 不匹配。
- **Rust DLL 部署**：Qt 可执行文件同目录放置 `photowall_core.dll`；必要时在启动时校验版本/导出符号。
- **第三方许可**：发布物中附带 Qt LGPL 文本与 `THIRD_PARTY_NOTICES.md`（项目代码仍可保持 MIT）。

### 2.1.1 QML 的优势（对比 React）

| 特性 | React | QML |
|------|-------|-----|
| 虚拟滚动 | 需要 react-virtuoso | GridView/ListView 内置 |
| 动画 | framer-motion | 内置 Behavior/Transition |
| 状态绑定 | useState/useEffect | 属性绑定自动响应 |
| 样式 | CSS/Tailwind | 内联属性 + 主题 |
| 热重载 | Vite HMR | Qt Design Studio / qmlscene |

### 2.1.2 学习资源

1. **官方教程**：https://doc.qt.io/qt-6/qmlapplications.html
2. **QML Book**：https://www.qt.io/product/qt6/qml-book (免费在线)
3. **视频教程**：YouTube "Qt QML Tutorial" 系列
4. **示例项目**：Qt 安装目录下的 `examples/quick/`

### 2.2 项目结构

```
photowall-qt/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── core/
│   │   ├── RustBridge.h/cpp      # Rust FFI 封装
│   │   ├── PhotoModel.h/cpp      # QAbstractListModel 供 QML 使用
│   │   ├── PhotoStore.h/cpp      # 状态管理（暴露给 QML）
│   │   └── ThumbnailProvider.h/cpp # QQuickImageProvider
│   └── utils/
│       └── AsyncWorker.h/cpp     # 异步任务
├── qml/
│   ├── main.qml                  # 主窗口
│   ├── components/
│   │   ├── PhotoGrid.qml         # 核心：GridView 虚拟滚动
│   │   ├── PhotoThumbnail.qml    # 缩略图卡片
│   │   ├── PhotoViewer.qml       # 全屏查看器
│   │   ├── Sidebar.qml
│   │   └── Toolbar.qml
│   ├── pages/
│   │   ├── HomePage.qml
│   │   ├── FavoritesPage.qml
│   │   ├── TrashPage.qml
│   │   ├── FoldersPage.qml
│   │   └── SettingsPage.qml
│   └── dialogs/
│       ├── TagManager.qml
│       └── AlbumManager.qml
├── resources/
│   ├── icons/
│   └── fonts/
└── lib/
    └── photowall_core.dll        # Rust 编译产物
```

---

## 阶段三：核心组件实现（QML 版本）

### 3.1 PhotoGrid（核心组件）

QML 的 `GridView` 内置虚拟化，比 React 实现更简单：

```qml
// qml/components/PhotoGrid.qml
import QtQuick
import QtQuick.Controls

GridView {
    id: grid
    cellWidth: 220
    cellHeight: 220
    clip: true

    model: PhotoModel {}  // C++ QAbstractListModel

    delegate: PhotoThumbnail {
        width: grid.cellWidth - 10
        height: grid.cellHeight - 10
        photoId: model.photoId
        fileHash: model.fileHash
        filePath: model.filePath
        selected: model.selected

        onClicked: PhotoStore.toggleSelection(photoId)
        onDoubleClicked: PhotoStore.openViewer(photoId)
    }

    // 无限滚动
    onAtYEndChanged: {
        if (atYEnd && !PhotoStore.loading) {
            PhotoStore.loadMore()
        }
    }

    ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }
}
```

### 3.2 缩略图加载（QQuickImageProvider）

```cpp
// src/core/ThumbnailProvider.h
class ThumbnailProvider : public QQuickAsyncImageProvider {
public:
    QQuickImageResponse* requestImageResponse(
        const QString& id, const QSize& requestedSize) override;
};

// QML 中使用
Image {
    source: "image://thumbnail/" + fileHash + "/small"
    asynchronous: true
    fillMode: Image.PreserveAspectCrop
}
```

### 3.3 状态管理（C++ 单例暴露给 QML）

```cpp
// src/core/PhotoStore.h
class PhotoStore : public QObject {
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(bool loading READ loading NOTIFY loadingChanged)
    Q_PROPERTY(QString searchQuery READ searchQuery WRITE setSearchQuery NOTIFY searchQueryChanged)
    // QML 侧更容易消费 list；内部可用 QSet 做去重，暴露时转为 QVariantList。
    Q_PROPERTY(QVariantList selectedIds READ selectedIds NOTIFY selectionChanged)

public:
    Q_INVOKABLE void loadPhotos();
    Q_INVOKABLE void loadMore();
    Q_INVOKABLE void toggleSelection(int photoId);
    Q_INVOKABLE void search(const QString& query);

signals:
    void loadingChanged();
    void searchQueryChanged();
    void selectionChanged();
    void photosLoaded(const QVector<Photo>& photos);
};
```

```qml
// QML 中使用
import PhotoWall.Core

Button {
    text: "搜索"
    onClicked: PhotoStore.search(searchField.text)
}

BusyIndicator {
    visible: PhotoStore.loading
}
```

### 3.4 Rust FFI 调用封装

```cpp
// src/core/RustBridge.h
class RustBridge : public QObject {
    Q_OBJECT
public:
    static RustBridge* instance();

    // 同步调用（简单查询）
    QJsonObject getSettings();

    // 异步调用（耗时操作）
    void getPhotosAsync(int limit, const QString& cursor);
    void indexDirectoryAsync(const QString& path);

signals:
    void photosReady(const QJsonArray& photos);
    void indexProgress(int processed, int total);
    void indexFinished();

private:
    void* m_rustLib;  // dlopen/LoadLibrary
};
```

### 3.5 事件线程模型（Qt 与 Rust 的“持续推事件”如何落地）

建议沿用“Rust 侧持续推事件”的思路，但要明确线程边界：

- Rust 侧通过 `on_event(event_name, payload_json)` 回调推送（可能来自后台线程）。
- C++ 侧回调里**不要直接操作 QML/Qt 对象**；应使用 `QMetaObject::invokeMethod(..., Qt::QueuedConnection, ...)` 或投递自定义事件，把数据转交 UI 线程，再发 Qt signal 给 QML。
- 事件命名建议与现有 Tauri 事件保持一致（如 `index-progress/index-finished`），降低迁移成本。

---

## 阶段四：页面迁移顺序

按依赖关系和复杂度排序：

| 顺序 | 页面 | React 行数 | 难度 | 依赖组件 |
|------|------|-----------|------|----------|
| 1 | 基础布局 | ~300 | 低 | MainWindow, Toolbar |
| 2 | 设置页 | 633 | 低 | SettingsPage.qml |
| 3 | 照片网格 | 346 | **高** | PhotoGrid, ThumbnailProvider |
| 4 | 首页 | 223 | 中 | PhotoGrid + 仪表盘组件 |
| 5 | 收藏页 | 384 | 低 | 复用 PhotoGrid |
| 6 | 回收站 | 557 | 中 | 复用 PhotoGrid |
| 7 | 文件夹页 | 654 | 中 | TreeView + PhotoGrid |
| 8 | 照片查看器 | 735 | 中 | PhotoViewer |
| 9 | 照片编辑器 | 426 | 高 | 图像处理（可延后） |

---

## 阶段五：验证与测试

### 5.1 功能验证清单

- [ ] 照片索引：选择文件夹 → 扫描 → 入库
- [ ] 缩略图：生成、缓存、渐进式加载
- [ ] 虚拟滚动：10000+ 照片流畅滚动
- [ ] 搜索：FTS5 全文搜索
- [ ] 标签/相册：CRUD 操作
- [ ] 回收站：软删除、恢复、永久删除
- [ ] 取消任务：索引/导入/导出可取消，取消后 DB 不损坏、UI 状态可恢复
- [ ] 窗口效果（如有）：窗口模糊/材质效果（Qt 侧是否保留、如何实现需要明确）

### 5.2 性能基准

| 指标 | 当前 (Tauri) | 目标 (Qt) |
|------|-------------|-----------|
| 冷启动 | ~2-3s | <1s |
| 内存占用 (空闲) | ~150MB | <80MB |
| 滚动 10000 张 | 偶有卡顿 | 60fps |
| 包体积 | ~25MB | <15MB |

---

## 风险与建议

### 高风险项

1. **QML 学习曲线**：虽然 QML 语法类似 React，但 Qt 的信号槽、属性绑定、C++ 集成需要时间掌握
2. **异步协调**：Rust 的 tokio 异步与 Qt 事件循环的集成需要仔细设计
3. **调试复杂度**：QML + C++ + Rust FFI 三层调试比纯 React 复杂

### 建议

1. **学习资源**：先花 1 周学习 Qt QML 基础（推荐 Qt 官方教程 + qmlbook.github.io）
2. **从简单页面开始**：先实现 SettingsPage，熟悉 QML 语法后再做 PhotoGrid
3. **保持 Tauri 版本可用**：迁移期间保持两个版本并存，便于对比和回退

---

## 模块化任务分解（并行开发）

详见 `docs/MIGRATION_TASKS_QT.md`（模块依赖图、R/C/Q/P/D/T 任务、接口约定、并行建议）。

---

## 时间估算（更新）

| 阶段 | 内容 | 预估 | 并行度 |
|------|------|------|--------|
| 阶段零 | photowall-core 拆分 | 1-2 周 | 1 人 |
| 阶段一 | photowall-ffi + C++ 模块 | 2 周 | 2-3 人并行 |
| 阶段二 | QML 组件 + 页面 | 3-4 周 | 2-3 人并行 |
| 阶段三 | 集成测试 + 优化 | 1-2 周 | 全员 |
| **总计** | | **7-10 周**（多人并行） |

---

## 关键文件参考

迁移时需要重点参考的现有代码：

| 功能 | 当前文件 | 说明 |
|------|----------|------|
| 虚拟滚动 | `src/components/photo/PhotoGrid/index.tsx` | 行级虚拟化逻辑 |
| 缩略图加载 | `src/hooks/useThumbnail.ts` | 渐进式加载策略 |
| 缩略图缓存 | `src/services/ThumbnailStore.ts` | 事件驱动缓存 |
| 后端缩略图 | `src-tauri/src/services/thumbnail.rs` | 生成与队列 |
| 数据库查询 | `src-tauri/src/db/photo_dao.rs` | 游标分页 |
| 完整架构 | `docs/PROJECT_HANDOVER (1).md` | 交接文档 |

---

## 附录：现有 Tauri 命令/事件对照（Qt 迁移用）

> 目的：Qt 侧尽量沿用同名事件与业务语义，降低迁移成本；同时为 photowall-ffi 的导出函数提供“对照表”。  
> 下列清单基于当前代码扫描（截至 2026-01-24），可能会随代码演进而变化。

### A. Rust → UI 事件清单（建议 Qt 保持同名）

| 事件名 | 触发时机 | payload（JSON 结构） | 来源（便于回查） |
|---|---|---|---|
| `index-progress` | 索引进行中 | `IndexProgress`：`total/processed/indexed/skipped/failed/currentFile/percentage` | `src-tauri/src/services/indexer.rs` |
| `index-finished` | 索引完成 | `IndexResult`：`indexed/skipped/failed/failedFiles` | `src-tauri/src/services/indexer.rs` |
| `refresh-progress` | 刷新元数据进行中 | `string`（进度文本） | `src-tauri/src/commands/scanner.rs` |
| `refresh-finished` | 刷新元数据完成 | `RefreshMetadataResult`：`total/updated/skipped/failed` | `src-tauri/src/commands/scanner.rs` |
| `thumbnail-pregenerate-started` | 索引后触发后台预生成缩略图 | `{ total, queued }` | `src-tauri/src/commands/scanner.rs` |
| `thumbnail-ready` | 缩略图生成完成 | `ThumbnailReadyPayload`：`fileHash/size/path/isPlaceholder/placeholderBase64?/useOriginal` | `src-tauri/src/services/thumbnail_queue.rs` |
| `import-progress` | 导入（就地索引）进行中 | 同 `IndexProgress` | `src-tauri/src/commands/file_ops.rs` |
| `import-finished` | 导入完成 | 同 `IndexResult` | `src-tauri/src/commands/file_ops.rs` |
| `export-progress` | 导出进行中 | `{ current, total, percentage }` | `src-tauri/src/commands/file_ops.rs` |
| `export-finished` | 导出完成 | `ExportResult`：`exported/skipped/failed/failedFiles` | `src-tauri/src/commands/file_ops.rs` |
| `settings-changed` | 保存/重置设置后 | `AppSettings`（完整设置对象） | `src-tauri/src/commands/settings.rs` |
| `sync-folders-changed` | 同步文件夹列表变更 | `string[]`（watched_folders） | `src-tauri/src/commands/folder_sync.rs` |
| `auto-sync-changed` | 自动同步开关变更 | `boolean` | `src-tauri/src/commands/folder_sync.rs` |
| `sync-started` | 手动触发同步 | `string[]`（watched_folders） | `src-tauri/src/commands/folder_sync.rs` |
| `auto-scan:started` | 自动扫描开始 | `{ dirPath, scanType }` | `src-tauri/src/services/auto_scan.rs` |
| `auto-scan:completed` | 自动扫描完成 | `{ dirPath, indexed, skipped, hasChanges, newMultiplier }` | `src-tauri/src/services/auto_scan.rs` |
| `auto-scan:frequency-changed` | 扫描倍率变化 | `{ dirPath, oldMultiplier, newMultiplier }` | `src-tauri/src/services/auto_scan.rs` |
| `auto-scan:file-changed` | 文件系统监控触发 | `{ path, changeType }` | `src-tauri/src/services/auto_scan.rs` |
| `auto-scan:realtime-indexed` | 实时索引完成 | `{ path }` | `src-tauri/src/services/auto_scan.rs` |
| `auto-scan:realtime-deleted` | 实时删除标记完成 | `{ path }` | `src-tauri/src/services/auto_scan.rs` |

Qt 侧建议处理方式：

- photowall-ffi 导出 `on_event(event_name, payload_json)` 回调，事件名保持不变；payload 统一为 UTF-8 JSON 字符串。
- C++ 回调线程只负责转发/投递；真正更新 QML 必须回到 Qt 主线程（见 `3.5 事件线程模型`）。

### B. UI → Rust 调用清单（Tauri command → 推荐 FFI API）

说明：

- **短耗时查询**：FFI 同步返回 JSON（或基础类型），由 Qt 直接消费。
- **长耗时任务**（索引/导入/导出/缩略图队列等）：FFI 只“触发任务”并立刻返回，进度/结果通过事件推送（与 Tauri 同名）。

建议将命令按领域收敛为少量 FFI 函数组（名称仅建议，可按你实际实现微调）：

| 领域 | 现有 Tauri commands（Rust 侧已有 110 个） | Qt/FFI 建议（示例） |
|---|---|---|
| 扫描/索引 | `scan_directory`, `scan_directories`, `index_directory`, `index_directories`, `get_database_stats`, `refresh_photo_metadata` | `photowall_scan_directory_json`、`photowall_index_directory_async`、`photowall_get_database_stats_json`、`photowall_refresh_photo_metadata_async` |
| 照片查询 | `get_photo`, `get_photos`, `get_photos_cursor`, `get_favorite_photos`, `get_photos_by_tag`, `get_photos_by_album`, `get_photos_by_folder` | `photowall_get_photos_cursor_json`、`photowall_get_photo_json`（优先保留 cursor 分页） |
| 搜索 | `search_photos`, `search_photos_cursor`, `search_photos_simple` | `photowall_search_photos_cursor_json` |
| 缩略图 | `enqueue_thumbnail`, `enqueue_thumbnails_batch`, `cancel_thumbnail`, `get_thumbnail_cache_path`, `check_thumbnails_cached`, `warm_thumbnail_cache`, `get_raw_preview` | `photowall_enqueue_thumbnails_batch`（触发队列，靠 `thumbnail-ready` 推送）+ `photowall_get_thumbnail_path_utf8` |
| 标签 | `get_all_tags*`, `create_tag`, `update_tag`, `delete_tag`, `add/remove*_tag*` | `photowall_tags_*_json`（CRUD + 关联操作） |
| 相册 | `get_all_albums*`, `create_album`, `update_album`, `delete_album`, `add/remove*_album*`, `reorder_album_photos`, `set_album_cover` | `photowall_albums_*_json` |
| 回收站 | `get_deleted_photos`, `soft_delete_photos`, `restore_photos`, `permanent_delete_photos`, `empty_trash`, `get_trash_stats` | `photowall_trash_*_json` |
| 文件操作 | `import_photos`, `export_photos`, `move_photo`, `copy_photo`, `delete_photos`, `batch_rename_photos` | `photowall_import_photos_async`（复用 `import-*` 事件）+ `photowall_export_photos_async`（复用 `export-*` 事件） |
| 设置 | `get_settings`, `save_settings`, `reset_settings` | `photowall_get_settings_json`、`photowall_save_settings_json`（成功后推 `settings-changed`） |
| 文件夹/同步/自动扫描 | `get_sync_folders`, `add/remove_sync_folder`, `set/get_auto_sync_enabled`, `trigger_sync_now`, `get_folder_tree`, `get_folder_children`, `get_folder_photo_count`, `start/stop_auto_scan`, `get_auto_scan_status`, ... | `photowall_folders_*_json` + `photowall_auto_scan_*`（事件沿用 `auto-scan:*`） |
| 窗口效果/系统集成（Windows） | `apply_window_settings`, `get_blurred_desktop`, `set_exclude_from_capture`, `enable/disable_composition_blur`, ... | 建议 Qt/C++ 侧实现为主；若复用 Rust，需要把窗口句柄（HWND）从 Qt 传入，避免依赖 Tauri window 类型 |
| 照片编辑（可后置） | `apply_photo_edits`, `get_edit_preview`, `is_photo_editable` | 第一期可不做；后续再导出 `photowall_edit_*` |

### C. 已知不一致点（迁移前建议对齐/清理）

- `src/hooks/useScanner.ts` 调用/监听了历史遗留的 `cancel_scan`、`scan-progress`、`index_photos` 等，但后端当前并无对应命令/事件；该问题已在 `docs/PROJECT_HANDOVER (1).md` 中记录。迁移到 Qt 前建议明确：是补齐后端实现，还是删除旧逻辑，避免把“旧债”带到新前端。

---

*文档创建时间: 2026-01-24*
*PhotoWall v0.1.0*
