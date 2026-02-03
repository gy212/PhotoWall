cmake_minimum_required(VERSION 3.16)
project(PhotoWallQt VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Quick QuickControls2 Core5Compat)

set(SOURCES
    src/main.cpp
    src/core/RustBridge.cpp
    src/core/PhotoModel.cpp
    src/core/ThumbnailProvider.cpp
    src/core/PhotoStore.cpp
    src/core/EventDispatcher.cpp
    src/core/FolderTreeModel.cpp
    src/utils/JsonHelper.cpp
)

set(HEADERS
    src/core/RustBridge.h
    src/core/PhotoModel.h
    src/core/ThumbnailProvider.h
    src/core/PhotoStore.h
    src/core/EventDispatcher.h
    src/core/FolderTreeModel.h
    src/utils/JsonHelper.h
    include/photowall.h
)

set(RESOURCES
    resources/resources.qrc
)

add_executable(PhotoWallQt ${SOURCES} ${HEADERS} ${RESOURCES})

target_include_directories(PhotoWallQt PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(PhotoWallQt PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Core5Compat
)

# Link against the Rust FFI library (photowall_core.dll/.lib)
set(PHOTOWALL_FFI_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../src-tauri/target")
set(PHOTOWALL_FFI_DEBUG_LIB "${PHOTOWALL_FFI_DIR}/debug/photowall_core.dll.lib")
set(PHOTOWALL_FFI_RELEASE_LIB "${PHOTOWALL_FFI_DIR}/release/photowall_core.dll.lib")
set(PHOTOWALL_FFI_DEBUG_DLL "${PHOTOWALL_FFI_DIR}/debug/photowall_core.dll")
set(PHOTOWALL_FFI_RELEASE_DLL "${PHOTOWALL_FFI_DIR}/release/photowall_core.dll")

if (EXISTS "${PHOTOWALL_FFI_DEBUG_LIB}")
    set(PHOTOWALL_FFI_LIB "${PHOTOWALL_FFI_DEBUG_LIB}")
    set(PHOTOWALL_FFI_DLL "${PHOTOWALL_FFI_DEBUG_DLL}")
elseif (EXISTS "${PHOTOWALL_FFI_RELEASE_LIB}")
    set(PHOTOWALL_FFI_LIB "${PHOTOWALL_FFI_RELEASE_LIB}")
    set(PHOTOWALL_FFI_DLL "${PHOTOWALL_FFI_RELEASE_DLL}")
else()
    message(FATAL_ERROR "photowall_core.lib not found. Build photowall-ffi with cargo.")
endif()

target_link_libraries(PhotoWallQt PRIVATE "${PHOTOWALL_FFI_LIB}")

if (EXISTS "${PHOTOWALL_FFI_DLL}")
    add_custom_command(TARGET PhotoWallQt POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${PHOTOWALL_FFI_DLL}"
            $<TARGET_FILE_DIR:PhotoWallQt>
    )
endif()

# Install rules
install(TARGETS PhotoWallQt
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# Testing
option(BUILD_TESTS "Build test suite" ON)
if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()
