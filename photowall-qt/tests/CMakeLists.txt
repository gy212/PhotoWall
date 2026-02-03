cmake_minimum_required(VERSION 3.16)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Quick QuickControls2 Test)

# Core sources (without main.cpp) for testing
set(CORE_SOURCES
    ${CMAKE_SOURCE_DIR}/src/core/RustBridge.cpp
    ${CMAKE_SOURCE_DIR}/src/core/PhotoModel.cpp
    ${CMAKE_SOURCE_DIR}/src/core/ThumbnailProvider.cpp
    ${CMAKE_SOURCE_DIR}/src/core/PhotoStore.cpp
    ${CMAKE_SOURCE_DIR}/src/core/EventDispatcher.cpp
    ${CMAKE_SOURCE_DIR}/src/core/FolderTreeModel.cpp
    ${CMAKE_SOURCE_DIR}/src/utils/JsonHelper.cpp
)

set(CORE_HEADERS
    ${CMAKE_SOURCE_DIR}/src/core/RustBridge.h
    ${CMAKE_SOURCE_DIR}/src/core/PhotoModel.h
    ${CMAKE_SOURCE_DIR}/src/core/ThumbnailProvider.h
    ${CMAKE_SOURCE_DIR}/src/core/PhotoStore.h
    ${CMAKE_SOURCE_DIR}/src/core/EventDispatcher.h
    ${CMAKE_SOURCE_DIR}/src/core/FolderTreeModel.h
    ${CMAKE_SOURCE_DIR}/src/utils/JsonHelper.h
    ${CMAKE_SOURCE_DIR}/include/photowall.h
)

# PhotoWallCore static library (for linking with tests)
add_library(PhotoWallCore STATIC ${CORE_SOURCES} ${CORE_HEADERS})
target_include_directories(PhotoWallCore PUBLIC
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/include
)
target_link_libraries(PhotoWallCore PUBLIC
    Qt6::Core
    Qt6::Gui
    Qt6::Quick
    Qt6::QuickControls2
)

# Test common library
set(TEST_COMMON_SOURCES
    common/TestUtils.cpp
    mocks/MockFFI.cpp
    mocks/MockPhotoDatabase.cpp
)

set(TEST_COMMON_HEADERS
    common/TestConfig.h
    common/TestUtils.h
    common/TestDataGenerator.h
    mocks/MockFFI.h
    mocks/MockPhotoDatabase.h
)

add_library(PhotoWallTestCommon STATIC ${TEST_COMMON_SOURCES} ${TEST_COMMON_HEADERS})
target_include_directories(PhotoWallTestCommon PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/src
    ${CMAKE_SOURCE_DIR}/include
)
target_link_libraries(PhotoWallTestCommon PUBLIC
    PhotoWallCore
    Qt6::Test
)

# Macro to add E2E tests
macro(add_e2e_test TEST_NAME)
    add_executable(${TEST_NAME} e2e/${TEST_NAME}.cpp)
    target_link_libraries(${TEST_NAME} PRIVATE PhotoWallTestCommon)
    add_test(NAME ${TEST_NAME} COMMAND ${TEST_NAME})
    set_tests_properties(${TEST_NAME} PROPERTIES
        ENVIRONMENT "QT_QPA_PLATFORM=offscreen"
    )
endmacro()

# E2E Tests
add_e2e_test(tst_IndexingWorkflow)
add_e2e_test(tst_BrowsingWorkflow)
add_e2e_test(tst_SearchWorkflow)
add_e2e_test(tst_TagsWorkflow)
add_e2e_test(tst_TrashWorkflow)
add_e2e_test(tst_FullWorkflow)
