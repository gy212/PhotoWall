# PhotoWall Qt 迁移环境准备（Windows）

用于排查/安装 PhotoWall「Qt QML + C++ + Rust FFI」开发所需环境；同时兼容继续构建现有「Tauri + React」版本。

---

## 总原则（避免踩坑）

- 全链路统一 **MSVC x64**：Qt 选 *MSVC 2022 64-bit*，Rust 选 `x86_64-pc-windows-msvc`，C++ 用 v143。
- Qt 迁移版本使用 **新数据目录**：建议 `%APPDATA%/PhotoWallQt/`（不与旧 Tauri 目录共享）。

---

## 必需环境（Qt + Rust FFI）

### 1) Visual Studio 2022 / Build Tools（C++ + MSVC）

安装其一即可：

- Visual Studio 2022（Community/Professional/Enterprise）
- 或 Visual Studio 2022 Build Tools（无 IDE）

需要勾选/具备：

- Workload：`Desktop development with C++`
- 组件：`MSVC v143 - VS 2022 C++ x64/x86 build tools`
- 组件：`Windows 10/11 SDK`（任意一个较新版本即可）
- 组件（建议）：`CMake tools for Windows`
- 组件（建议）：`Ninja`（没有也可以，用 MSBuild 也能构建）

自检（PowerShell）：

```powershell
cl
cmake --version
```

> `cl` 能输出版本信息表示 MSVC 可用；如果提示找不到命令，说明未进入“开发者命令提示符”环境或 VS 工具链未正确安装/未配置 PATH。

### 2) Rust（MSVC 工具链）

安装 rustup 后执行：

```powershell
rustup toolchain install stable
rustup default stable
rustup target add x86_64-pc-windows-msvc
rustup component add rustfmt clippy
rustc -V
cargo -V
```

### 3) cbindgen（生成 `photowall.h`）

```powershell
cargo install cbindgen
cbindgen --version
```

### 4) Qt 6.5+（推荐 6.5 LTS，MSVC 2022 64-bit）

用 Qt Online Installer 安装，选择：

- Kit：`Qt 6.5+ (MSVC 2022 64-bit)`
- 模块（至少）：`Qt Base`、`Qt Declarative (Qt Quick)`、`Qt Quick Controls 2`、`Qt Quick Layouts`
- 工具（推荐）：`Qt Creator`

自检方式二选一：

1) 如果把 Qt 的 `bin` 加入了 PATH：
```powershell
qmake -v
```

2) 如果不想改 PATH（更推荐）：用 CMake 时在工程里设置 `CMAKE_PREFIX_PATH` 或 `Qt6_DIR` 指向 Qt 安装目录下的 `lib/cmake/Qt6`。

---

## 继续构建现有 Tauri + React 版本（仍建议保留）

### 5) Node.js + npm

- Node.js：建议 LTS（例如 20.x）
- npm：随 Node 自带

自检：

```powershell
node -v
npm -v
```

依赖安装：

```powershell
npm ci
```

### 6) WebView2 Runtime（运行 Tauri 必需）

Windows 常见已预装；若未安装，运行 `npm run tauri dev` 时会提示缺失。

手动检查方式：

- Windows「设置」→「应用」→ 搜索 `Microsoft Edge WebView2 Runtime`

---

## 可选（打包/发布阶段）

- NSIS（若要生成 installer；Tauri 版也会用到）
- Qt 部署工具：`windeployqt`（Qt 安装自带，用于复制 Qt 运行时依赖）

---

## 一键自检清单（建议逐条跑）

```powershell
# C++ 工具链
cl
cmake --version
ninja --version

# Rust
rustc -V
cargo -V
rustup show
cbindgen --version

# Node
node -v
npm -v

# Qt（如果已加入 PATH）
qmake -v
```

常见问题定位：

- `cl` 找不到：VS/Build Tools 未装齐或未使用对应环境（可用 “x64 Native Tools Command Prompt for VS 2022”）。
- Qt 选了 MinGW：请改装/改用 *MSVC 2022 64-bit*（避免与 Rust MSVC ABI 不兼容）。
- `qmake` 找不到：正常（未加 PATH）；用 CMake 配 `CMAKE_PREFIX_PATH/Qt6_DIR` 即可。

