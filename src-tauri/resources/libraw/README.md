# LibRaw DLL 部署说明

PhotoWall 使用 LibRaw 库来提取 RAW 图片的嵌入预览图。

## 获取 LibRaw DLL

### 方式 A：下载预编译版本（推荐）

1. 访问 LibRaw 官方下载页面：https://www.libraw.org/download
2. 下载 Windows 预编译版本（选择与系统匹配的版本）
3. 解压后将 `libraw.dll` 复制到此目录

### 方式 B：从 vcpkg 安装

```powershell
vcpkg install libraw:x64-windows
```

然后从 vcpkg 安装目录复制 DLL。

### 方式 C：自行编译

参考 LibRaw 官方文档进行编译。

## 文件结构

部署后此目录应包含：

```
resources/libraw/
├── libraw.dll          # LibRaw 动态库（必需）
├── LICENSE.LibRaw.txt  # 许可证文件（已包含）
└── README.md           # 本说明文件
```

## 注意事项

- 确保 DLL 版本与系统架构匹配（x64）
- LibRaw 采用 LGPL/CDDL 双许可证
- 如果没有 libraw.dll，应用会自动回退到其他预览提取方法
