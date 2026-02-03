#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"

class tst_IndexingWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testStartIndexing();
    void testIndexingProgress();
    void testIndexingCompletion();
    void testIndexingCancellation();
    void testIndexingUpdatesPhotoModel();

private:
    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
};

void tst_IndexingWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_IndexingWorkflow::cleanupTestCase()
{
}

void tst_IndexingWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();
}

void tst_IndexingWorkflow::cleanup()
{
    m_bridge->shutdown();
}

void tst_IndexingWorkflow::testStartIndexing()
{
    // Start indexing a directory
    quint64 jobId = m_bridge->indexDirectoryAsync("C:/Photos");

    // Verify job ID is valid
    QVERIFY(jobId > 0);

    // Verify FFI was called with correct path
    QVERIFY(m_mockFFI->wasCalledWith("indexDirectoryAsync"));
}

void tst_IndexingWorkflow::testIndexingProgress()
{
    QSignalSpy progressSpy(m_bridge, &RustBridge::indexProgress);

    // Start indexing
    m_bridge->indexDirectoryAsync("C:/Photos");

    // Simulate progress events
    m_mockFFI->simulateIndexProgress(10, 100, "C:/Photos/photo1.jpg");
    m_mockFFI->simulateIndexProgress(50, 100, "C:/Photos/photo50.jpg");
    m_mockFFI->simulateIndexProgress(100, 100, "C:/Photos/photo100.jpg");

    // Wait for signals
    QTRY_COMPARE(progressSpy.count(), 3);

    // Verify first progress event
    QList<QVariant> args = progressSpy.at(0);
    QCOMPARE(args.at(0).toInt(), 10);
    QCOMPARE(args.at(1).toInt(), 100);
    QCOMPARE(args.at(2).toString(), QString("C:/Photos/photo1.jpg"));

    // Verify last progress event
    args = progressSpy.at(2);
    QCOMPARE(args.at(0).toInt(), 100);
    QCOMPARE(args.at(1).toInt(), 100);
}

void tst_IndexingWorkflow::testIndexingCompletion()
{
    QSignalSpy finishedSpy(m_bridge, &RustBridge::indexFinished);

    // Start indexing
    m_bridge->indexDirectoryAsync("C:/Photos");

    // Simulate completion
    m_mockFFI->simulateIndexFinished(95, 3, 2);

    // Wait for signal
    QTRY_COMPARE(finishedSpy.count(), 1);

    // Verify completion stats
    QList<QVariant> args = finishedSpy.at(0);
    QCOMPARE(args.at(0).toInt(), 95);  // indexed
    QCOMPARE(args.at(1).toInt(), 3);   // skipped
    QCOMPARE(args.at(2).toInt(), 2);   // failed
}

void tst_IndexingWorkflow::testIndexingCancellation()
{
    QSignalSpy cancelledSpy(m_bridge, &RustBridge::indexCancelled);

    // Start indexing
    quint64 jobId = m_bridge->indexDirectoryAsync("C:/Photos");

    // Cancel the job
    m_bridge->cancelJob(jobId);

    // Wait for cancellation signal
    QTRY_COMPARE(cancelledSpy.count(), 1);

    // Verify cancel was called
    QVERIFY(m_mockFFI->wasCalledWith("cancelJob"));
}

void tst_IndexingWorkflow::testIndexingUpdatesPhotoModel()
{
    // Add photos to mock database after indexing
    QJsonArray photos = TestDataGenerator::generatePhotos(10);
    m_mockFFI->database()->addPhotos(photos);

    // Verify photos are available
    QJsonArray retrieved = m_mockFFI->database()->getPhotos(100);
    QCOMPARE(retrieved.size(), 10);

    // Verify first photo data
    QJsonObject firstPhoto = retrieved.at(0).toObject();
    QVERIFY(firstPhoto.contains("photoId"));
    QVERIFY(firstPhoto.contains("filePath"));
    QVERIFY(firstPhoto.contains("fileName"));
}

QTEST_MAIN(tst_IndexingWorkflow)
#include "tst_IndexingWorkflow.moc"
