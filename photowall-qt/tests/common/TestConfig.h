#ifndef TESTCONFIG_H
#define TESTCONFIG_H

#include <QString>

namespace TestConfig {

// Test timeouts (milliseconds)
constexpr int DEFAULT_TIMEOUT = 5000;
constexpr int SIGNAL_TIMEOUT = 3000;
constexpr int ASYNC_TIMEOUT = 10000;

// Test data sizes
constexpr int DEFAULT_PHOTO_COUNT = 100;
constexpr int SMALL_PHOTO_COUNT = 10;
constexpr int LARGE_PHOTO_COUNT = 1000;

// Page sizes
constexpr int DEFAULT_PAGE_SIZE = 100;

// Test paths
inline QString testDataPath() {
    return QStringLiteral(":/test_data");
}

inline QString testResponsesPath() {
    return QStringLiteral(":/test_responses");
}

} // namespace TestConfig

#endif // TESTCONFIG_H
