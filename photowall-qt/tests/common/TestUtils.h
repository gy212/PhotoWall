#ifndef TESTUTILS_H
#define TESTUTILS_H

#include <QObject>
#include <QSignalSpy>
#include <QJsonObject>
#include <QJsonArray>
#include <QString>
#include <functional>

namespace TestUtils {

/**
 * Wait for a signal with timeout.
 * @param spy Signal spy to wait on
 * @param timeout Timeout in milliseconds
 * @return true if signal was received
 */
bool waitForSignal(QSignalSpy& spy, int timeout = 3000);

/**
 * Wait for a condition to become true.
 * @param condition Function returning bool
 * @param timeout Timeout in milliseconds
 * @return true if condition became true
 */
bool waitForCondition(std::function<bool()> condition, int timeout = 3000);

/**
 * Compare two JSON objects for equality.
 * @param actual Actual JSON object
 * @param expected Expected JSON object
 * @return true if equal
 */
bool jsonEquals(const QJsonObject& actual, const QJsonObject& expected);

/**
 * Compare two JSON arrays for equality.
 * @param actual Actual JSON array
 * @param expected Expected JSON array
 * @return true if equal
 */
bool jsonArrayEquals(const QJsonArray& actual, const QJsonArray& expected);

/**
 * Create a temporary directory for test data.
 * @param prefix Directory name prefix
 * @return Path to created directory
 */
QString createTempDir(const QString& prefix = QStringLiteral("photowall_test"));

/**
 * Remove a directory and all its contents.
 * @param path Directory path
 * @return true if successful
 */
bool removeDir(const QString& path);

} // namespace TestUtils

#endif // TESTUTILS_H
