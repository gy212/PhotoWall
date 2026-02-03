
# PhotoWall Qt 迁移：模块化任务分解（并行开发）

> 本文档为 `docs/MIGRATION_PLAN_QT.md` 的“模块化任务分解”独立版：按模块拆分任务、明确接口与验收，便于多人并行推进。

## 前提与约束

- **平台**：仅 Windows。
- **数据目录**：Qt 版本使用**新目录**（默认建议：`%APPDATA%/PhotoWallQt/`），不与现有 Tauri 版本共享 settings/db/cache/log。
  - 可选：后续提供“导入旧数据”工具/流程，但不作为第一阶段阻塞项。
- **长任务取消**：索引/导入/导出必须支持取消（FFI + C++ + QML 全链路）。

---

## 任务依赖图

```
阶段零（必须先完成）
    │
    ├─→ [R-01] photowall-core crate
    │       │
    │       ├─→ [R-02] photowall-ffi crate ──┐
    │       │                                │
    │       └─→ [R-03] photowall-tauri 适配  │（可并行，可选）
    │                                        │
    ├───────────────────────────────────────┘
    │
阶段一/二（FFI + Qt 骨架，可并行）
    │
    ├─→ [C-01] RustBridge.h/cpp ←── 依赖 R-02
    ├─→ [C-02] PhotoModel.h/cpp
    ├─→ [C-03] ThumbnailProvider.h/cpp
    ├─→ [C-04] PhotoStore.h/cpp
    ├─→ [C-05] EventDispatcher.h/cpp
    ├─→ [C-06] FolderTreeModel.h/cpp
    │
    └─→ [Q-01] main.qml + 路由骨架
            │
阶段三/四（QML 组件 + 页面，大部分可并行）
    │
    ├─→ [Q-02] PhotoThumbnail.qml
    ├─→ [Q-03] PhotoGrid.qml ←── 依赖 Q-02, C-02
    ├─→ [Q-04] Toolbar.qml
    ├─→ [Q-05] Sidebar.qml
    ├─→ [Q-06] SearchPanel.qml
    ├─→ [Q-07] ContextMenu.qml
    │
    ├─→ [P-01] HomePage.qml ←── 依赖 Q-03, Q-04
    ├─→ [P-02] SettingsPage.qml（可最先开发）
    ├─→ [P-03] FavoritesPage.qml ←── 依赖 Q-03
    ├─→ [P-04] TrashPage.qml ←── 依赖 Q-03
    ├─→ [P-05] FoldersPage.qml ←── 依赖 Q-03, C-06 FolderTreeModel
    ├─→ [P-06] TagsPage.qml
    ├─→ [P-07] AlbumsPage.qml
    │
    ├─→ [D-01] PhotoViewer.qml
    ├─→ [D-02] TagManager.qml
    ├─→ [D-03] AlbumManager.qml
    ├─→ [D-04] ConfirmDialog.qml
    ├─→ [D-05] ScanProgressDialog.qml（含取消）
    │
阶段五（集成测试）
    └─→ [T-01] 集成测试 + 性能调优
```

---

## Rust 模块任务（R-xx）

### R-01: photowall-core crate

| 属性 | 值 |
|------|-----|
| **文件** | `src-tauri/crates/photowall-core/` |
| **负责人角色** | Rust 开发 |
| **可并行** | 否（基础依赖） |
| **输入** | 现有 `src-tauri/src/{db,models,services,utils}` |
| **输出** | 纯 Rust 库，不依赖 Tauri |

子任务清单：

| ID | 任务 | 文件 | 接口/产出 |
|----|------|------|-----------|
| R-01-a | 迁移 db 层 | `core/src/db/` | `Database`, `PhotoDao`, `TagDao`, `AlbumDao`, `ScanDirDao` |
| R-01-b | 迁移 models | `core/src/models/` | `Photo`, `Tag`, `Album`, `Settings` |
| R-01-c | 迁移 services | `core/src/services/` | `Scanner`, `Indexer`, `ThumbnailService`, `ThumbnailQueue`, `AutoScanManager`, `FileWatcher`, `Metadata` |
| R-01-d | 抽象 EventSink | `core/src/events.rs` | `trait EventSink { fn emit(&self, name: &str, payload_json: &str); }` |
| R-01-e | 抽象路径提供者 | `core/src/paths.rs` | `fn get_app_data_dir() -> PathBuf` |
| R-01-f | 单元测试迁移 | `core/tests/` | 确保现有测试通过 |
| R-01-g | 新数据目录策略 | `core/src/paths.rs` | Windows: `%APPDATA%/PhotoWallQt/`；目录内分 `db/ settings/ cache/ logs/` |
| R-01-h | 长任务 Job + CancelToken | `core/src/jobs.rs` | 统一的 `JobId`/取消接口（给 FFI 使用），至少覆盖：index/import/export |

验收标准：

- `cargo test -p photowall-core` 全部通过
- 不依赖 `tauri` crate
- 运行时只写入新数据目录（不触碰旧目录）

---

### R-02: photowall-ffi crate

| 属性 | 值 |
|------|-----|
| **文件** | `src-tauri/crates/photowall-ffi/` |
| **负责人角色** | Rust 开发 |
| **可并行** | 依赖 R-01 完成后 |
| **输入** | photowall-core |
| **输出** | `photowall_core.dll` (cdylib) + `photowall.h` |

子任务清单：

| ID | 任务 | 文件 | 接口/产出 |
|----|------|------|-----------|
| R-02-a | FFI 骨架 | `ffi/src/lib.rs` | `photowall_init`, `photowall_shutdown`, `photowall_last_error` |
| R-02-b | 事件回调注册 | `ffi/src/callbacks.rs` | `photowall_set_event_callback(handle, cb, user_data)` |
| R-02-c | 照片查询 API | `ffi/src/photos.rs` | `photowall_get_photos_cursor_json`, `photowall_search_photos_cursor_json` |
| R-02-d | 索引 API | `ffi/src/indexer.rs` | `photowall_index_directory_async(...) -> JobId` |
| R-02-e | 缩略图 API | `ffi/src/thumbnail.rs` | `photowall_enqueue_thumbnails_batch`, `photowall_get_thumbnail_path_utf8(fileHash, size)` |
| R-02-f | 标签 API | `ffi/src/tags.rs` | `photowall_tags_get_all_json`, `photowall_tags_add_to_photo`, `photowall_tags_remove_from_photo` |
| R-02-g | 相册 API | `ffi/src/albums.rs` | `photowall_albums_get_all_json`, `photowall_albums_add_photo` |
| R-02-h | 回收站 API | `ffi/src/trash.rs` | `photowall_trash_soft_delete`, `photowall_trash_restore` |
| R-02-i | 设置 API | `ffi/src/settings.rs` | `photowall_get_settings_json`, `photowall_save_settings_json` |
| R-02-j | 文件夹 API | `ffi/src/folders.rs` | `photowall_get_folder_tree_json`（以及 folder children/count 等） |
| R-02-k | 头文件生成 | `ffi/include/photowall.h` | C 头文件（供 Qt 使用） |
| R-02-l | 照片批量状态/操作 API | `ffi/src/photo_ops.rs` | `photowall_set_photos_favorite`, `photowall_set_photo_rating`, `photowall_soft_delete_photos`（等） |
| R-02-m | 取消 API | `ffi/src/jobs.rs` | `photowall_cancel_job(handle, job_id)`（至少覆盖 index/import/export） |

验收标准：

- 编译产出 `photowall_core.dll`
- 提供 `photowall.h`（含：初始化/销毁、字符串释放、last_error、event callback、JobId、cancel_job）
- 提供最小 C 测试程序（可加载 DLL、调用 1-2 个 API、收事件、取消任务）

---

### R-03: photowall-tauri 适配（可选）

| 属性 | 值 |
|------|-----|
| **文件** | `src-tauri/crates/photowall-tauri/` 或原 `src-tauri/src/` |
| **负责人角色** | Rust 开发 |
| **可并行** | 与 R-02 并行 |
| **输入** | photowall-core |
| **输出** | 现有 Tauri 版本继续可用 |

子任务清单：

| ID | 任务 | 说明 |
|----|------|------|
| R-03-a | commands 层改为调用 core | 保持 IPC 接口不变 |
| R-03-b | 实现 TauriEventSink | 桥接 core 事件到 Tauri emit |
| R-03-c | 回归测试 | 确保现有功能不受影响 |

---

## C++ 模块任务（C-xx）

### C-01: RustBridge

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/RustBridge.h`, `RustBridge.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 依赖 R-02 头文件 |
| **输入** | `photowall.h` |
| **输出** | Qt 可用的 Rust 调用封装 |

接口定义（建议）：

```cpp
class RustBridge : public QObject {
    Q_OBJECT
public:
    static RustBridge* instance();
    bool initialize(const QString& configJson);
    void shutdown();
    QString lastError() const;

    // 同步 API
    QJsonObject getSettings();
    QJsonArray getAllTags();
    QJsonArray getAllAlbums();
    QString getThumbnailPath(const QString& fileHash, const QString& size);

    // 异步 API（触发后通过信号返回）
    void getPhotosAsync(int limit, const QString& cursorJson);
    void searchPhotosAsync(const QString& filtersJson, int limit, const QString& cursorJson);
    quint64 indexDirectoryAsync(const QString& path); // 返回 JobId
    void enqueueThumbnailsBatch(const QJsonArray& requests);

    // 取消
    void cancelJob(quint64 jobId);

signals:
    // 事件信号（从 Rust 回调转发）
    void eventReceived(const QString& eventName, const QJsonValue& payload); // payload 可能是 object/string/bool/number/array
    void photosReady(const QJsonArray& photos, const QString& nextCursor);
    void indexProgress(int processed, int total, const QString& currentFile);
    void indexFinished(int indexed, int skipped, int failed);
    void indexCancelled(quint64 jobId);
    void thumbnailReady(
        const QString& fileHash,
        const QString& size,
        const QString& path,
        bool isPlaceholder,
        const QString& placeholderBase64,
        bool useOriginal
    );
    void settingsChanged(const QJsonObject& settings);

private:
    void* m_handle = nullptr;  // Rust PhotowallHandle
    static void eventCallback(const char* name, const char* payload, void* userData);
};
```

说明：

- Rust 回调可能来自后台线程；C++ 必须通过 `Qt::QueuedConnection` 转回 UI 线程后再触发上述 signals。

---

### C-02: PhotoModel

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/PhotoModel.h`, `PhotoModel.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 是 |
| **输入** | RustBridge 信号 |
| **输出** | QAbstractListModel 供 QML GridView 使用 |

接口定义（建议）：

```cpp
class PhotoModel : public QAbstractListModel {
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(bool loading READ loading NOTIFY loadingChanged)
    Q_PROPERTY(bool hasMore READ hasMore NOTIFY hasMoreChanged)

public:
    enum Roles {
        PhotoIdRole = Qt::UserRole + 1,
        FilePathRole,
        FileNameRole,
        FileHashRole,
        WidthRole,
        HeightRole,
        DateTakenRole,
        IsFavoriteRole,
        RatingRole,
        SelectedRole
    };

    int rowCount(const QModelIndex& parent = QModelIndex()) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    Q_INVOKABLE void loadInitial();
    Q_INVOKABLE void loadMore();
    Q_INVOKABLE void refresh();
    Q_INVOKABLE void setSearchFilters(const QJsonObject& filters);

signals:
    void countChanged();
    void loadingChanged();
    void hasMoreChanged();
};
```

---

### C-03: ThumbnailProvider

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/ThumbnailProvider.h`, `ThumbnailProvider.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 是 |
| **输入** | RustBridge |
| **输出** | QQuickAsyncImageProvider |

接口定义（建议）：

```cpp
class ThumbnailProvider : public QQuickAsyncImageProvider {
public:
    ThumbnailProvider(RustBridge* bridge);
    QQuickImageResponse* requestImageResponse(
        const QString& id,  // 格式: "fileHash/size" 如 "abc123/small"
        const QSize& requestedSize
    ) override;

private:
    RustBridge* m_bridge;
    // QQuickAsyncImageProvider 的请求可能发生在非 UI 线程；避免在这里缓存/操作 QPixmap。
    QCache<QString, QImage> m_cache;
};
```

QML 使用：

```qml
Image {
    source: "image://thumbnail/" + fileHash + "/small"
    asynchronous: true
}
```

---

### C-04: PhotoStore

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/PhotoStore.h`, `PhotoStore.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 是 |
| **输入** | RustBridge, PhotoModel |
| **输出** | QML 单例，全局状态管理 |

接口定义（建议）：

```cpp
class PhotoStore : public QObject {
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    Q_PROPERTY(PhotoModel* photoModel READ photoModel CONSTANT)
    // QML 侧更容易消费 list；内部可用 QSet 做去重，暴露时转为 QVariantList。
    Q_PROPERTY(QVariantList selectedIds READ selectedIds NOTIFY selectionChanged)
    Q_PROPERTY(int selectedCount READ selectedCount NOTIFY selectionChanged)
    Q_PROPERTY(QString searchQuery READ searchQuery WRITE setSearchQuery NOTIFY searchQueryChanged)
    Q_PROPERTY(QJsonObject searchFilters READ searchFilters WRITE setSearchFilters NOTIFY searchFiltersChanged)

public:
    Q_INVOKABLE void selectPhoto(int photoId, bool append = false);
    Q_INVOKABLE void toggleSelection(int photoId);
    Q_INVOKABLE void selectRange(int fromId, int toId);
    Q_INVOKABLE void selectAll();
    Q_INVOKABLE void clearSelection();

    Q_INVOKABLE void setFavorite(bool favorite);  // 批量操作选中项
    Q_INVOKABLE void setRating(int rating);
    Q_INVOKABLE void deleteSelected();
    Q_INVOKABLE void addTagToSelected(int tagId);
    Q_INVOKABLE void removeTagFromSelected(int tagId);

    // 长任务控制
    Q_INVOKABLE void cancelJob(quint64 jobId);

signals:
    void selectionChanged();
    void searchQueryChanged();
    void searchFiltersChanged();
};
```

---

### C-05: EventDispatcher

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/EventDispatcher.h`, `EventDispatcher.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 是 |
| **输入** | RustBridge::eventReceived 信号 |
| **输出** | 将 Rust 事件分发到各个 Store/Model |

职责：

- 接收 RustBridge 的 `eventReceived` 信号
- 根据 `eventName` 分发到对应处理器（Index/Import/Export/AutoScan/Thumbnail/Settings 等）
- 确保在 Qt 主线程执行（必要时做二次投递/排队）

---

### C-06: FolderTreeModel（FoldersPage 依赖）

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/src/core/FolderTreeModel.h`, `FolderTreeModel.cpp` |
| **负责人角色** | C++ 开发 |
| **可并行** | 是 |
| **输入** | RustBridge（`photowall_get_folder_tree_json` 等） |
| **输出** | QAbstractItemModel 供 QML TreeView 使用 |

说明：

- 建议用 `QAbstractItemModel`（树结构）或 `QStandardItemModel`（实现更快）承载文件夹树
- 与 `PhotoModel` 的“按文件夹过滤”联动（点击节点后刷新网格）

---

## QML 组件任务（Q-xx）

### Q-01: main.qml + 路由骨架

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/qml/main.qml`, `qml/Router.qml` |
| **负责人角色** | QML 开发 |
| **可并行** | 是 |

产出：

- 主窗口框架（无边框 + 自定义标题栏）
- StackView 路由
- 页面切换动画

---

### Q-02: PhotoThumbnail.qml

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/qml/components/PhotoThumbnail.qml` |
| **负责人角色** | QML 开发 |
| **可并行** | 是 |
| **参考** | `src/components/photo/PhotoThumbnail.tsx` |

Props 接口（建议）：

```qml
Item {
    property int photoId
    property string fileHash
    property string filePath
    property bool selected: false
    property bool isFavorite: false
    property int rating: 0

    signal clicked(int photoId)
    signal doubleClicked(int photoId)
    signal rightClicked(int photoId, point pos)
}
```

---

### Q-03: PhotoGrid.qml

| 属性 | 值 |
|------|-----|
| **文件** | `photowall-qt/qml/components/PhotoGrid.qml` |
| **负责人角色** | QML 开发 |
| **可并行** | 依赖 Q-02 |
| **参考** | `src/components/photo/PhotoGrid/index.tsx` |

Props 接口（建议）：

```qml
GridView {
    property alias model: grid.model
    property int thumbnailSize: 200
    property bool groupByDate: false
    property bool embedded: false

    signal photoClicked(int photoId)
    signal photoDoubleClicked(int photoId)
    signal contextMenuRequested(int photoId, point pos)
    signal loadMoreRequested()
}
```

---

### Q-04 ~ Q-07: 其他通用组件

| ID | 文件 | 参考 | 可并行 |
|----|------|------|--------|
| Q-04 | `Toolbar.qml` | `src/components/layout/Toolbar.tsx` | 是 |
| Q-05 | `Sidebar.qml` | `src/components/sidebar/Sidebar.tsx` | 是 |
| Q-06 | `SearchPanel.qml` | `src/components/search/SearchPanel.tsx` | 是 |
| Q-07 | `ContextMenu.qml` | `src/components/common/ContextMenu.tsx` | 是 |

---

## 页面任务（P-xx）

| ID | 文件 | 参考 | 依赖 | 可并行 |
|----|------|------|------|--------|
| P-01 | `HomePage.qml` | `src/pages/HomePage.tsx` | Q-03, Q-04 | 依赖完成后 |
| P-02 | `SettingsPage.qml` | `src/pages/SettingsPage.tsx` | 无 | **最先开发** |
| P-03 | `FavoritesPage.qml` | `src/pages/FavoritesPage.tsx` | Q-03 | 是 |
| P-04 | `TrashPage.qml` | `src/pages/TrashPage.tsx` | Q-03 | 是 |
| P-05 | `FoldersPage.qml` | `src/pages/FoldersPage.tsx` | Q-03, C-06, TreeView | 是 |
| P-06 | `TagsPage.qml` | `src/pages/TagsPage.tsx` | 无 | 是 |
| P-07 | `AlbumsPage.qml` | `src/pages/AlbumsPage.tsx` | 无 | 是 |

---

## 弹窗/对话框任务（D-xx）

| ID | 文件 | 参考 | 可并行 |
|----|------|------|--------|
| D-01 | `PhotoViewer.qml` | `src/components/photo/PhotoViewer.tsx` | 是 |
| D-02 | `TagManager.qml` | `src/components/tag/TagManager.tsx` | 是 |
| D-03 | `AlbumManager.qml` | `src/components/album/AlbumManager.tsx` | 是 |
| D-04 | `ConfirmDialog.qml` | `src/components/common/ConfirmDialog.tsx` | 是 |
| D-05 | `ScanProgressDialog.qml` | `src/components/common/ScanProgressDialog.tsx` | 是（需支持取消 job） |

---

## 集成测试任务（T-xx）

| ID | 任务 | 说明 |
|----|------|------|
| T-01 | 端到端测试 | 索引 → 浏览 → 搜索 → 标签 → 回收站 |
| T-02 | 性能测试 | 10000+ 照片滚动、内存占用、启动时间 |
| T-03 | 打包测试 | NSIS/MSI 安装包、DLL 依赖检查 |
| T-04 | 取消测试 | 索引/导入/导出可取消；取消后 DB 不损坏、UI 状态可恢复 |

---

## 并行开发建议

第一批（可立即开始）：

- R-01: photowall-core（Rust）
- P-02: SettingsPage.qml（QML，熟悉 Qt）
- Q-01: main.qml 骨架（QML）

第二批（R-01 完成后）：

- R-02: photowall-ffi（Rust）
- R-03: photowall-tauri 适配（Rust，可选）
- C-01 ~ C-06: 所有 C++ 模块（C++，可并行）
- Q-02 ~ Q-07: 所有 QML 组件（QML，可并行）

第三批（C++ 模块完成后）：

- P-01, P-03 ~ P-07: 所有页面（QML，可并行）
- D-01 ~ D-05: 所有弹窗（QML，可并行）

最后：

- T-01 ~ T-04: 集成测试

---

## 时间估算（多人并行）

| 阶段 | 内容 | 预估 | 并行度 |
|------|------|------|--------|
| 阶段零 | photowall-core 拆分 | 1-2 周 | 1 人 |
| 阶段一 | photowall-ffi + C++ 模块 | 2 周 | 2-3 人并行 |
| 阶段二 | QML 组件 + 页面 | 3-4 周 | 2-3 人并行 |
| 阶段三 | 集成测试 + 优化 | 1-2 周 | 全员 |
| **总计** | | **7-10 周** | |
