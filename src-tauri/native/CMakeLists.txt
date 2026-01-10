cmake_minimum_required(VERSION 3.16)
project(photowall_editor VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Windows 特定设置
if(WIN32)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
    set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS OFF)
endif()

# libvips 路径 (需要根据实际安装位置调整)
set(VIPS_ROOT "${CMAKE_SOURCE_DIR}/../vips-dev-8.18" CACHE PATH "libvips installation path")

# 查找 libvips
find_path(VIPS_INCLUDE_DIR
    NAMES vips/vips.h
    PATHS "${VIPS_ROOT}/include"
    NO_DEFAULT_PATH
)

find_library(VIPS_LIBRARY
    NAMES vips libvips
    PATHS "${VIPS_ROOT}/lib"
    NO_DEFAULT_PATH
)

find_library(GLIB_LIBRARY
    NAMES glib-2.0 libglib-2.0
    PATHS "${VIPS_ROOT}/lib"
    NO_DEFAULT_PATH
)

find_library(GOBJECT_LIBRARY
    NAMES gobject-2.0 libgobject-2.0
    PATHS "${VIPS_ROOT}/lib"
    NO_DEFAULT_PATH
)

if(NOT VIPS_INCLUDE_DIR OR NOT VIPS_LIBRARY)
    message(FATAL_ERROR "libvips not found. Please set VIPS_ROOT to the libvips installation directory.")
endif()

message(STATUS "Found libvips: ${VIPS_LIBRARY}")
message(STATUS "libvips include: ${VIPS_INCLUDE_DIR}")

# GLib 头文件路径
set(GLIB_INCLUDE_DIRS
    "${VIPS_ROOT}/include/glib-2.0"
    "${VIPS_ROOT}/lib/glib-2.0/include"
)

# 创建动态库
add_library(photowall_editor SHARED
    editor.cpp
    editor.h
)

target_include_directories(photowall_editor PRIVATE
    ${VIPS_INCLUDE_DIR}
    ${GLIB_INCLUDE_DIRS}
)

target_link_libraries(photowall_editor PRIVATE
    ${VIPS_LIBRARY}
    ${GLIB_LIBRARY}
    ${GOBJECT_LIBRARY}
)

# 导出符号
target_compile_definitions(photowall_editor PRIVATE PW_EDITOR_EXPORTS)

# 安装规则
install(TARGETS photowall_editor
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)

install(FILES editor.h DESTINATION include)

# 复制 libvips DLL 到输出目录 (Windows)
if(WIN32)
    file(GLOB VIPS_DLLS "${VIPS_ROOT}/bin/*.dll")
    foreach(DLL ${VIPS_DLLS})
        add_custom_command(TARGET photowall_editor POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${DLL}"
            "$<TARGET_FILE_DIR:photowall_editor>"
        )
    endforeach()
endif()
