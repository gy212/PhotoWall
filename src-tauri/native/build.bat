@echo off
REM PhotoWall Native Editor 构建脚本
REM 需要: CMake, Visual Studio 2019/2022 (或 Build Tools)

setlocal

REM 设置路径
set SCRIPT_DIR=%~dp0
set BUILD_DIR=%SCRIPT_DIR%build
set VIPS_ROOT=%SCRIPT_DIR%..\vips-dev-8.18

REM 检查 libvips
if not exist "%VIPS_ROOT%\include\vips\vips.h" (
    echo Error: libvips not found at %VIPS_ROOT%
    echo Please download vips-dev-w64-all from:
    echo https://github.com/libvips/build-win64-mxe/releases
    exit /b 1
)

REM 创建构建目录
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

REM 配置 CMake
echo Configuring CMake...
cmake -S "%SCRIPT_DIR%" -B "%BUILD_DIR%" -G "Visual Studio 17 2022" -A x64 -DVIPS_ROOT="%VIPS_ROOT%"
if errorlevel 1 (
    echo CMake configuration failed
    exit /b 1
)

REM 构建
echo Building...
cmake --build "%BUILD_DIR%" --config Release
if errorlevel 1 (
    echo Build failed
    exit /b 1
)

REM 复制 DLL 到 src-tauri 目录
echo Copying DLL...
copy /Y "%BUILD_DIR%\Release\photowall_editor.dll" "%SCRIPT_DIR%..\"
if errorlevel 1 (
    echo Failed to copy DLL
    exit /b 1
)

echo.
echo Build successful!
echo DLL location: %SCRIPT_DIR%..\photowall_editor.dll
echo.

endlocal
