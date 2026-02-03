#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"
#include "core/PhotoModel.h"

class tst_TrashWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testMoveToTrash();
    void testRestoreFromTrash();
    void testPermanentDelete();
    void testTrashModelUpdates();

private:
    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
    PhotoModel* m_photoModel = nullptr;
    PhotoModel* m_trashModel = nullptr;
};

void tst_TrashWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_TrashWorkflow::cleanupTestCase()
{
}

void tst_TrashWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();

    m_photoModel = new PhotoModel(this);
    m_trashModel = new PhotoModel(this);

    connect(m_bridge, &RustBridge::photosReady,
            m_photoModel, &PhotoModel::onPhotosReady);

    // Add test photos
    QJsonArray photos = TestDataGenerator::generatePhotos(20);
    m_mockFFI->database()->addPhotos(photos);
}

void tst_TrashWorkflow::cleanup()
{
    delete m_photoModel;
    delete m_trashModel;
    m_photoModel = nullptr;
    m_trashModel = nullptr;
    m_bridge->shutdown();
}

void tst_TrashWorkflow::testMoveToTrash()
{
    // Verify initial photo count
    QCOMPARE(m_mockFFI->database()->photoCount(), 20);

    // Move photos to trash
    QList<qint64> photoIds = {1, 2, 3};
    bool success = m_bridge->trashPhotos(photoIds);
    QVERIFY(success);

    // Verify photos are in trash
    QJsonArray trashedPhotos = m_mockFFI->database()->getTrashedPhotos();
    QCOMPARE(trashedPhotos.size(), 3);

    // Verify photos are no longer in main list
    QCOMPARE(m_mockFFI->database()->photoCount(), 17);

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("trashSoftDelete"));
}

void tst_TrashWorkflow::testRestoreFromTrash()
{
    // First move photos to trash
    QList<qint64> photoIds = {1, 2, 3, 4, 5};
    m_bridge->trashPhotos(photoIds);
    QCOMPARE(m_mockFFI->database()->getTrashedPhotos().size(), 5);
    QCOMPARE(m_mockFFI->database()->photoCount(), 15);

    // Restore some photos
    QList<qint64> restoreIds = {1, 2};
    bool success = m_bridge->restorePhotos(restoreIds);
    QVERIFY(success);

    // Verify photos are restored
    QCOMPARE(m_mockFFI->database()->getTrashedPhotos().size(), 3);
    QCOMPARE(m_mockFFI->database()->photoCount(), 17);

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("trashRestore"));
}

void tst_TrashWorkflow::testPermanentDelete()
{
    // First move photos to trash
    QList<qint64> photoIds = {1, 2, 3};
    m_bridge->trashPhotos(photoIds);
    QCOMPARE(m_mockFFI->database()->getTrashedPhotos().size(), 3);

    // Permanently delete
    bool success = m_bridge->deletePhotosPermanently(photoIds);
    QVERIFY(success);

    // Verify photos are completely gone
    QCOMPARE(m_mockFFI->database()->getTrashedPhotos().size(), 0);

    // Verify photos don't exist at all
    QJsonObject photo1 = m_mockFFI->database()->getPhoto(1);
    QVERIFY(photo1.isEmpty());

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("trashPermanentDelete"));
}

void tst_TrashWorkflow::testTrashModelUpdates()
{
    // Load initial photos
    m_photoModel->loadInitial();
    QTRY_COMPARE(m_photoModel->count(), 20);

    // Move some photos to trash
    QList<qint64> photoIds = {1, 2, 3, 4, 5};
    m_bridge->trashPhotos(photoIds);

    // Refresh photo model
    m_photoModel->refresh();
    QTRY_COMPARE(m_photoModel->count(), 15);

    // Load trash model with deleted filter
    QJsonObject trashFilters;
    trashFilters["inTrash"] = true;
    m_trashModel->setSearchFilters(trashFilters);
    m_trashModel->loadInitial();

    // Verify trash model shows deleted photos
    QTRY_COMPARE(m_trashModel->count(), 5);

    // Verify all photos in trash model are marked as deleted
    for (int i = 0; i < m_trashModel->count(); ++i) {
        QModelIndex index = m_trashModel->index(i);
        qint64 id = m_trashModel->data(index, PhotoModel::PhotoIdRole).toLongLong();
        QVERIFY(photoIds.contains(id));
    }
}

QTEST_MAIN(tst_TrashWorkflow)
#include "tst_TrashWorkflow.moc"
