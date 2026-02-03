#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"
#include "core/PhotoModel.h"

class tst_BrowsingWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testLoadInitialPhotos();
    void testLoadMorePhotos();
    void testSelectSinglePhoto();
    void testSelectRange();
    void testSelectAll();
    void testClearSelection();

private:
    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
    PhotoModel* m_model = nullptr;
};

void tst_BrowsingWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_BrowsingWorkflow::cleanupTestCase()
{
}

void tst_BrowsingWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();
    m_model = new PhotoModel(this);

    // Connect model to bridge
    connect(m_bridge, &RustBridge::photosReady,
            m_model, &PhotoModel::onPhotosReady);

    // Populate mock database with test photos
    QJsonArray photos = TestDataGenerator::generatePhotos(150);
    m_mockFFI->database()->addPhotos(photos);
}

void tst_BrowsingWorkflow::cleanup()
{
    delete m_model;
    m_model = nullptr;
    m_bridge->shutdown();
}

void tst_BrowsingWorkflow::testLoadInitialPhotos()
{
    QSignalSpy countSpy(m_model, &PhotoModel::countChanged);

    // Load initial photos
    m_model->loadInitial();

    // Wait for photos to load
    QTRY_VERIFY(m_model->count() > 0);

    // Verify page size
    QCOMPARE(m_model->count(), 100);  // Default page size

    // Verify hasMore is true (150 total, 100 loaded)
    QVERIFY(m_model->hasMore());

    // Verify total count
    QCOMPARE(m_model->totalCount(), 150);
}

void tst_BrowsingWorkflow::testLoadMorePhotos()
{
    // Load initial photos first
    m_model->loadInitial();
    QTRY_COMPARE(m_model->count(), 100);

    QSignalSpy countSpy(m_model, &PhotoModel::countChanged);

    // Load more photos
    m_model->loadMore();

    // Wait for more photos
    QTRY_COMPARE(m_model->count(), 150);

    // Verify no more pages
    QVERIFY(!m_model->hasMore());
}

void tst_BrowsingWorkflow::testSelectSinglePhoto()
{
    // Load photos
    m_model->loadInitial();
    QTRY_COMPARE(m_model->count(), 100);

    QSignalSpy selectionSpy(m_model, &PhotoModel::selectionChanged);

    // Select a single photo
    m_model->setSelected(1, true);

    // Verify selection
    QVERIFY(m_model->isSelected(1));
    QCOMPARE(m_model->selectedIds().size(), 1);
    QCOMPARE(m_model->selectedIds().first(), 1);

    // Verify signal was emitted
    QCOMPARE(selectionSpy.count(), 1);
}

void tst_BrowsingWorkflow::testSelectRange()
{
    // Load photos
    m_model->loadInitial();
    QTRY_COMPARE(m_model->count(), 100);

    // Select first photo
    m_model->setSelected(1, true);

    // Select range (photos 1-5)
    for (qint64 i = 2; i <= 5; ++i) {
        m_model->setSelected(i, true);
    }

    // Verify selection count
    QCOMPARE(m_model->selectedIds().size(), 5);

    // Verify all photos in range are selected
    for (qint64 i = 1; i <= 5; ++i) {
        QVERIFY(m_model->isSelected(i));
    }

    // Verify photo outside range is not selected
    QVERIFY(!m_model->isSelected(6));
}

void tst_BrowsingWorkflow::testSelectAll()
{
    // Load photos
    m_model->loadInitial();
    QTRY_COMPARE(m_model->count(), 100);

    // Select all loaded photos
    for (int i = 0; i < m_model->count(); ++i) {
        QModelIndex index = m_model->index(i);
        qint64 id = m_model->data(index, PhotoModel::PhotoIdRole).toLongLong();
        m_model->setSelected(id, true);
    }

    // Verify all are selected
    QCOMPARE(m_model->selectedIds().size(), 100);
}

void tst_BrowsingWorkflow::testClearSelection()
{
    // Load photos and select some
    m_model->loadInitial();
    QTRY_COMPARE(m_model->count(), 100);

    m_model->setSelected(1, true);
    m_model->setSelected(2, true);
    m_model->setSelected(3, true);
    QCOMPARE(m_model->selectedIds().size(), 3);

    QSignalSpy selectionSpy(m_model, &PhotoModel::selectionChanged);

    // Clear selection
    m_model->clearSelection();

    // Verify selection is empty
    QCOMPARE(m_model->selectedIds().size(), 0);
    QVERIFY(!m_model->isSelected(1));
    QVERIFY(!m_model->isSelected(2));
    QVERIFY(!m_model->isSelected(3));

    // Verify signal was emitted
    QVERIFY(selectionSpy.count() > 0);
}

QTEST_MAIN(tst_BrowsingWorkflow)
#include "tst_BrowsingWorkflow.moc"
