# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Windows Environment

- Use PowerShell or CMD only. Do not use bash, sh, WSL, or Linux-style paths.
- Use Windows paths with backslashes (`C:\...`).

## Development Commands

```powershell
npm run tauri dev          # Full app with hot reload
npm run dev                # Frontend only (Vite)
npm run tauri build        # Production build

npm run test               # Vitest
npm run test:coverage      # Coverage report
npm run lint               # ESLint
npm run lint:fix           # Auto-fix
npm run format             # Prettier

cd src-tauri && cargo test # Rust tests
cargo clippy               # Rust linting
cargo fmt                  # Rust formatting
```

## Architecture

PhotoWall is a Windows desktop photo manager built with Tauri 2 + React 19 + TypeScript + Rust.

**Frontend** (`src/`):
- `components/` - React components (layout, sidebar, photo, album, tag)
- `pages/` - Route pages (HomePage, AlbumsPage, TagsPage, SettingsPage, FavoritesPage, TrashPage, FoldersPage)
- `stores/` - Zustand stores (photoStore, selectionStore, navigationStore, folderStore, settingsStore)
- `services/api.ts` - Tauri IPC wrapper
- `types/` - TypeScript definitions

**Backend** (`src-tauri/src/`):
- `commands/` - Tauri IPC handlers (scanner, search, tags, albums, thumbnail, file_ops, settings, folders)
- `services/` - Business logic (scanner, indexer, metadata, thumbnail, file watcher)
- `db/` - SQLite layer (connection, schema, DAOs)
- `models/` - Data models (Photo, Tag, Album, Settings)

**Key patterns**:
- IPC: `invoke<T>('command_name', { params })` from `@tauri-apps/api/core`
- State: Zustand for UI state, TanStack Query for server state
- Virtual scrolling: react-virtuoso for large photo collections
- Database: SQLite at `%AppData%\PhotoWall\Database\photowall.db` (WAL mode, FTS5)

## Path Alias

Use `@/` for src imports:
```typescript
import { Photo } from '@/types';
import { usePhotoStore } from '@/stores';
```

## Code Style

- TypeScript: 2 spaces, single quotes, Prettier
- Rust: 4 spaces, rustfmt, use `Result<T, AppError>` (avoid `unwrap()`)
- Components: PascalCase (`PhotoGrid.tsx`)
- Hooks: camelCase with `use` prefix
- Rust modules: snake_case

## Commit Convention

Conventional Commits: `feat(scope)`, `fix(scope)`, `perf`, `refactor`, `docs`, `test`, `chore`
