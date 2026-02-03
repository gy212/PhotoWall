#include "TestUtils.h"
#include <QCoreApplication>
#include <QDir>
#include <QTemporaryDir>
#include <QElapsedTimer>

namespace TestUtils {

bool waitForSignal(QSignalSpy& spy, int timeout)
{
    if (spy.count() > 0) {
        return true;
    }
    return spy.wait(timeout);
}

bool waitForCondition(std::function<bool()> condition, int timeout)
{
    QElapsedTimer timer;
    timer.start();

    while (!condition() && timer.elapsed() < timeout) {
        QCoreApplication::processEvents(QEventLoop::AllEvents, 50);
    }

    return condition();
}

bool jsonEquals(const QJsonObject& actual, const QJsonObject& expected)
{
    if (actual.keys() != expected.keys()) {
        return false;
    }

    for (const QString& key : expected.keys()) {
        if (actual.value(key) != expected.value(key)) {
            return false;
        }
    }

    return true;
}

bool jsonArrayEquals(const QJsonArray& actual, const QJsonArray& expected)
{
    if (actual.size() != expected.size()) {
        return false;
    }

    for (int i = 0; i < expected.size(); ++i) {
        if (actual.at(i) != expected.at(i)) {
            return false;
        }
    }

    return true;
}

QString createTempDir(const QString& prefix)
{
    QTemporaryDir tempDir(QDir::tempPath() + "/" + prefix + "_XXXXXX");
    tempDir.setAutoRemove(false);
    return tempDir.path();
}

bool removeDir(const QString& path)
{
    QDir dir(path);
    return dir.removeRecursively();
}

} // namespace TestUtils
