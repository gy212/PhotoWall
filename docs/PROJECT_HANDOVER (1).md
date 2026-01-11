# PhotoWall 项目交接文档

> 本文档为 PhotoWall 项目的完整技术交接文档

---

## 目录

- [0. 交接速读（必看）](#0-交接速读必看)
  - [0.1 一句话架构](#01-一句话架构)
  - [0.2 关键数据落盘位置](#02-关键数据落盘位置)
  - [0.3 必知事件与排障入口](#03-必知事件与排障入口)
- [1. 项目概述](#1-项目概述)
  - [1.1 项目简介](#11-项目简介)
  - [1.2 应用标识](#12-应用标识)
- [2. 技术栈](#2-技术栈)
  - [2.1 前端技术](#21-前端技术)
  - [2.2 后端技术（Rust）](#22-后端技术rust)
- [3. 项目结构](#3-项目结构)
  - [3.1 前端目录 (src/)](#31-前端目录-src)
  - [3.2 后端目录 (src-tauri/src/)](#32-后端目录-src-taurisrc)
- [4. 数据库设计](#4-数据库设计)
  - [4.1 数据库位置](#41-数据库位置)
  - [4.2 数据库配置](#42-数据库配置)
  - [4.3 核心表结构](#43-核心表结构)
  - [4.4 全文搜索 (FTS5)](#44-全文搜索-fts5)
- [5. 状态管理](#5-状态管理)
  - [5.1 Zustand Stores](#51-zustand-stores)
  - [5.2 TanStack Query](#52-tanstack-query)
- [6. IPC 通信](#6-ipc-通信)
  - [6.1 通信模式](#61-通信模式)
  - [6.2 主要 API 分类](#62-主要-api-分类)
  - [6.3 事件列表（前端监听）](#63-事件列表前端监听)
- [7. 核心功能实现](#7-核心功能实现)
  - [7.1 照片索引流程](#71-照片索引流程)
  - [7.2 缩略图生成](#72-缩略图生成)
  - [7.3 虚拟滚动](#73-虚拟滚动)
  - [7.4 游标分页](#74-游标分页)
  - [7.5 前端日志系统](#75-前端日志系统)
- [8. 核心组件详解](#8-核心组件详解)
  - [8.1 UI 设计系统](#81-ui-设计系统)
  - [8.2 HomePage.tsx（仪表盘）](#82-homepagetsx仪表盘)
  - [8.3 PhotoGrid.tsx（网格）](#83-photogridtsx网格)
  - [8.4 PhotoThumbnail.tsx（缩略图卡片）](#84-photothumbnailtsx缩略图卡片)
  - [8.5 PhotoViewer.tsx（查看器）](#85-photoviewertsx查看器)
  - [8.6 缩略图加载栈](#86-缩略图加载栈)
  - [8.7 SettingsPage.tsx（设置）](#87-settingspagetsx设置)
  - [8.8 Sidebar.tsx（备用）](#88-sidebartsx备用)
  - [8.9 SearchPanel.tsx（搜索面板）](#89-searchpaneltsx搜索面板)
  - [8.10 TagRibbon.tsx（快速筛选）](#810-tagribbontsx快速筛选)
  - [8.11 BatchTagSelector.tsx（批量标签）](#811-batchtagselectortsx批量标签)
  - [8.12 PhotoEditor.tsx（照片编辑器）](#812-photoeditortsx照片编辑器)
- [9. 后端服务详解](#9-后端服务详解)
  - [9.1 AppState（应用状态）](#91-appstate应用状态)
  - [9.2 Scanner Service](#92-scanner-service)
  - [9.3 Indexer Service](#93-indexer-service)
  - [9.4 Metadata Service](#94-metadata-service)
  - [9.5 Thumbnail Service](#95-thumbnail-service)
  - [9.6 WIC Service（Windows）](#96-wic-servicewindows)
  - [9.7 LibRaw FFI](#97-libraw-ffi)
  - [9.8 SettingsManager（设置落盘与事件）](#98-settingsmanager设置落盘与事件)
  - [9.9 Window Effects（原生 Acrylic）](#99-window-effects原生-acrylic)
  - [9.10 Folder Sync（当前实现的真实含义）](#910-folder-sync当前实现的真实含义)
  - [9.11 Search（FTS5 + Filters）](#911-searchfts5--filters)
  - [9.12 Tags（标签）](#912-tags标签)
  - [9.13 Editor（照片编辑）](#913-editor照片编辑)
- [10. 性能优化](#10-性能优化)
  - [10.1 数据库优化](#101-数据库优化)
  - [10.2 前端优化](#102-前端优化)
  - [10.3 后端优化](#103-后端优化)
  - [10.4 缩略图优化](#104-缩略图优化)
- [11. 开发指南](#11-开发指南)
  - [11.1 开发命令](#111-开发命令)
  - [11.2 路径别名](#112-路径别名)
  - [11.3 提交规范](#113-提交规范)
  - [11.4 错误处理](#114-错误处理)
- [12. 配置文件](#12-配置文件)
  - [12.1 tauri.conf.json](#121-tauriconfjson)
  - [12.2 应用设置](#122-应用设置)
- [13. 数据流图](#13-数据流图)
  - [13.1 照片加载流程](#131-照片加载流程)
  - [13.2 照片索引流程](#132-照片索引流程)
- [14. 类型定义](#14-类型定义)
  - [14.1 核心类型](#141-核心类型-srctypesindexts)
- [15. 页面功能详解](#15-页面功能详解)
- [16. 关键代码位置索引](#16-关键代码位置索引)
  - [16.1 前端关键文件](#161-前端关键文件)
  - [16.2 后端关键文件](#162-后端关键文件)
  - [16.3 Zustand Stores](#163-zustand-stores)
  - [16.4 代码统计](#164-代码统计)
- [17. 部署与构建](#17-部署与构建)
- [18. 注意事项](#18-注意事项)
- [19. 联系方式](#19-联系方式)
- [附录 A: 完整 API 列表](#附录-a-完整-api-列表)

---

## 0. 交接速读（必看）

### 0.1 一句话架构

PhotoWall 的主循环可以概括为：

1. **索引**：前端选文件夹 → `index_directory/index_directories` → Rust 扫描/哈希/EXIF → 写入 SQLite
2. **查询**：前端用 `get_photos_cursor/search_photos_cursor` 拉取数据（游标分页）→ 网格/时间线虚拟滚动渲染
3. **缩略图**：前端 `useThumbnail/useThumbnailProgressive` → 先查内存/磁盘缓存 → 未命中就 enqueue → 后端生成后发 `thumbnail-ready` 事件推送

把“卡顿/慢/不显示”的问题拆开，基本都落在上述 3 条链路之一。

### 0.2 关键数据落盘位置

下面是“真正会在用户机器上留下东西”的路径（以 Windows 为主）：

- **数据库（SQLite）**：`%APPDATA%\\PhotoWall\\photowall.db`（来源：`src-tauri/src/db/connection.rs` 的 `default_db_path()`）
- **缩略图缓存**：`%APPDATA%\\PhotoWall\\Thumbnails\\{tiny|small|medium|large}\\{file_hash}.webp`（来源：`src-tauri/src/services/thumbnail.rs` 的 `default_cache_dir()` + `get_cache_path()`）
- **设置文件**：`{app_data_dir}\\settings.json`（来源：`src-tauri/src/services/settings.rs` 的 `app.path().app_data_dir()`；Windows 下具体目录以 Tauri 运行时解析为准，可能是 `PhotoWall/` 或 `com.photowall.app/`）
- **日志目录（当前实现）**：`{current_dir}\\logs\\backend.log.YYYY-MM-DD` 与 `frontend.YYYY-MM-DD.log`（来源：`src-tauri/src/lib.rs` 的 `get_log_dir()`）

### 0.3 必知事件与排障入口

- **后端事件**：缩略图 `thumbnail-ready`、索引 `index-progress/index-finished`、刷新元数据 `refresh-progress/refresh-finished`、设置 `settings-changed`
- **排障最短路径**：先看 `logs/`（前端/后端都有），再看数据库表 `photos`/`schema_version`，最后看缩略图缓存目录是否写入

## 1. 项目概述

### 1.1 项目简介

PhotoWall 是一款 Windows 桌面照片管理软件，采用 **Tauri 2.0 + React 19 + TypeScript + Rust** 技术栈构建。

主要功能：
- 照片浏览与管理（网格视图、时间线视图）
- 文件夹导入与索引
- 标签管理、相册管理
- 收藏功能、回收站（软删除）
- 全文搜索（FTS5）
- EXIF 元数据提取
- 照片编辑（基础调整/旋转翻转，非 RAW）
- RAW 格式支持（LibRaw）
- 缩略图生成与缓存（WIC 加速）
- 前端日志持久化

### 1.2 应用标识

- 应用名称: PhotoWall
- 版本: 0.1.0
- 标识符: com.photowall.app
- 窗口尺寸: 1200x800（最小 800x600）


---

## 2. 技术栈

### 2.1 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1.0 | UI 框架 |
| TypeScript | 5.8.x | 类型安全 |
| Vite | 7.0.x | 构建工具 |
| Tailwind CSS | 4.1.x | 样式框架 |
| Zustand | 5.0.x | 状态管理 |
| TanStack Query | 5.90.x | 服务端状态 |
| React Router | 7.9.x | 路由管理 |
| react-virtuoso | 4.16.x | 虚拟滚动 |

### 2.2 后端技术（Rust）

| 技术 | 版本 | 用途 |
|------|------|------|
| Tauri | 2.x | 桌面应用框架 |
| rusqlite | 0.31 | SQLite 数据库 |
| tokio | 1.x | 异步运行时 |
| image | 0.25 | 图像处理 |
| rawloader | 0.37 | RAW 格式解码 |
| kamadak-exif | 0.6 | EXIF 提取 |
| rayon | 1.x | 并行处理 |
| xxhash-rust | 0.8 | 文件哈希 |
| windows | 0.62 | WIC 图像处理 |
| base64 | 0.22 | 占位图编码 |
| tracing | 0.1 | 日志系统 |


---

## 3. 项目结构

### 3.1 前端目录 (src/)

```
src/
├── main.tsx                # React 入口
├── App.tsx                 # 根组件（路由配置）
├── components/             # React 组件
│   ├── layout/             # 布局组件
│   │   ├── Layout.tsx      # 主布局
│   │   ├── Toolbar.tsx     # 顶部工具栏
│   │   └── StatusBar.tsx   # 底部状态栏
│   ├── sidebar/Sidebar.tsx # 侧边导航
│   ├── photo/              # 照片组件
│   │   ├── PhotoGrid.tsx   # 照片网格（重新导出）
│   │   ├── PhotoGrid/      # 照片网格模块
│   │   │   ├── index.tsx   # 主组件
│   │   │   ├── types.ts    # 类型定义
│   │   │   ├── hooks/      # 自定义 Hooks
│   │   │   │   ├── useGridLayout.ts      # 列数计算、行分组
│   │   │   │   ├── useScrollSync.ts      # 嵌入模式滚动同步
│   │   │   │   └── useThumbnailPrefetch.ts # 缩略图预取
│   │   │   ├── components/ # 子组件
│   │   │   │   ├── GridScroller.tsx      # 自定义 Scroller
│   │   │   │   ├── GridFooter.tsx        # Footer 组件
│   │   │   │   ├── GridRow.tsx           # 单行渲染
│   │   │   │   ├── DateGroupSection.tsx  # 日期分组区块
│   │   │   │   └── EmptyState.tsx        # 空状态
│   │   │   └── utils/
│   │   │       └── scrollbarMode.ts      # 滚动条模式检测
│   │   ├── PhotoThumbnail.tsx
│   │   ├── PhotoViewer.tsx # 全屏查看器
│   │   ├── PhotoEditor.tsx # 照片编辑器
│   │   ├── TimelineView.tsx
│   │   └── FolderTree.tsx
│   ├── album/              # 相册组件
│   ├── tag/                # 标签组件
│   └── common/             # 通用组件
├── pages/                  # 页面
│   ├── HomePage.tsx        # 首页
│   ├── AlbumsPage.tsx
│   ├── TagsPage.tsx
│   ├── FavoritesPage.tsx
│   ├── FoldersPage.tsx
│   ├── TrashPage.tsx
│   └── SettingsPage.tsx
├── stores/                 # Zustand 状态
│   ├── photoStore.ts
│   ├── selectionStore.ts
│   ├── navigationStore.ts
│   └── folderStore.ts
├── hooks/                  # 自定义 Hooks
│   ├── useThumbnail.ts
│   ├── useScanner.ts
│   └── useTheme.ts
├── services/               # 服务层
│   ├── api.ts              # Tauri IPC 封装（重新导出）
│   ├── api/                # API 模块
│   │   ├── index.ts        # 统一导出
│   │   ├── types.ts        # API 接口定义
│   │   ├── scanner.ts      # 扫描和索引
│   │   ├── photos.ts       # 照片查询
│   │   ├── tags.ts         # 标签管理
│   │   ├── albums.ts       # 相册管理
│   │   ├── utils.ts        # 工具函数
│   │   ├── fileOps.ts      # 文件操作
│   │   ├── settings.ts     # 设置管理
│   │   ├── sync.ts         # 文件夹同步
│   │   ├── trash.ts        # 回收站功能
│   │   ├── folders.ts      # 文件夹视图
│   │   ├── blur.ts         # 桌面模糊 + Composition Backdrop
│   │   └── editor.ts       # 照片编辑
│   ├── logger.ts           # 前端日志服务
│   └── ThumbnailStore.ts   # 缩略图事件缓存
└── types/index.ts          # 类型定义
```


### 3.2 后端目录 (src-tauri/src/)

```
src-tauri/src/
├── main.rs                 # 入口
├── lib.rs                  # 应用初始化、命令注册
├── utils/error.rs          # 错误类型
├── models/                 # 数据模型
│   ├── photo.rs            # Photo 模型
│   ├── tag.rs              # Tag 模型
│   ├── album.rs            # Album 模型
│   └── settings.rs         # Settings 模型
├── db/                     # 数据库层
│   ├── connection.rs       # 连接管理
│   ├── schema.rs           # Schema 定义
│   ├── photo_dao.rs        # Photo DAO
│   ├── tag_dao.rs          # Tag DAO
│   └── album_dao.rs        # Album DAO
├── services/               # 业务逻辑
│   ├── scanner.rs          # 目录扫描
│   ├── indexer.rs          # 照片索引
│   ├── metadata.rs         # EXIF 提取
│   ├── hasher.rs           # 文件哈希
│   ├── thumbnail.rs        # 缩略图生成
│   ├── thumbnail_queue.rs  # 缩略图队列
│   ├── wic.rs              # WIC 图像处理（Windows）
│   └── libraw.rs           # LibRaw FFI
└── commands/               # Tauri IPC 命令
    ├── scanner.rs          # 扫描命令
    ├── search.rs           # 搜索命令
    ├── tags.rs             # 标签命令
    ├── albums.rs           # 相册命令
    ├── thumbnail.rs        # 缩略图命令
    ├── file_ops.rs         # 文件操作
    ├── folders.rs          # 文件夹命令
    └── logging.rs          # 前端日志命令
```


---

## 4. 数据库设计

### 4.1 数据库位置

默认数据库路径（Windows）：`%APPDATA%\\PhotoWall\\photowall.db`

来源：`src-tauri/src/db/connection.rs` 的 `default_db_path()`。

> 说明：缩略图与设置文件**不完全同路径**（缩略图用 `dirs::data_dir()`，设置用 Tauri 的 `app_data_dir()`），排障时不要只盯着一个目录。

### 4.2 数据库配置

数据库连接初始化时会执行以下 PRAGMA（来源：`src-tauri/src/db/connection.rs` 的 `configure()`）：

- `journal_mode = WAL`（并发读写）
- `synchronous = NORMAL`（性能/安全折中）
- `foreign_keys = ON`
- `cache_size = -64000`（约 64MB，负数代表 KB）
- `temp_store = MEMORY`
- `mmap_size = 268435456`（256MB）
- `busy_timeout = 5000`（5 秒）

### 4.3 核心表结构

#### photos 表
```sql
CREATE TABLE photos (
    photo_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path       TEXT NOT NULL UNIQUE,
    file_name       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    file_hash       TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    format          TEXT,
    date_taken      TEXT,
    date_added      TEXT NOT NULL,
    date_modified   TEXT,
    camera_model    TEXT,
    lens_model      TEXT,
    focal_length    REAL,
    aperture        REAL,
    iso             INTEGER,
    shutter_speed   TEXT,
    gps_latitude    REAL,
    gps_longitude   REAL,
    orientation     INTEGER DEFAULT 1,
    rating          INTEGER DEFAULT 0 CHECK(rating >= 0 AND rating <= 5),
    is_favorite     INTEGER DEFAULT 0,
    is_deleted      INTEGER DEFAULT 0,
    deleted_at      TEXT
);
```

#### tags 表
```sql
CREATE TABLE tags (
    tag_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name        TEXT NOT NULL UNIQUE,
    color           TEXT,
    date_created    TEXT NOT NULL
);
```

#### albums 表
```sql
CREATE TABLE albums (
    album_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    album_name      TEXT NOT NULL UNIQUE,
    description     TEXT,
    cover_photo_id  INTEGER REFERENCES photos(photo_id),
    date_created    TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0
);
```

#### 关联表
```sql
-- 照片-标签关联
CREATE TABLE photo_tags (
    photo_id    INTEGER NOT NULL REFERENCES photos(photo_id),
    tag_id      INTEGER NOT NULL REFERENCES tags(tag_id),
    date_created TEXT NOT NULL,
    PRIMARY KEY (photo_id, tag_id)
);

-- 相册-照片关联
CREATE TABLE album_photos (
    album_id    INTEGER NOT NULL REFERENCES albums(album_id),
    photo_id    INTEGER NOT NULL REFERENCES photos(photo_id),
    sort_order  INTEGER DEFAULT 0,
    date_added  TEXT NOT NULL,
    PRIMARY KEY (album_id, photo_id)
);
```

#### scan_directories（可扩展点）
用于记录“已扫描/被启用”的目录（当前版本主要用于未来自动扫描/增量扫描）：

```sql
CREATE TABLE scan_directories (
    dir_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    dir_path    TEXT NOT NULL UNIQUE,
    last_scan   TEXT,
    is_active   INTEGER DEFAULT 1
);
```

#### schema_version + 迁移
`schema_version` 用于记录迁移版本；当前 `SCHEMA_VERSION = 3`（见：`src-tauri/src/db/schema.rs`）。

### 4.4 全文搜索 (FTS5)

```sql
CREATE VIRTUAL TABLE photos_fts USING fts5(
    file_name,
    file_path,
    camera_model,
    lens_model,
    content='photos',
    content_rowid='photo_id'
);
```

自动同步触发器：INSERT/UPDATE/DELETE 时自动更新 FTS 索引。


---

## 5. 状态管理

### 5.1 Zustand Stores

#### photoStore.ts
```typescript
interface PhotoState {
  photos: Photo[]           // 当前照片列表
  totalCount: number        // 总数
  loading: boolean          // 加载状态
  error: string | null      // 错误信息
  sortOptions: SortOptions  // 排序选项
  viewMode: ViewMode        // 视图模式 (grid/timeline)
  thumbnailSize: number     // 缩略图尺寸
  searchQuery: string       // 搜索关键词
}
```

#### selectionStore.ts
```typescript
interface SelectionState {
  selectedIds: Set<number>  // 选中的照片 ID
  lastSelectedId: number | null  // 最后选中的 ID（用于 Shift 多选）
}
```

#### navigationStore.ts
```typescript
interface NavigationState {
  activeSection: 'all' | 'folders' | 'albums' | 'tags' | 'favorites'
  currentFolderPath: string | null
  currentAlbumId: number | null
  currentTagId: number | null
}
```

#### folderStore.ts
```typescript
interface FolderState {
  folderStats: FolderStats | null  // 文件夹树
  selectedFolderPath: string | null
  photos: Photo[]
  includeSubfolders: boolean
  expandedPaths: Set<string>
}
```

#### settingsStore.ts（前端本地持久化：主要承载“窗口外观”）
`src/stores/settingsStore.ts` 使用 Zustand `persist` 写入 `localStorage`（key=`photowall-settings`）。当前代码里它主要用于：

- 保存 `windowOpacity/windowTransparency`（并由 `Layout.tsx` 调用 `apply_window_settings` 下发到原生窗口）
- 历史遗留字段（如 watchedFolders、workerThreads 等）与后端 `AppSettings` **不是同一个来源**；现阶段以 `get_settings/save_settings` 的后端设置文件为主，前端 store 作为 UI/交互层缓存。

### 5.2 TanStack Query

用于服务端状态管理，配置：
- staleTime: 30 分钟
- gcTime: 1 小时
- 支持无限滚动（useInfiniteQuery）


---

## 6. IPC 通信

### 6.1 通信模式

前端通过 `@tauri-apps/api/core` 的 `invoke` 函数调用 Rust 命令：

```typescript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('get_photos', {
  pagination: { page: 1, pageSize: 50 },
  sort: { field: 'dateTaken', order: 'desc' },
});
```

命名与序列化约定（非常重要，很多“参数传了但后端收不到”的坑都在这里）：

- **命令名**：Rust 侧基本为 snake_case（如 `get_photos_cursor`），前端 `invoke('get_photos_cursor', ...)` 直接使用该字符串。
- **参数/返回字段**：跨 IPC 的 struct 一般用 `#[serde(rename_all = "camelCase")]`，前端与后端对齐用 camelCase（如 `pageSize`、`photoId`、`fileHash`）。
- **前端封装层**：入口 `src/services/api.ts`（re-export），实现拆分在 `src/services/api/*`（按领域拆分）。

### 6.2 主要 API 分类

#### 扫描与索引
- `scan_directory(path)` - 扫描目录
- `index_directory(path)` - 索引目录到数据库
- `get_database_stats()` - 获取数据库统计

#### 照片查询
- `get_photos(pagination, sort)` - 分页获取照片
- `get_photos_cursor(limit, cursor, sort)` - 游标分页
- `search_photos(filters, pagination, sort)` - 搜索照片
- `search_photos_cursor(filters, limit, cursor, sort, includeTotal)` - 搜索照片（游标分页）
- `search_photos_simple(query, pagination)` - 简单文本搜索
- `get_photo(id)` - 获取单张照片
- `get_favorite_photos()` - 获取收藏照片
- `get_photos_by_tag(tagId)` - 按标签筛选
- `get_photos_by_album(albumId)` - 按相册筛选

#### 照片操作
- `set_photo_rating(id, rating)` - 设置评分
- `set_photo_favorite(id, favorite)` - 设置收藏
- `soft_delete_photos(ids)` - 软删除
- `restore_photos(ids)` - 恢复照片
- `permanent_delete_photos(ids)` - 永久删除

#### 标签管理
- `create_tag(name, color)` - 创建标签
- `get_all_tags()` - 获取所有标签
- `add_tag_to_photo(photoId, tagId)` - 添加标签
- `remove_tag_from_photo(photoId, tagId)` - 移除标签

#### 相册管理
- `create_album(name, description)` - 创建相册
- `get_all_albums()` - 获取所有相册
- `add_photo_to_album(albumId, photoId)` - 添加照片
- `set_album_cover(albumId, photoId)` - 设置封面

#### 缩略图
- `generate_thumbnail(sourcePath, fileHash, size)` - 生成缩略图
- `enqueue_thumbnail(...)` - 加入队列
- `get_thumbnail_cache_path(fileHash, size)` - 获取缓存路径

#### 文件夹
- `get_folder_tree()` - 获取文件夹树
- `get_photos_by_folder(path, includeSubfolders)` - 获取文件夹照片



#### 照片编辑
- `is_photo_editable(filePath)` - 是否可编辑（RAW 会返回 false）
- `apply_photo_edits(photoId, params, saveAsCopy)` - 应用编辑并保存
- `get_edit_preview(sourcePath, params, maxSize?)` - 获取编辑预览（Base64 JPEG）
---

### 6.3 事件列表（前端监听）

> 事件是 PhotoWall 的“第二条数据通道”：`invoke` 负责请求/响应，事件负责把后台任务的进度/结果推回 UI。

| 事件名 | 触发方 | payload（核心字段） | 典型用途 |
|---|---|---|---|
| `thumbnail-ready` | `src-tauri/src/services/thumbnail_queue.rs` | `fileHash,size,path,isPlaceholder,placeholderBase64?,useOriginal` | 缩略图生成后刷新单个格子 |
| `index-progress` | `src-tauri/src/commands/scanner.rs` | `total,processed,indexed,skipped,failed,currentFile?,percentage` | 导入/索引进度条 |
| `index-finished` | `src-tauri/src/commands/scanner.rs` | `indexed,skipped,failed,failedFiles[]` | 导入完成刷新列表 |
| `refresh-progress` | `src-tauri/src/commands/scanner.rs` | 进度字段（与 refresh 逻辑对应） | “刷新元数据/日期”进度 |
| `refresh-finished` | `src-tauri/src/commands/scanner.rs` | `total,updated,skipped,failed` | 刷新完成提示/刷新 UI |
| `thumbnail-pregenerate-started` | `src-tauri/src/commands/scanner.rs` | `total,queued` | 索引后后台预生成缩略图的提示 |
| `settings-changed` | `src-tauri/src/commands/settings.rs` | `AppSettings` | 设置变更后刷新 UI/行为 |

当前代码里有一处“事件与前端 Hook 预期不一致”：`src/hooks/useScanner.ts` 监听了 `scan-progress`/`index_photos`/`cancel_scan`，但后端并没有对应命令/事件；如果后续要启用这个 Hook，需要先补齐后端实现或删掉旧逻辑。

## 7. 核心功能实现

### 7.1 照片索引流程

```
1. 用户选择文件夹
2. Scanner 扫描目录，收集图片文件路径
3. Indexer 并行处理每个文件：
   - Hasher 计算 xxh3 哈希（用于去重）
   - Metadata 提取 EXIF 信息
   - 检查数据库是否已存在（按路径或哈希）
4. 批量插入数据库
5. 前端刷新照片列表
```

支持的图片格式：
- 以 `src-tauri/src/services/scanner.rs` 的 `SUPPORTED_FORMATS` 为准；当前包含：
  - 常规：jpg/jpeg/png/gif/bmp/webp/tiff/tif
  - HEIF：heic/heif
  - RAW：raw/cr2/cr3/nef/arw/dng/orf/rw2/pef/srw/raf
  - 备注：缩略图 RAW 判定更宽；扫描以 `SUPPORTED_FORMATS` 为准。

### 7.2 缩略图生成

#### 缩略图尺寸
后端定义（来源：`src-tauri/src/services/thumbnail.rs` 的 `ThumbnailSize::dimensions()`）：

- `tiny`: 50（渐进式加载的模糊占位图）
- `small`: 300（列表/网格主用，2x DPI 友好）
- `medium`: 500（更清晰的浏览）
- `large`: 800（查看器占位/更大预览）

#### 生成流程
```
1. 前端 hook 先查 ThumbnailStore 内存缓存（key = fileHash_size）
2. 未命中则调用后端快速路径 `get_thumbnail_cache_path(fileHash, size)` 查磁盘缓存
3. 仍未命中：`enqueue_thumbnail(...)` 加入优先级队列（后台线程生成）
4. 后端生成完成后发出 `thumbnail-ready` 事件，前端接收后更新 UI（无需轮询）

补充：如果直接调用 `generate_thumbnail(...)`，后端会先走一次“缓存命中立即返回”（在 limiter 之前），避免被并发任务拖慢。
```

#### WIC 加速（Windows）
使用 Windows Imaging Component 原生 API 进行图像解码和缩放：
- 支持高质量立方插值（WICBitmapInterpolationModeHighQualityCubic）
- BGRA 格式输出，高效处理
- 自动保持宽高比
- 比 image-rs 更快的解码速度

#### 缓存位置
默认缓存目录（Windows）：`%APPDATA%\\PhotoWall\\Thumbnails\\{size}\\{file_hash}.webp`

来源：`src-tauri/src/services/thumbnail.rs` 的 `default_cache_dir()` + `get_cache_path()`；当前实现**不做 hash 分桶**（目录结构很浅，查找成本主要来自文件数与磁盘）。

#### 并发控制
- **队列工作线程数**：启动时根据 `settings.performance.thumbnailThreads` 计算（0=自动，范围最终被 clamp 到 1..=8），见 `src-tauri/src/lib.rs`。
- **并发 limiter**：
  - 普通格式：`thumbnail_limiter = Semaphore(thumbnail_threads)`
  - RAW：`thumbnail_limiter_raw = Semaphore(1)`（隔离慢任务，避免堵塞普通缩略图）

#### 事件驱动架构
缩略图生成完成后通过 Tauri 事件通知前端：
```typescript
// 事件名: thumbnail-ready
interface ThumbnailReadyPayload {
  fileHash: string;
  size: string;
  path: string;
  isPlaceholder: boolean;      // RAW 提取失败时为 true
  placeholderBase64?: string;  // 占位图 Base64（WebP）
  useOriginal: boolean;        // 小图跳过逻辑：直接使用原图
}
```

几个容易忽略的细节（对排障非常关键）：

- **RAW 占位图**：后端会返回 `isPlaceholder=true` + `placeholderBase64`，且 `path` 可能为空字符串；前端会用 `data:image/webp;base64,...` 渲染，不写入磁盘缓存。
- **小图跳过缩略图生成**：当调用方传入原图尺寸（width/height），且像素数 < 200 万（`SMALL_IMAGE_PIXEL_THRESHOLD`），后端直接返回 `useOriginal=true` + `path=sourcePath`，避免生成 WebP（对小图更快、更省空间）。

#### ThumbnailStore（前端缓存）

完整实现（src/services/ThumbnailStore.ts）：
```typescript
export interface ThumbnailReadyPayload {
  fileHash: string;
  size: string;
  path: string;
  isPlaceholder: boolean;      // RAW 提取失败时为 true
  placeholderBase64?: string;  // 占位图 Base64（WebP）
}

type ThumbnailListener = (url: string) => void;

class ThumbnailStore {
  private cache = new Map<string, string>();           // 缓存：key -> url
  private listeners = new Map<string, Set<ThumbnailListener>>(); // 监听器
  private unlistenFunction: UnlistenFn | null = null;  // 事件取消函数
  private isListening = false;                         // 是否已监听

  // 懒初始化：首次订阅时开始监听事件
  async init() {
    if (this.isListening) return;
    this.isListening = true;

    this.unlistenFunction = await listen<ThumbnailReadyPayload>('thumbnail-ready', (event) => {
      const { fileHash, size, path, isPlaceholder, placeholderBase64 } = event.payload;
      const key = this.getCacheKey(fileHash, size);

      let url: string;
      if (isPlaceholder && placeholderBase64) {
        // 占位图：使用 data URL，不添加到持久缓存
        url = `data:image/webp;base64,${placeholderBase64}`;
      } else {
        // 正常缩略图：转换文件路径并添加到缓存
        url = convertFileSrc(path);
        this.cache.set(key, url);
      }

      // 通知所有监听器
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.forEach(listener => listener(url));
      }
    });
  }

  private getCacheKey(fileHash: string, size: string): string {
    return `${fileHash}_${size}`;
  }

  // 获取缓存的缩略图 URL
  get(fileHash: string, size: string): string | undefined {
    return this.cache.get(this.getCacheKey(fileHash, size));
  }

  // 手动设置缓存（用于预加载）
  set(fileHash: string, size: string, url: string) {
    const key = this.getCacheKey(fileHash, size);
    this.cache.set(key, url);
    // 同时通知监听器
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => listener(url));
    }
  }

  // 订阅缩略图更新，返回取消订阅函数
  subscribe(fileHash: string, size: string, listener: ThumbnailListener): () => void {
    const key = this.getCacheKey(fileHash, size);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    this.init(); // 确保已开始监听

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  // 清理资源
  cleanup() {
    if (this.unlistenFunction) {
      this.unlistenFunction();
      this.unlistenFunction = null;
    }
    this.isListening = false;
    this.cache.clear();
    this.listeners.clear();
  }
}

export const thumbnailStore = new ThumbnailStore();
```

#### 暖缓存
应用启动后 2 秒自动预加载最近 100 张照片的缩略图。

实现位置：src/components/layout/Layout.tsx
```typescript
function Layout() {
  const warmCacheTriggered = useRef(false);

  useEffect(() => {
    if (warmCacheTriggered.current) return;
    warmCacheTriggered.current = true;

    const timer = setTimeout(async () => {
      try {
        const result = await invoke<{ queued: number; alreadyCached: number }>(
          'warm_thumbnail_cache',
          { strategy: 'recent', limit: 100 }
        );
        if (result.queued > 0) {
          console.debug(`[暖缓存] 已入队 ${result.queued} 个任务，${result.alreadyCached} 个已有缓存`);
        }
      } catch (err) {
        console.debug('[暖缓存] 失败:', err);
      }
    }, 2000); // 启动后 2 秒

    return () => clearTimeout(timer);
  }, []);

  // ...
}
```

后端命令：`warm_thumbnail_cache`
- 参数：`strategy`（'recent'）、`limit`（100）
- 返回：`{ queued: number, alreadyCached: number }`

#### 索引后的后台预生成（“导入后不用等首屏慢慢生成”）
索引完成后（`index_directory/index_directories`）会在后台把“该文件夹下的照片”入队 `tiny+small` 两种尺寸（优先级为 0，见 `src-tauri/src/commands/scanner.rs` 的 `trigger_thumbnail_pregeneration`）。

### 7.3 虚拟滚动

PhotoWall 的“海量照片不卡 UI”主要依赖 `react-virtuoso`（来源：`src/components/photo/PhotoGrid/index.tsx`、`src/components/photo/TimelineView.tsx`）。

```typescript
<Virtuoso
  totalCount={rows.length}
  itemContent={rowContent}
  rangeChanged={handleRangeChanged}
  endReached={handleEndReached}
  overscan={overscanPx}
/>
```

关键点（建议交接后第一周就熟悉）：

- **行级虚拟化**：`PhotoGrid` 先把 `photos` 按容器宽度拆成 `rows`，Virtuoso 渲染行，行内用 CSS Grid 放置图片。
- **滚动时暂停“新缩略图请求”**：`PhotoThumbnail` 把 `isScrolling` 传给 `useThumbnailProgressive` 的 `suspendNewRequests`，避免快速划过时触发大量后台生成。
- **可见范围预取**：`rangeChanged` 内会对“可见行 ±2”做防抖（150ms）预取：
  - 批量调用 `check_thumbnails_cached`，把磁盘命中的项直接 `addToCacheExternal(...)` 塞进前端内存缓存。
  - 对未命中的项批量 `enqueue_thumbnails_batch`，并按“越靠近视口优先级越高”设置 `priority`。
- **两种渲染模式**：
  - 普通模式：Virtuoso 内部滚动（`PhotoGrid` 负责滚动容器）。
  - `embedded + groupByDateEnabled`：不使用虚拟滚动，直接渲染“按日期分组的静态网格”，交给父容器滚动（目前 HomePage 的“全部照片”就是这种嵌入模式）。

### 7.4 游标分页

为了高效处理大量数据，使用游标分页而非偏移分页：

```typescript
interface PhotoCursor {
  sortValue: string | number | null  // 排序字段值
  photoId: number                     // 用于相同值时的排序
}
```

优势：
- 避免 OFFSET 性能问题
- 支持实时数据变化
- 更适合无限滚动

### 7.5 前端日志系统

前端日志通过 Tauri IPC 持久化到磁盘，便于调试和问题排查。

#### 日志位置
`{current_dir}\\logs\\frontend.YYYY-MM-DD.log`

来源：`src-tauri/src/lib.rs` 的 `get_log_dir()` + `src-tauri/src/commands/logging.rs`。

> 注意：`current_dir` 在开发环境通常是项目根目录；在打包后的安装包里可能指向安装目录，未必可写，遇到“没有日志文件”先检查写权限。

#### 日志级别
- `debug`: 调试信息
- `info`: 一般信息
- `warn`: 警告
- `error`: 错误（包含堆栈信息）

#### Logger 类实现（src/services/logger.ts）
```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private async log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    // 1. 格式化日志：[ISO时间] [级别] 消息
    const formatted = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    // 2. 输出到控制台
    console[level](formatted, context || '');
    // 3. 通过 IPC 发送到后端（静默失败）
    invoke('log_frontend', { level, message, context }).catch(() => {});
  }

  debug(msg: string, ctx?: Record<string, unknown>) { this.log('debug', msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>) { this.log('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>) { this.log('warn', msg, ctx); }
  error(msg: string, err?: Error, ctx?: Record<string, unknown>) {
    const errorCtx = err ? { ...ctx, error: err.message, stack: err.stack } : ctx;
    this.log('error', msg, errorCtx);
  }
}

export const logger = new Logger();
```

#### 后端日志命令（src-tauri/src/commands/logging.rs）
```rust
#[tauri::command]
pub fn log_frontend(level: String, message: String, context: Option<serde_json::Value>) {
    let timestamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f");
    let context_str = context.map(|c| format!(" {}", c)).unwrap_or_default();
    let log_line = format!("{} [{}] {}{}\n", timestamp, level.to_uppercase(), message, context_str);

    // 追加写入日志文件
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(get_frontend_log_path())
    {
        let _ = file.write_all(log_line.as_bytes());
    }
}
```

#### 日志文件格式
```
2025-12-21T10:30:45.123 [INFO] 操作完成 {"context":"value"}
2025-12-21T10:30:46.456 [ERROR] 发生错误 {"error":"message","stack":"..."}
```

#### 自动清理
后端在启动时自动清理超过 7 天的旧日志文件（cleanup_old_logs 函数）。


---

## 8. 核心组件详解

### 8.1 UI 设计系统

#### 主框架布局（当前版本）
全局 Layout 采用“顶部 AppHeader + 页面自带布局”的方式（来源：`src/components/layout/Layout.tsx`）：

- 顶部固定 `AppHeader`（包含 `data-tauri-drag-region` 的拖拽层 + `WindowControls`）
- 主内容区域渲染路由 `<Outlet />`
- 未默认启用全局 Sidebar（`src/components/sidebar/Sidebar.tsx` 目前更像备用/遗留实现）

#### 主题系统（固定深色）
当前 UI 主题固定为深色：

- CSS 变量定义在 `src/index.css`，`:root` 与 `.dark` 值一致（保留 `.dark` 只是兼容历史代码）。
- `src/hooks/useTheme.ts` 会强制把 `document.documentElement` 加上 `dark` class。

#### 透明/毛玻璃策略（Tauri 原生 + CSS 降冲突）
桌面端窗口本身开启 `transparent: true` 并应用原生 Acrylic（见：`src-tauri/src/window_effects.rs`），因此：

- **整窗背景**：用 `.native-glass-panel`（不使用 `backdrop-filter`）避免拖动/缩放时闪烁。
- **Web UI 预览或局部容器**：可以使用 `.glass-panel`（带 `backdrop-filter`）。
- 更详细的方案评审与风险点：见 `docs/TRANSPARENCY_BLUR_IMPLEMENTATION_PLAN.md`。

#### 图标系统
- 主体：Material Symbols Outlined（见 `src/index.css` 的字体导入与 `.material-symbols-outlined` 配置）。
- 个别模块：`src/components/sidebar/Sidebar.tsx` 内部维护了一套 JetBrains 风格 SVG 图标（如后续恢复 Sidebar，可继续沿用）。

#### CSS 入口与关键类
样式入口在 `src/index.css`（Tailwind v4 + 自定义 utilities）。交接时最值得关注的 class：

- `.native-glass-panel`：桌面端整窗背景（无 `backdrop-filter`）
- `.glass-panel` / `.glass-card`：局部玻璃容器（可能带 `backdrop-filter`）
- `.no-scrollbar`：隐藏滚动条（配合 Virtuoso/自定义滚动体验）

### 8.2 HomePage.tsx（仪表盘）

当前 HomePage 不是“传统照片列表页”，而是仪表盘式编排（来源：`src/pages/HomePage.tsx`）：

- 顶部模块：`HeroSection`（每日精选）、`TagRibbon`、`ContentShelf`（最近添加）
- 底部模块：嵌入式 `PhotoGrid`（`embedded=true` + `groupByDateEnabled=true`）展示“全部照片”

数据获取（TanStack Query）：

- 最近添加：`getPhotosCursor(RECENT_PHOTOS_LIMIT, null, { field: 'dateAdded', order: 'desc' }, false)`
- 全部照片/搜索：`useInfiniteQuery`，根据 `searchQuery` 分流到 `getPhotosCursor` 或 `searchPhotosCursor`；仅首屏请求 `includeTotal=true` 用于展示“总数”。

注意点：

- 页面内有 `isTauriRuntime` 检测，用于在“纯 Web 模式”下禁用 query，避免 `invoke` 报错。
- 目前保留了一组 `console.log` 调试输出（可在发布前清理）。

### 8.3 PhotoGrid.tsx（网格）

来源：`src/components/photo/PhotoGrid/index.tsx`。

入口：`src/components/photo/PhotoGrid.tsx`（re-export）。

- 虚拟化：`Virtuoso` 渲染“行”，行内用 CSS Grid 摆放照片。
- 布局：根据 `containerWidth` 动态计算列数；并用 `getAspectRatioCategory()` 给 `wide/tall` 图分配 `colSpan/rowSpan`（让超宽/超长图更不“挤”）。
- 预取：`rangeChanged` 对视口附近照片批量 `check_thumbnails_cached` + `enqueue_thumbnails_batch`，并把磁盘命中回填进 `ThumbnailStore`。
- 嵌入模式：`embedded + groupByDateEnabled` 时不走 Virtuoso，直接渲染“按日期分组的静态网格”，交给父容器滚动。

### 8.4 PhotoThumbnail.tsx（缩略图卡片）

来源：`src/components/photo/PhotoThumbnail.tsx`。

- 渐进式：先 `tiny`（模糊）→ 再 `small`（清晰）；滚动中会暂停发起新请求（`suspendNewRequests`），但会继续复用已缓存结果。
- 交互：支持单击/双击/右键/选择框；选中态通过 ring + 遮罩表达。
- 运行时检测：非 Tauri 环境下会降级为不走缩略图 pipeline（避免 invoke 报错）。

### 8.5 PhotoViewer.tsx（查看器）

来源：`src/components/photo/PhotoViewer.tsx`。

- 普通图片：直接 `getAssetUrl(filePath)`（本质是 `convertFileSrc`）加载原图；同时用 `useThumbnail(size='large')` 当占位图。
- RAW：不直接加载原文件（可能无法被 WebView 解码），而是调用后端 `get_raw_preview` 获取 Base64 JPEG 预览并显示。
- 操作：评分/收藏等通过 `set_photo_rating`、`set_photo_favorite` 写回数据库。

### 8.6 缩略图加载栈

来源：`src/hooks/useThumbnail.ts` + `src/services/ThumbnailStore.ts`。

- `ThumbnailStore`：全局内存 Map（key=`fileHash_size`）+ 事件订阅；收到 `thumbnail-ready` 时更新缓存并唤醒监听器。
- `useThumbnail`：
  1) 先查 `ThumbnailStore` 内存缓存
  2) 再 `get_thumbnail_cache_path` 查磁盘缓存
  3) 未命中则 `enqueue_thumbnail` 入队等待事件回推
- `useThumbnailProgressive`：组合 `tiny + full` 两个 `useThumbnail`，并决定“是否展示 tiny”。

### 8.7 SettingsPage.tsx（设置）

来源：`src/pages/SettingsPage.tsx` + `src/components/layout/Layout.tsx`。

- 设置读写：通过 `get_settings/save_settings/reset_settings`（Rust 会持久化到 `app_data_dir/settings.json`）。
- 窗口外观：页面把 `settings.window` 同步到 `settingsStore` 的 `windowOpacity/windowTransparency`；Layout 再 debounce 80ms 调用 `apply_window_settings` 应用原生 Acrylic 参数。
- 文件夹同步：`get_sync_folders/add_sync_folder/remove_sync_folder/trigger_sync_now` 等命令，用于管理“同步目录列表”。

### 8.8 Sidebar.tsx（备用）

`src/components/sidebar/Sidebar.tsx` 当前不在全局 Layout 中使用；如果后续要恢复“左侧常驻导航”，需要在 `src/components/layout/Layout.tsx` 中引入，并同步调整页面布局与滚动容器的职责边界。


### 8.9 SearchPanel.tsx（搜索面板）

来源：`src/components/search/SearchPanel.tsx` + `src/stores/photoStore.ts`。

- 入口：顶部 `AppHeader` 点击搜索按钮打开（另：键盘支持 `Esc` 关闭，`Ctrl/Cmd+Enter` 执行搜索）。
- 过滤器：`query/dateFrom/dateTo/tagIds(+tagNames)/minRating/favoritesOnly`，最终写入 `photoStore.searchFilters`。
- 标签数据：面板打开时调用 `get_all_tags` 预加载（用于多选标签过滤）。
- 生效链路：`HomePage` 根据 `searchFilters` 是否为空，在 `get_photos_cursor` 与 `search_photos_cursor` 之间切换。

### 8.10 TagRibbon.tsx（快速筛选）

来源：`src/components/dashboard/TagRibbon.tsx`。

- 特殊项：全部（清空过滤）、收藏（`favoritesOnly=true`）、2025 年（固定日期范围）、RAW（`fileExtensions`）。
- 动态标签：点击某个标签会写入 `searchFilters.tagIds=[id]`，并补充 `tagNames` 供 UI 展示标题。

### 8.11 BatchTagSelector.tsx（批量标签）

来源：`src/components/tag/BatchTagSelector.tsx`。

- 入口：`HomePage` 底部 `SelectionToolbar` 的“标签”按钮（对当前选中照片集合）。
- 操作：批量添加/移除标签分别调用 `add_tag_to_photos/remove_tag_from_photos`；支持输入名称 `create_tag` 后立即批量添加。

### 8.12 PhotoEditor.tsx（照片编辑器）

来源：`src/components/photo/PhotoEditor.tsx` + `src/stores/editStore.ts`。

- 交互：弹窗（Portal）内支持旋转/翻转、滑杆调整（亮度/对比度/饱和度/曝光/高光/阴影/色温/色调/锐化/模糊/暗角），并提供缩放/拖拽查看。
- 预览：前端用 CSS filters 做实时预览；保存时用 `editStore.getEditParams()` 生成 `EditParams`。
- 保存：调用 `apply_photo_edits(photoId, params, saveAsCopy)`；后端会更新 DB 尺寸、删除该照片缩略图缓存。
- 限制：RAW 不可编辑（`is_photo_editable`），需要在 UI 层禁用入口/提示。

---

## 9. 后端服务详解

### 9.1 AppState（应用状态）

```rust
pub struct AppState {
    pub db: Arc<Database>,
    pub thumbnail_service: ThumbnailService,
    pub thumbnail_queue: Arc<ThumbnailQueue>,
    /// 普通格式（JPEG/PNG/WebP 等）缩略图并发限制（= thumbnail_threads）
    pub thumbnail_limiter: Arc<Semaphore>,
    /// RAW 格式缩略图并发限制（隔离慢任务，避免堵塞普通缩略图）
    pub thumbnail_limiter_raw: Arc<Semaphore>,
}
```

初始化位置：`src-tauri/src/lib.rs` 的 `run().setup(...)`。它会：

- 打开数据库并做 schema/migrations（`Database::open/init`）
- 读取设置（`SettingsManager::load`），计算 `thumbnail_threads`（0=自动，范围 1..=8）
- 创建 `ThumbnailQueue::with_worker_count(thumbnail_threads)` 并把全局 `AppHandle` 注入队列线程用于 emit 事件

### 9.2 Scanner Service

扫描目录收集图片文件（来源：`src-tauri/src/services/scanner.rs`）：

- 支持格式由 `SUPPORTED_FORMATS` 常量定义（含 `heic/heif` 与多种 RAW 扩展名）
- 遍历用 `walkdir`，并根据 `ScanOptions` 决定是否递归、最大深度、排除目录
- 额外策略：跳过隐藏目录（`.xxx`）与常见系统/缓存目录（如 `node_modules`、`.git`、`$RECYCLE.BIN` 等）

```rust
pub struct ScanOptions {
    pub recursive: bool,
    pub exclude_dirs: Vec<String>,
    pub max_depth: usize,
}

pub fn scan_directory(path: &Path, options: &ScanOptions) -> ScanResult {
    // 使用 walkdir 遍历目录
    // 过滤支持的图片格式
    // 返回文件路径列表
}
```

### 9.3 Indexer Service

协调扫描、哈希、元数据提取和数据库插入（来源：`src-tauri/src/services/indexer.rs`）：

- 核心类型：`PhotoIndexer { db, options, cancelled }`
- 选项：`skip_existing`（按路径跳过）、`detect_duplicates`（按哈希检测重复）、`batch_size`
- 并行：rayon 并行处理文件，Atomic 统计进度
- 进度：通过回调把 `IndexProgress` 喂给命令层，命令层再 emit `index-progress`
- 取消：`cancel_flag` 是 AtomicBool（目前主要用于测试/未来扩展）

```rust
pub fn index_directory(path: &str, db: &Database) -> IndexResult {
    // 1. 扫描目录
    // 2. 并行处理文件（rayon）
    // 3. 计算哈希、提取元数据
    // 4. 检查重复
    // 5. 批量插入数据库
}
```

日期来源策略（很关键，影响“时间线分组/排序”）：

1. 优先 EXIF `DateTimeOriginal`（`MetadataExtractor`）
2. EXIF 缺失时：尝试从文件名解析常见模式（`YYYYMMDD_HHMMSS`、`IMG_20251203_170003` 等）
3. 再退化：使用文件系统 modified time（以及必要的兜底）

### 9.4 Metadata Service

提取 EXIF 元数据（来源：`src-tauri/src/services/metadata.rs`）：

```rust
pub struct ImageMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub date_taken: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub focal_length: Option<f64>,
    pub aperture: Option<f64>,
    pub iso: Option<u32>,
    pub shutter_speed: Option<String>,
    pub gps_latitude: Option<f64>,
    pub gps_longitude: Option<f64>,
    pub orientation: Option<u32>,
}
```

实现要点：

- EXIF 解析使用 `kamadak-exif`，读取失败时返回“空 metadata”而不是报错（避免索引全流程被单张坏图拖垮）。
- width/height 如果 EXIF 不提供，会用 `image::image_dimensions` 从文件头兜底读取。
- `fill_create_photo` 负责把 metadata 写回 `CreatePhoto`（数据库插入结构）。

### 9.5 Thumbnail Service

缩略图系统分成两层：

1. **生成/缓存层**：`src-tauri/src/services/thumbnail.rs` 的 `ThumbnailService`
2. **调度/事件层**：`src-tauri/src/services/thumbnail_queue.rs` 的 `ThumbnailQueue`（优先级队列 + worker + emit）

生成层关键行为：

- **小图跳过**：当传入原图尺寸且像素数 < 200 万，直接返回原图（`useOriginal=true`），不生成 WebP（见 `SMALL_IMAGE_PIXEL_THRESHOLD`）。
- **磁盘缓存**：`get_cache_path(file_hash, size)`，命中立即返回。
- **in-flight 去重**：用 `HashSet + Condvar`，确保“同一 hash+size”同一时刻只生成一次，其他线程等待后直接复用缓存。
- **生成策略**：优先 WIC 解码缩放（Windows），必要时 fallback；RAW 场景下可能走 LibRaw/扫描嵌入 JPEG/硬解码等路径。
- **占位图**：RAW 预览提取失败会返回 `isPlaceholder=true` + WebP bytes（不落盘）。

调度层关键行为：

- 任务结构：`ThumbnailTask { source_path, file_hash, size, priority, seq, original_dimensions }`
- 队列：`BinaryHeap`（priority 越大越先出），`seq` 用于稳定排序
- 事件：生成完成 emit `thumbnail-ready`（payload 见前文 6.3）

统计：`src-tauri/src/commands/thumbnail.rs` 维护了 cache hit/miss、平均生成耗时与队列深度，可用 `get_thumbnail_stats` 获取。

### 9.6 WIC Service（Windows）

使用 Windows Imaging Component 进行高性能图像处理。

#### 完整实现（src-tauri/src/services/wic.rs）
```rust
use windows::{
    core::*,
    Win32::System::Com::*,
    Win32::Graphics::Imaging::*,
};

pub struct WicProcessor {
    factory: IWICImagingFactory,
}

impl WicProcessor {
    /// 创建 WIC 处理器实例
    pub fn new() -> AppResult<Self> {
        unsafe {
            // 初始化 COM（多线程模式）
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

            // 创建 WIC 工厂
            let factory: IWICImagingFactory = CoCreateInstance(
                &CLSID_WICImagingFactory,
                None,
                CLSCTX_INPROC_SERVER
            )?;

            Ok(Self { factory })
        }
    }

    /// 加载并缩放图像
    pub fn load_and_resize(
        &self,
        path: &Path,
        target_width: u32,
        target_height: u32
    ) -> AppResult<(Vec<u8>, u32, u32)> {
        unsafe {
            // 1. 将路径转换为宽字符
            let path_wide: Vec<u16> = path.to_string_lossy()
                .encode_utf16().chain(std::iter::once(0)).collect();

            // 2. 创建解码器
            let decoder = self.factory.CreateDecoderFromFilename(
                PCWSTR(path_wide.as_ptr()),
                None,
                GENERIC_ACCESS_RIGHTS(0x80000000), // GENERIC_READ
                WICDecodeMetadataCacheOnDemand,
            )?;

            // 3. 获取第一帧
            let frame = decoder.GetFrame(0)?;

            // 4. 获取原始尺寸
            let mut orig_w: u32 = 0;
            let mut orig_h: u32 = 0;
            frame.GetSize(&mut orig_w, &mut orig_h)?;

            // 5. 计算缩放比例（保持宽高比）
            let scale = (target_width as f64 / orig_w as f64)
                .min(target_height as f64 / orig_h as f64);
            let new_w = (orig_w as f64 * scale).round() as u32;
            let new_h = (orig_h as f64 * scale).round() as u32;

            // 6. 创建缩放器（高质量立方插值）
            let scaler = self.factory.CreateBitmapScaler()?;
            scaler.Initialize(
                &frame,
                new_w,
                new_h,
                WICBitmapInterpolationModeHighQualityCubic,
            )?;

            // 7. 创建格式转换器（转为 BGRA）
            let converter = self.factory.CreateFormatConverter()?;
            converter.Initialize(
                &scaler,
                &GUID_WICPixelFormat32bppBGRA,
                WICBitmapDitherTypeNone,
                None,
                0.0,
                WICBitmapPaletteTypeMedianCut,
            )?;

            // 8. 复制像素数据
            let stride = new_w * 4;
            let buffer_size = (stride * new_h) as usize;
            let mut buffer = vec![0u8; buffer_size];
            converter.CopyPixels(std::ptr::null(), stride, &mut buffer)?;

            Ok((buffer, new_w, new_h))
        }
    }

    /// BGRA 缓冲区转 DynamicImage
    pub fn buffer_to_dynamic_image(
        buffer: Vec<u8>,
        width: u32,
        height: u32
    ) -> AppResult<DynamicImage> {
        // BGRA -> RGBA 转换
        let mut rgba = buffer;
        for chunk in rgba.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
        }

        image::RgbaImage::from_raw(width, height, rgba)
            .map(DynamicImage::ImageRgba8)
            .ok_or_else(|| AppError::General("Failed to create RgbaImage".into()))
    }
}
```

#### 特点
- 使用 COM 接口（CoCreateInstance）
- 高质量立方插值缩放（WICBitmapInterpolationModeHighQualityCubic）
- BGRA 格式输出（需转换为 RGBA）
- 自动保持宽高比
- 仅 Windows 平台可用（其他平台返回错误）

#### 依赖配置（Cargo.toml）
```toml
[target.'cfg(windows)'.dependencies]
windows = { version = "0.62.2", features = [
    "Win32_Graphics_Imaging",
    "Win32_System_Com",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Foundation"
]}
```

### 9.7 LibRaw FFI

来源：`src-tauri/src/services/libraw.rs`。

核心点：

- **动态加载**：使用 `libloading::Library` 在运行时加载 `libraw.dll/raw.dll`，并把函数指针缓存到全局 `OnceLock`（避免重复加载）。
- **搜索路径（按优先级）**：
  1) `exe_dir/libraw/libraw.dll`（打包资源目录，见 `tauri.conf.json` 的 `bundle.resources`）
  2) `exe_dir/libraw.dll`（exe 同级）
  3) 开发路径：`.../src-tauri/resources/libraw/libraw.dll`
  4) 系统 `PATH`（`libraw.dll` / `raw.dll`）
- **并发与超时**：RAW 预览提取使用 `RawPreviewWorker`（默认 4 worker + 有界队列，避免无限堆积）；并提供 `extract_preview_image_with_timeout(timeout_ms)`，超时返回 `None` 触发上层占位/回退。
- **对外接口**：
  - `is_available()`：是否成功加载（被 `get_libraw_status` 命令调用）
  - `extract_preview_image_with_timeout(...)`：供缩略图生成与 `get_raw_preview` 使用

### 9.8 SettingsManager（设置落盘与事件）

来源：`src-tauri/src/services/settings.rs` + `src-tauri/src/commands/settings.rs`。

- 路径：`app.path().app_data_dir()/settings.json`（目录由 Tauri 运行时解析）
- 读写：`load/save/reset`（JSON pretty）
- 事件：保存/重置后 emit `settings-changed(AppSettings)`

### 9.9 Window Effects（原生 Acrylic）

来源：`src-tauri/src/window_effects.rs` + `src-tauri/src/commands/window_effects.rs`。

- Windows 下固定使用 `window-vibrancy` 的 Acrylic，并用 `WindowSettings.transparency(0..100)` 映射 tint alpha。
- `lib.rs` 会在窗口 Focus/Resize/ScaleFactor/ThemeChanged 等事件里“重应用”最后一次设置，减少系统状态切换导致的效果丢失。

### 9.10 Folder Sync（当前实现的真实含义）

来源：`src-tauri/src/commands/folder_sync.rs`。

当前“同步”更多是“维护 watched_folders 配置 + 发事件”，并不会自动扫描写库：

- `add_sync_folder/remove_sync_folder` 只是更新 `settings.scan.watched_folders` 并 emit `sync-folders-changed`
- `set_auto_sync_enabled/get_auto_sync_enabled` 只是读写 `settings.scan.auto_scan`
- `trigger_sync_now` 只 emit `sync-started` 并返回目录数量；真正的索引仍需要前端随后调用 `index_directories(...)`


### 9.11 Search（FTS5 + Filters）

来源：`src-tauri/src/commands/search.rs` + `src-tauri/src/db/photo_dao.rs` + `src-tauri/src/models/mod.rs`。

- FTS：`photos_fts MATCH ?`，并对查询加 `*` 做前缀匹配；同时对 `"` 做转义（见 `photo_dao.rs`）。
- 过滤：日期范围（`date_taken`）、收藏（`is_favorite`）、评分区间、标签（`photo_tags` 子查询）、相册（`album_photos` 子查询）、RAW（按 `format`/扩展名列表）。
- 分页：支持传统分页 `search_photos`，以及无限滚动用的 `search_photos_cursor`（cursor = `sortValue + photoId`）。

### 9.12 Tags（标签）

来源：`src-tauri/src/commands/tags.rs` + `src-tauri/src/db/tag_dao.rs`。

- 模型：`tags` + 关联表 `photo_tags`；统计接口 `get_all_tags_with_count` 用于展示标签下照片数量。
- 批量：`add_tag_to_photos/remove_tag_from_photos` 目前在命令层循环调用 DAO（可作为后续批量 SQL 的优化点）。

### 9.13 Editor（照片编辑）

来源：`src-tauri/src/commands/edit.rs` + `src-tauri/src/services/editor.rs`（可选：`src-tauri/src/services/native_editor.rs`）。

- 入口：`apply_photo_edits/get_edit_preview/is_photo_editable`。
- RAW 限制：`is_photo_editable` 对 RAW 扩展名返回 false（后端也会在加载时拒绝 RAW）。
- 保存：支持覆盖原文件或生成 `_edited_N` 副本；覆盖原文件时会更新 DB 的 `width/height` 并清理该照片所有尺寸缩略图缓存。
- 性能：若 `NativeEditor` 可用，会优先走 native 路径做部分调整；失败则回退纯 Rust 处理。

---

## 10. 性能优化

### 10.1 数据库优化

- **WAL 模式**: 支持并发读写
- **内存映射**: 256MB mmap 加速访问
- **索引策略**: 
  - file_hash, date_taken, date_added, rating, is_favorite
  - 复合索引 photo_tags(photo_id, tag_id)
- **FTS5**: 全文搜索索引

### 10.2 前端优化

- **虚拟滚动**: 只渲染可见区域
- **游标分页**: 避免 OFFSET 性能问题
- **事件驱动缩略图**: ThumbnailStore 监听 Tauri 事件，避免轮询
- **内存缓存**: 缩略图 URL 缓存
- **防抖搜索**: 300ms 延迟
- **Memoization**: useMemo, useCallback

### 10.3 后端优化

- **并行处理**: Rayon 并行扫描和索引
- **并发控制**: Semaphore 限制缩略图生成并发（普通 = `thumbnail_threads`，RAW = 1）
- **去重生成**: 防止重复生成同一缩略图
- **快速哈希**: xxh3 算法
- **批量操作**: 批量插入数据库
- **WIC 加速**: Windows 原生 API 解码图像

### 10.4 缩略图优化

- **WebP 格式**: 更小的文件体积
- **分级缓存**: small/medium/large 三级
- **DPR 适配**: 支持高 DPI 显示
- **队列处理**: 优先级队列
- **暖缓存**: 启动时预加载最近照片
- **占位图**: RAW 提取失败时返回 Base64 占位图（不写磁盘）

---

## 11. 开发指南

### 11.1 开发命令

```powershell
# 开发模式（前端 + 后端热重载）
npm run tauri dev

# 仅前端开发
npm run dev

# 构建生产版本
npm run tauri build

# 测试
npm run test              # 前端测试
cd src-tauri && cargo test  # Rust 测试

# 代码检查
npm run lint              # ESLint
npm run lint:fix          # 自动修复
npm run format            # Prettier
cargo fmt                 # Rust 格式化
cargo clippy              # Rust 静态分析
```

### 11.2 路径别名

```typescript
// 使用 @/ 代替 src/
import { Photo } from '@/types';
import { usePhotoStore } from '@/stores';
```

### 11.3 提交规范

本仓库更偏向“短且描述清晰”的提交信息（中文或英文均可），例如：

- `优化缩略图预取`
- `Fix folder scan regression`

如果你习惯 Conventional Commits 也可以使用，但目前仓库没有强制校验；关键是让后来者能一眼看懂“改了什么/为什么改”。

### 11.4 错误处理

Rust 端使用自定义错误类型：

```rust
pub enum AppError {
    Database(String),
    Io(String),
    Image(String),
    InvalidPath(String),
    FileNotFound(String),
    UnsupportedFormat(String),
    Permission(String),
    Config(String),
    General(String),
}
```


---

## 12. 配置文件

### 12.1 tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "PhotoWall",
  "version": "0.1.0",
  "identifier": "com.photowall.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "PhotoWall",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600,
      "decorations": false,
      "transparent": true
    }],
    "security": {
      "csp": null,
      "assetProtocol": {
        "enable": true,
        "scope": [
          "**",
          "$APPDATA/**",
          "$APPLOCALDATA/**",
          "$APPCACHE/**",
          "$HOME/**",
          "$PICTURE/**",
          "$DOCUMENT/**",
          "$DOWNLOAD/**",
          "$DESKTOP/**",
          "C:/**",
          "D:/**",
          "E:/**",
          "F:/**"
        ]
      }
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "resources": {
      "resources/libraw/*": "libraw/"
    }
  }
}
```

说明：上面为“精简但对齐现状”的摘录，完整配置以 `src-tauri/tauri.conf.json` 为准（尤其是 `assetProtocol.scope` 当前非常宽）。

### 12.2 应用设置

存储位置：`{app_data_dir}\\settings.json`（由 `app.path().app_data_dir()` 决定，见 `src-tauri/src/services/settings.rs`）

```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  scan: {
    watchedFolders: string[]
    excludedPatterns: string[]
    autoScan: boolean
    scanInterval: number
    recursive: boolean
  }
  thumbnail: {
    cacheSizeMb: number
    quality: number
    autoCleanup: boolean
    cleanupThreshold: number
  }
  performance: {
    scanThreads: number
    thumbnailThreads: number
    enableWal: boolean
  }
  window: {
    opacity: number
    transparency: number
  }
}
```

注意：后端 `ThumbnailSettings` 里还有 `librawEnabled`（默认 true，且 `serde(default)`），但前端 `src/types/index.ts` 目前未暴露这个字段；如果要做 UI 开关，需要同步补齐 TS 类型与 SettingsPage 表单，否则“保存设置”会把该字段回到默认值。

补充：当前 SettingsPage 的更新写法多为“在现有对象上 spread 后修改”，因此运行时如果已携带 `librawEnabled` 一般不会丢；但类型层面仍建议补齐，避免后续重构时不小心覆盖掉未声明字段。

---

## 13. 数据流图

### 13.1 照片加载流程

```
用户打开应用
    ↓
HomePage 挂载
    ↓
useInfiniteQuery 触发
    ↓
调用 getPhotosCursor API
    ↓
Rust: search.rs → photo_dao.rs
    ↓
SQLite 查询
    ↓
返回 Photo[] 到前端
    ↓
PhotoGrid 渲染
    ↓
每个 PhotoThumbnail 调用 useThumbnailProgressive (tiny → small)
    ↓
useThumbnail：先查 ThumbnailStore（内存）
    ↓
未命中：invoke get_thumbnail_cache_path（磁盘命中则 convertFileSrc 后写回 ThumbnailStore）
    ↓
仍未命中：invoke enqueue_thumbnail 入队等待
    ↓
后台生成完成：emit thumbnail-ready（事件推送）
    ↓
ThumbnailStore 收到事件更新缓存 → PhotoThumbnail 自动刷新

补充：PhotoGrid 在 rangeChanged 里会批量 check_thumbnails_cached + enqueue_thumbnails_batch，属于“预取通道”，能显著降低首屏等待感。
```

### 13.2 照片索引流程

```
用户点击"添加文件夹"
    ↓
打开文件夹选择对话框
    ↓
调用 indexDirectory API
    ↓
Rust: commands/scanner.rs -> services/indexer.rs
    ↓
每个文件:
  - hasher.rs 计算哈希
  - metadata.rs 提取 EXIF
    ↓
检查数据库去重
    ↓
批量插入 photos 表
    ↓
返回 IndexResult
    ↓
前端刷新照片列表
    ↓
后台预生成缩略图：该文件夹下的 tiny+small 入队（不阻塞返回）
```


---

## 14. 类型定义

### 14.1 核心类型 (src/types/index.ts)

```typescript
// 照片
interface Photo {
  photoId: number
  filePath: string
  fileName: string
  fileSize: number
  fileHash: string
  width?: number
  height?: number
  format?: string
  dateTaken?: string
  dateAdded: string
  dateModified?: string
  cameraModel?: string
  lensModel?: string
  focalLength?: number
  aperture?: number
  iso?: number
  shutterSpeed?: string
  gpsLatitude?: number
  gpsLongitude?: number
  orientation?: number
  rating: number
  isFavorite: boolean
  isDeleted: boolean
  deletedAt?: string
}

// 标签
interface Tag {
  tagId: number
  tagName: string
  color?: string
  dateCreated: string
}

// 相册
interface Album {
  albumId: number
  albumName: string
  description?: string
  coverPhotoId?: number
  dateCreated: string
  sortOrder: number
}

// 搜索过滤器
interface SearchFilters {
  query?: string
  dateFrom?: string
  dateTo?: string
  tagIds?: number[]
  albumId?: number
  cameraModel?: string
  minRating?: number
  favoritesOnly?: boolean
}

// 分页
interface PaginationParams {
  page: number
  pageSize: number
}

interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 游标分页
interface PhotoCursor {
  sortValue: string | number | null
  photoId: number
}

interface CursorPageResult<T> {
  items: T[]
  total?: number | null
}

// 排序
type SortField = 'dateTaken' | 'dateAdded' | 'fileName' | 'fileSize' | 'rating'
type SortOrder = 'asc' | 'desc'

// 视图模式
type ViewMode = 'grid' | 'timeline' | 'detail'

// 缩略图尺寸
type ThumbnailSize = 'small' | 'medium' | 'large'

// 主题
type ThemeMode = 'light' | 'dark' | 'system'
```

备注：

- 后端 `SearchFilters` 实际支持更多字段（`lensModel/maxRating/hasGps` 等，见 `src-tauri/src/models/mod.rs`），前端 `src/types/index.ts` 目前只暴露子集；需要高级筛选时应同步扩展 TS 类型与 UI。
- 缩略图尺寸在后端/Hook 侧还有 `tiny`（用于渐进式占位图），但不作为业务层 `ThumbnailSize` 暴露给页面组件。


---

## 15. 页面功能详解

### 15.1 HomePage（首页）

路径: `/`

功能（当前版本）：
- 仪表盘编排：`HeroSection` + `TagRibbon` + `ContentShelf(最近添加)`
- 照片流：`useInfiniteQuery` 拉取全部/搜索结果，并用嵌入式 `PhotoGrid` 按日期分组渲染
- 搜索/筛选：由 `photoStore.searchFilters` 驱动；来源于 `TagRibbon`（快速筛选）与 `SearchPanel`（高级搜索）。
- 批量标签：底部 `SelectionToolbar` -> `BatchTagSelector`，调用 `add_tag_to_photos/remove_tag_from_photos`。
- 基础交互：单击选择、双击打开 `PhotoViewer`

### 15.2 FavoritesPage（收藏页）

路径: `/favorites`

功能：
- 分页加载收藏：`get_favorite_photos`
- 视图模式：`PhotoGrid` / `TimelineView`（由 `photoStore.viewMode` 控制）
- 批量取消收藏：`set_photos_favorite(false)`

### 15.3 TrashPage（回收站页）

路径: `/trash`

功能：
- 分页加载回收站：`get_deleted_photos`，统计：`get_trash_stats`
- 操作：`restore_photos` / `permanent_delete_photos` / `empty_trash`
- UI：包含确认对话框与批量操作栏（SelectionToolbar）

### 15.4 FoldersPage（文件夹页）

路径: `/folders`

功能：
- 左侧文件夹树：`get_folder_tree`，子文件夹懒加载：`get_folder_children`
- 右侧照片列表：`get_photos_by_folder(folderPath, includeSubfolders, pagination, sort)`
- 批量操作：收藏 `set_photos_favorite`、删除 `soft_delete_photos`

### 15.5 SettingsPage（设置页）

路径: `/settings`

功能:
- 设置读写：`get_settings/save_settings/reset_settings`（落盘到 `app_data_dir/settings.json`）
- 原生窗口外观：`apply_window_settings`（Acrylic 透明度参数）
- 同步目录：`get_sync_folders/add_sync_folder/remove_sync_folder/trigger_sync_now`

### 15.6 AlbumsPage（相册页）

路径: `/albums`

功能:
- 列表与统计：`get_all_albums_with_count`
- 管理弹窗：`AlbumManager`（创建/编辑/删除/封面/排序等命令）
- 备注：相册详情页导航目前被注释（`AlbumsPage.tsx` 中 `navigate(...)`）

### 15.7 TagsPage（标签页）

路径: `/tags`

功能:
- 列表与统计：`get_all_tags_with_count`
- 管理弹窗：`TagManager`（创建/编辑/删除/颜色等命令）
- 备注：标签详情页导航目前被注释（`TagsPage.tsx` 中 `navigate(...)`）


### 15.8 SearchPanel（全局搜索）

入口：`src/components/layout/AppHeader.tsx`（搜索按钮）+ `src/components/search/SearchPanel.tsx`。

功能:
- 文本搜索：写入 `photoStore.searchFilters.query`，后端走 FTS5（`search_photos_cursor`）。
- 高级过滤：日期范围、标签（多选）、最低评分、仅收藏；清除会重置 `photoStore.searchFilters`。
- 键盘：`Esc` 关闭，`Ctrl/Cmd + Enter` 执行搜索。

### 15.9 PhotoEditor（照片编辑）

入口：`src/components/photo/PhotoViewer.tsx` -> `src/components/photo/PhotoEditor.tsx`。

功能:
- 旋转/翻转 + 基础调整（亮度/对比度/饱和度/曝光/高光/阴影/色温/色调/锐化/模糊/暗角）。
- 保存：`apply_photo_edits` 支持覆盖原文件或“另存为副本”；保存后会更新 DB 尺寸并清理该照片缩略图缓存。
- 限制：RAW 文件不可编辑（`is_photo_editable=false`）。

---

## 16. 关键代码位置索引

### 16.1 前端关键文件

| 功能 | 文件 | 行数 |
|------|------|------|
| API 封装 | src/services/api/index.ts | 44 |
| 类型定义 | src/types/index.ts | 408 |
| 首页（仪表盘） | src/pages/HomePage.tsx | 223 |
| 文件夹页 | src/pages/FoldersPage.tsx | 654 |
| 设置页 | src/pages/SettingsPage.tsx | 633 |
| 收藏页 | src/pages/FavoritesPage.tsx | 384 |
| 回收站页 | src/pages/TrashPage.tsx | 557 |
| 照片网格 | src/components/photo/PhotoGrid/index.tsx | 346 |
| 全屏查看器 | src/components/photo/PhotoViewer.tsx | 735 |
| 照片缩略图 | src/components/photo/PhotoThumbnail.tsx | 244 |
| 时间线视图 | src/components/photo/TimelineView.tsx | 233 |
| 文件夹树 | src/components/photo/FolderTree.tsx | 235 |
| 缩略图 Hook | src/hooks/useThumbnail.ts | 512 |
| 缩略图缓存 | src/services/ThumbnailStore.ts | 112 |
| 前端日志 | src/services/logger.ts | 37 |
| 主布局 | src/components/layout/Layout.tsx | 79 |
| 顶部导航 | src/components/layout/AppHeader.tsx | 68 |
| 侧边栏（备用） | src/components/sidebar/Sidebar.tsx | 243 |
| 工具栏 | src/components/layout/Toolbar.tsx | 199 |
| 状态栏 | src/components/layout/StatusBar.tsx | 53 |
| Dashboard - Hero | src/components/dashboard/HeroSection.tsx | 99 |
| Dashboard - TagRibbon | src/components/dashboard/TagRibbon.tsx | 115 |
| Dashboard - ContentShelf | src/components/dashboard/ContentShelf.tsx | 146 |
| 相册管理 | src/components/album/AlbumManager.tsx | 266 |
| 标签管理 | src/components/tag/TagManager.tsx | 290 |
| 标签选择器 | src/components/tag/TagSelector.tsx | 215 |
| 批量标签 | src/components/tag/BatchTagSelector.tsx | 201 |
| 搜索面板 | src/components/search/SearchPanel.tsx | 256 |
| 照片编辑器 | src/components/photo/PhotoEditor.tsx | 426 |
| 右键菜单 | src/components/common/ContextMenu.tsx | 145 |
| 确认对话框 | src/components/common/ConfirmDialog.tsx | 106 |
| 扫描进度 | src/components/common/ScanProgressDialog.tsx | 97 |

### 16.2 后端关键文件

| 功能 | 文件 | 行数 |
|------|------|------|
| Photo DAO | src-tauri/src/db/photo_dao.rs | 1474 |
| 缩略图服务 | src-tauri/src/services/thumbnail.rs | 1189 |
| 缩略图命令 | src-tauri/src/commands/thumbnail.rs | 575 |
| 索引服务 | src-tauri/src/services/indexer.rs | 533 |
| 文件操作命令 | src-tauri/src/commands/file_ops.rs | 533 |
| LibRaw FFI | src-tauri/src/services/libraw.rs | 477 |
| Album DAO | src-tauri/src/db/album_dao.rs | 450 |
| 扫描命令 | src-tauri/src/commands/scanner.rs | 429 |
| Tag DAO | src-tauri/src/db/tag_dao.rs | 362 |
| 扫描服务 | src-tauri/src/services/scanner.rs | 351 |
| 数据库连接 | src-tauri/src/db/connection.rs | 327 |
| 缩略图队列 | src-tauri/src/services/thumbnail_queue.rs | 341 |
| 应用入口 | src-tauri/src/lib.rs | 335 |
| 搜索命令 | src-tauri/src/commands/search.rs | 280 |
| 编辑命令 | src-tauri/src/commands/edit.rs | 225 |
| 编辑服务 | src-tauri/src/services/editor.rs | 620 |
| 元数据提取 | src-tauri/src/services/metadata.rs | 272 |
| 文件监控 | src-tauri/src/services/watcher.rs | 263 |
| Photo 模型 | src-tauri/src/models/photo.rs | 236 |
| 哈希服务 | src-tauri/src/services/hasher.rs | 223 |
| 相册命令 | src-tauri/src/commands/albums.rs | 213 |
| 文件夹命令 | src-tauri/src/commands/folders.rs | 222 |
| 标签命令 | src-tauri/src/commands/tags.rs | 185 |
| 文件夹同步 | src-tauri/src/commands/folder_sync.rs | 183 |
| 数据库 Schema | src-tauri/src/db/schema.rs | 166 |
| WIC 服务 | src-tauri/src/services/wic.rs | 150 |
| Settings 模型 | src-tauri/src/models/settings.rs | 161 |
| Window Effects | src-tauri/src/window_effects.rs | 87 |
| Album 模型 | src-tauri/src/models/album.rs | 112 |
| 错误类型 | src-tauri/src/utils/error.rs | 111 |
| Tag 模型 | src-tauri/src/models/tag.rs | 97 |
| 设置服务 | src-tauri/src/services/settings.rs | 97 |
| 设置命令 | src-tauri/src/commands/settings.rs | 69 |
| 前端日志命令 | src-tauri/src/commands/logging.rs | 39 |

### 16.3 Zustand Stores

| Store | 文件 | 行数 | 用途 |
|-------|------|------|------|
| folderStore | src/stores/folderStore.ts | 132 | 文件夹状态管理 |
| settingsStore | src/stores/settingsStore.ts | 86 | 前端设置缓存（主要是窗口外观） |
| navigationStore | src/stores/navigationStore.ts | 75 | 导航状态管理 |
| photoStore | src/stores/photoStore.ts | 69 | 照片列表状态 |
| selectionStore | src/stores/selectionStore.ts | 68 | 选择状态管理 |
| editStore | src/stores/editStore.ts | 153 | 照片编辑状态管理 |

---

## 17. 部署与构建

### 17.1 构建命令

```powershell
# 构建生产版本
npm run tauri build
```

### 17.2 输出位置

NSIS 安装包默认输出到：`src-tauri/target/release/bundle/nsis/`

文件名会包含版本与架构（例如：`PhotoWall_0.1.0_x64-setup.exe`）。

### 17.3 资源打包

LibRaw DLL 会被打包到安装目录的 `libraw/` 文件夹。

### 17.4 版本发布 Checklist（建议照着走）

1. 更新版本号（保持三处一致）：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`
2. 本地验证：`npm run lint`、`npm run test`、`npm run tauri build`
3. 验证产物：`src-tauri/target/release/bundle/nsis/` 下的安装包可启动、可创建 db、可生成缩略图
4. 验证资源：安装目录 `libraw/` 下存在 `libraw.dll`（或 `raw.dll`），`get_libraw_status` 为可用

### 17.5 数据目录

- 数据库: `%APPDATA%\\PhotoWall\\photowall.db`
- 缩略图缓存: `%APPDATA%\\PhotoWall\\Thumbnails\\{tiny|small|medium|large}\\`
- 设置文件: `{app_data_dir}\\settings.json`
- 日志目录（当前实现）: `{current_dir}\\logs\\`


---

## 18. 注意事项

### 18.1 开发环境要求

- Node.js 18+
- Rust 1.70+
- Windows 10/11
- Visual Studio Build Tools

### 18.2 常见问题

1. **LibRaw 加载失败**：确认安装目录 `libraw/` 下存在 `libraw.dll`（或 `raw.dll`），以及 `get_libraw_status` 返回 `available=true`。
2. **数据库锁定/写入失败**：SQLite 是单文件 + WAL；如果用户同时开了多个实例，或外部程序占用 db 文件，可能导致写失败。
3. **缩略图“有时不显示/很慢”**：先看 `thumbnail-ready` 是否触发（前端是否监听成功），再看磁盘缓存是否写入；大量滚动时会暂停新请求属于预期行为。
4. **日志文件缺失**：当前日志路径是 `{current_dir}\\logs`，打包后可能不可写；先检查写权限或改为 `app_data_dir`（代码层面）。
5. **设置保存后丢字段**：前端 TS 类型未暴露的字段（如 `librawEnabled`）保存时会回到默认；需要同步扩展 TS 类型与 SettingsPage。
6. **扫描相关 API/Hook 历史遗留**：`scan_directory/scan_directories` 后端返回 `ScanResult`，但 `src/services/api/scanner.ts` 里 `scanDirectory/scanDirectories` 仍标成 `Promise<Photo[]>`；同时 `src/hooks/useScanner.ts` 监听的 `scan-progress/index_photos/cancel_scan` 在后端不存在。

#### 排障流程（建议从上到下）

1. **先确定运行形态**：Tauri 桌面端（`isTauri()` 为 true）还是纯 Web（纯 Web 模式下所有 `invoke` 都应被禁用/降级）。
2. **看日志**：优先看 `{current_dir}\\logs\\backend.*.log` 与 `frontend.*.log`，确认命令是否被调用、是否报错。
3. **查数据库**：`%APPDATA%\\PhotoWall\\photowall.db` 是否存在；`schema_version` 是否有记录；`photos` 表是否有数据。
4. **查缩略图缓存**：`%APPDATA%\\PhotoWall\\Thumbnails\\small` 是否有 `.webp`；没有的话再回到日志看 thumbnail 命令/队列是否异常。
5. **查事件链路**：缩略图必须依赖 `thumbnail-ready` 回推；如果 UI 不刷新，通常是监听失败/事件名不一致/窗口环境检测不一致。

### 18.3 安全注意

- 当前 `assetProtocol.scope` 非常宽（含 `"**"`、用户目录通配与盘符通配），属于“开发期方便但风险偏高”的配置；上线前建议缩到最小可用范围。
- 数据库/缩略图/设置均为本地数据；避免在日志中打印真实照片路径（尤其是错误上报场景）。
- 应用本身无网络通信逻辑，但前端依赖的第三方库/插件升级仍需审计权限变化（尤其是 Tauri 插件）。

---

## 19. 联系方式

如有问题，请联系项目负责人。

---

## 附录 A: 完整 API 列表

### 扫描与索引
- scan_directory, scan_directories
- index_directory, index_directories
- get_database_stats, refresh_photo_metadata

### 照片查询
- get_photo, get_photos, get_photos_cursor
- search_photos, search_photos_cursor, search_photos_simple
- get_favorite_photos, get_photos_by_tag, get_photos_by_album
- get_camera_models, get_lens_models, get_photo_stats
- get_recently_edited_photo

### 照片操作
- set_photo_rating, set_photo_favorite, set_photos_favorite

### 标签管理
- create_tag, get_tag, get_tag_by_name, update_tag, delete_tag
- get_all_tags, get_all_tags_with_count
- add_tag_to_photo, add_tags_to_photo, remove_tag_from_photo
- remove_all_tags_from_photo
- get_tags_for_photo, get_or_create_tag
- add_tag_to_photos, remove_tag_from_photos

### 相册管理
- create_album, get_album, get_album_by_name, update_album, delete_album
- get_all_albums, get_all_albums_with_count
- add_photo_to_album, add_photos_to_album, remove_photo_from_album
- remove_photos_from_album, remove_all_photos_from_album
- get_photo_ids_in_album, get_albums_for_photo
- set_album_cover, reorder_album_photos
- get_recently_edited_album

### 文件操作
- import_photos, export_photos, delete_photos
- move_photo, copy_photo, batch_rename_photos

### 回收站
- get_deleted_photos, soft_delete_photos, restore_photos
- permanent_delete_photos, empty_trash, get_trash_stats

### 缩略图
- generate_thumbnail, enqueue_thumbnail, enqueue_thumbnails_batch
- cancel_thumbnail, get_thumbnail_cache_path, get_libraw_status
- get_thumbnail_stats, check_thumbnails_cached, warm_thumbnail_cache, get_raw_preview

### 文件夹
- get_folder_tree, get_folder_children
- get_photos_by_folder, get_folder_photo_count

### 设置
- get_settings, save_settings, reset_settings

### 窗口特效（Window Effects）
- apply_window_settings
- clear_blur_cache, set_exclude_from_capture, get_blurred_desktop
- is_composition_blur_supported, enable_composition_blur, disable_composition_blur
- set_composition_blur_radius, set_composition_tint

### 照片编辑
- is_photo_editable, get_edit_preview, apply_photo_edits

### 同步
- get_sync_folders, add_sync_folder, remove_sync_folder
- set_auto_sync_enabled, get_auto_sync_enabled
- trigger_sync_now, validate_folder_path

### 日志
- log_frontend

### Other
- greet

### 16.4 代码统计

| 类别 | 文件数 | 总行数 |
|------|--------|--------|
| 前端 TypeScript/TSX | 75 | 13,946 |
| 后端 Rust | 44 | 12,527 |
| CSS | 2 | 487 |
| **总计** | **121** | **26,960** |

---

*文档更新时间: 2026-01-10*
*PhotoWall v0.1.0*
