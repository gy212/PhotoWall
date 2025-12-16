# Repository Guidelines

## Project Structure

- `src/`: React + TypeScript UI (pages, components, hooks, Zustand stores, Tailwind styles). Use `@/` as an alias to `src/`.
- `src/test/`: Vitest setup (`src/test/setup.ts`) and shared test helpers.
- `public/`: Static assets served by Vite.
- `src-tauri/`: Tauri (Rust) desktop backend (`src-tauri/src/**`, commands in `src-tauri/src/commands/**`).
- `dist/`, `coverage/`, `src-tauri/target/`, `node_modules/`: Generated outputs (ignored by Git).
- `src/PhotoWall.*`: Small C# reference/legacy modules; not part of the default Vite/Tauri build.

## Build, Test, and Development Commands

- `npm install`: Install JS dependencies (lockfile: `package-lock.json`).
- `npm run dev`: Run Vite dev server (web UI only).
- `npm run tauri dev`: Run the desktop app in dev mode (starts Vite, then Tauri).
- `npm run build`: Typecheck (`tsc`) and build UI to `dist/`.
- `npm run tauri build`: Build the desktop bundle/installer (see `src-tauri/tauri.conf.json`).
- `npm run lint` / `npm run lint:fix`: Lint `src/**/*.ts(x)` with ESLint.
- `npm run format`: Format `src/` with Prettier (+ Tailwind plugin).
- `npm run test` / `npm run test:coverage`: Run Vitest (coverage output in `coverage/`).

## Coding Style & Naming

- Indentation: 2 spaces for TS/TSX, 4 spaces for Rust (`.editorconfig`); target line length is ~100.
- React: components in `PascalCase.tsx`, hooks as `useThing.ts`, exports via local `index.ts` where present.
- Prefer typed APIs; avoid `any` unless justified (`@typescript-eslint/no-explicit-any` is warned).

## Testing Guidelines

- Framework: Vitest + Testing Library (`jsdom` environment).
- Naming: co-locate tests as `*.test.ts` / `*.test.tsx` next to the unit under test.
- Add/adjust tests for user-visible behavior and bug fixes; run `npm run test` before opening a PR.

## Commit & Pull Request Guidelines

- Commit messages in this repo are short and descriptive (Chinese or English); follow the same style (imperative, no “WIP”).
  - Example: `优化缩略图生成` / `Fix folder scan regression`
- PRs: include a clear summary, manual test steps, and screenshots/video for UI changes. Call out any Tauri permission/scope changes explicitly.

## Security & Data

- This app handles local photo paths and metadata—avoid logging sensitive paths and never commit real user data (`*.db`, cache dirs are ignored).
- Keep Tauri file-access scope as small as practical; don’t expand `assetProtocol.scope` without review.
