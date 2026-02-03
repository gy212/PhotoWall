#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"
#include "core/PhotoModel.h"

/**
 * Full workflow E2E test covering:
 * Index -> Browse -> Search -> Tag -> Trash
 */
class tst_FullWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testCompleteWorkflow();

private:
    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
    PhotoModel* m_photoModel = nullptr;
};

void tst_FullWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_FullWorkflow::cleanupTestCase()
{
}

void tst_FullWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();

    m_photoModel = new PhotoModel(this);
    connect(m_bridge, &RustBridge::photosReady,
            m_photoModel, &PhotoModel::onPhotosReady);
}

void tst_FullWorkflow::cleanup()
{
    delete m_photoModel;
    m_photoModel = nullptr;
    m_bridge->shutdown();
}

void tst_FullWorkflow::testCompleteWorkflow()
{
    // ========================================================================
    // Step 1: Index a directory
    // ========================================================================
    qDebug() << "Step 1: Starting indexing...";

    QSignalSpy indexFinishedSpy(m_bridge, &RustBridge::indexFinished);

    // Start indexing
    quint64 jobId = m_bridge->indexDirectoryAsync("C:/Photos");
    QVERIFY(jobId > 0);

    // Simulate indexing progress and completion
    m_mockFFI->simulateIndexProgress(50, 100, "C:/Photos/photo50.jpg");
    m_mockFFI->simulateIndexProgress(100, 100, "C:/Photos/photo100.jpg");

    // Add photos to database (simulating what indexing would do)
    for (int i = 1; i <= 100; ++i) {
        QJsonObject options;
        options["fileName"] = QString("photo_%1.jpg").arg(i);
        options["isFavorite"] = (i <= 10);  // First 10 are favorites
        options["rating"] = (i % 6);

        QJsonObject photo = TestDataGenerator::generatePhoto(i, options);
        m_mockFFI->database()->addPhoto(photo);
    }

    // Simulate indexing finished
    m_mockFFI->simulateIndexFinished(100, 0, 0);
    QTRY_COMPARE(indexFinishedSpy.count(), 1);

    qDebug() << "Step 1: Indexing complete. 100 photos indexed.";

    // ========================================================================
    // Step 2: Browse photos
    // ========================================================================
    qDebug() << "Step 2: Browsing photos...";

    // Load initial photos
    m_photoModel->loadInitial();
    QTRY_COMPARE(m_photoModel->count(), 100);
    QCOMPARE(m_photoModel->totalCount(), 100);

    qDebug() << "Step 2: Loaded" << m_photoModel->count() << "photos.";

    // ========================================================================
    // Step 3: Search and filter
    // ========================================================================
    qDebug() << "Step 3: Searching for favorites...";

    // Filter by favorites
    QJsonObject filters;
    filters["favoritesOnly"] = true;
    m_photoModel->setSearchFilters(filters);
    m_photoModel->refresh();

    QTRY_COMPARE(m_photoModel->count(), 10);
    qDebug() << "Step 3: Found" << m_photoModel->count() << "favorite photos.";

    // Clear filters
    m_photoModel->setSearchFilters(QJsonObject());
    m_photoModel->refresh();
    QTRY_COMPARE(m_photoModel->count(), 100);

    // ========================================================================
    // Step 4: Create and apply tags
    // ========================================================================
    qDebug() << "Step 4: Creating and applying tags...";

    // Create tags
    QJsonObject natureTag = m_bridge->createTag("Nature", "#4CAF50");
    QJsonObject portraitTag = m_bridge->createTag("Portrait", "#2196F3");

    qint64 natureTagId = natureTag.value("id").toInteger();
    qint64 portraitTagId = portraitTag.value("id").toInteger();

    QVERIFY(natureTagId > 0);
    QVERIFY(portraitTagId > 0);

    // Add nature tag to photos 1-20
    QList<qint64> naturePhotoIds;
    for (int i = 1; i <= 20; ++i) {
        naturePhotoIds.append(i);
    }
    bool success = m_bridge->addTagToPhotos(natureTagId, naturePhotoIds);
    QVERIFY(success);

    // Add portrait tag to photos 15-30
    QList<qint64> portraitPhotoIds;
    for (int i = 15; i <= 30; ++i) {
        portraitPhotoIds.append(i);
    }
    success = m_bridge->addTagToPhotos(portraitTagId, portraitPhotoIds);
    QVERIFY(success);

    // Verify tags were applied
    QJsonArray photosWithNature = m_mockFFI->database()->getPhotosWithTag(natureTagId);
    QCOMPARE(photosWithNature.size(), 20);

    QJsonArray photosWithPortrait = m_mockFFI->database()->getPhotosWithTag(portraitTagId);
    QCOMPARE(photosWithPortrait.size(), 16);

    qDebug() << "Step 4: Applied Nature tag to 20 photos, Portrait tag to 16 photos.";

    // Filter by tag
    filters = QJsonObject();
    QJsonArray tagIds;
    tagIds.append(natureTagId);
    filters["tagIds"] = tagIds;
    m_photoModel->setSearchFilters(filters);
    m_photoModel->refresh();

    QTRY_COMPARE(m_photoModel->count(), 20);
    qDebug() << "Step 4: Filtered by Nature tag, found" << m_photoModel->count() << "photos.";

    // Clear filters
    m_photoModel->setSearchFilters(QJsonObject());
    m_photoModel->refresh();
    QTRY_COMPARE(m_photoModel->count(), 100);

    // ========================================================================
    // Step 5: Move photos to trash
    // ========================================================================
    qDebug() << "Step 5: Moving photos to trash...";

    // Move photos 91-100 to trash
    QList<qint64> trashPhotoIds;
    for (int i = 91; i <= 100; ++i) {
        trashPhotoIds.append(i);
    }
    success = m_bridge->trashPhotos(trashPhotoIds);
    QVERIFY(success);

    // Verify photos are in trash
    QJsonArray trashedPhotos = m_mockFFI->database()->getTrashedPhotos();
    QCOMPARE(trashedPhotos.size(), 10);

    // Verify main photo count decreased
    QCOMPARE(m_mockFFI->database()->photoCount(), 90);

    qDebug() << "Step 5: Moved 10 photos to trash. Remaining:" << m_mockFFI->database()->photoCount();

    // Refresh model
    m_photoModel->refresh();
    QTRY_COMPARE(m_photoModel->count(), 90);

    // ========================================================================
    // Step 6: Restore some photos from trash
    // ========================================================================
    qDebug() << "Step 6: Restoring photos from trash...";

    // Restore photos 91-95
    QList<qint64> restorePhotoIds = {91, 92, 93, 94, 95};
    success = m_bridge->restorePhotos(restorePhotoIds);
    QVERIFY(success);

    // Verify trash count
    trashedPhotos = m_mockFFI->database()->getTrashedPhotos();
    QCOMPARE(trashedPhotos.size(), 5);

    // Verify main photo count
    QCOMPARE(m_mockFFI->database()->photoCount(), 95);

    qDebug() << "Step 6: Restored 5 photos. Remaining in trash:" << trashedPhotos.size();

    // ========================================================================
    // Step 7: Permanently delete remaining trash
    // ========================================================================
    qDebug() << "Step 7: Permanently deleting trash...";

    QList<qint64> permanentDeleteIds = {96, 97, 98, 99, 100};
    success = m_bridge->deletePhotosPermanently(permanentDeleteIds);
    QVERIFY(success);

    // Verify trash is empty
    trashedPhotos = m_mockFFI->database()->getTrashedPhotos();
    QCOMPARE(trashedPhotos.size(), 0);

    // Verify photos are completely gone
    for (qint64 id : permanentDeleteIds) {
        QJsonObject photo = m_mockFFI->database()->getPhoto(id);
        QVERIFY(photo.isEmpty());
    }

    qDebug() << "Step 7: Permanently deleted 5 photos. Trash is now empty.";

    // ========================================================================
    // Final verification
    // ========================================================================
    qDebug() << "Final verification...";

    // Refresh model
    m_photoModel->refresh();
    QTRY_COMPARE(m_photoModel->count(), 95);

    // Verify all tags still exist
    QJsonArray allTags = m_bridge->getAllTags();
    QCOMPARE(allTags.size(), 2);

    // Verify tag associations are intact
    photosWithNature = m_mockFFI->database()->getPhotosWithTag(natureTagId);
    QCOMPARE(photosWithNature.size(), 20);  // All nature-tagged photos still exist

    qDebug() << "=== Full workflow test completed successfully ===";
    qDebug() << "Final state:";
    qDebug() << "  - Total photos:" << m_mockFFI->database()->photoCount();
    qDebug() << "  - Photos in trash:" << m_mockFFI->database()->getTrashedPhotos().size();
    qDebug() << "  - Total tags:" << allTags.size();
}

QTEST_MAIN(tst_FullWorkflow)
#include "tst_FullWorkflow.moc"
