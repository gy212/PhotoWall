#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"
#include "core/PhotoModel.h"

class tst_SearchWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testSearchByFilename();
    void testFilterByFavorite();
    void testFilterByRating();
    void testFilterByTag();
    void testMultipleFilters();
    void testClearFilters();

private:
    void setupTestData();

    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
    PhotoModel* m_model = nullptr;
};

void tst_SearchWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_SearchWorkflow::cleanupTestCase()
{
}

void tst_SearchWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();
    m_model = new PhotoModel(this);

    connect(m_bridge, &RustBridge::photosReady,
            m_model, &PhotoModel::onPhotosReady);

    setupTestData();
}

void tst_SearchWorkflow::cleanup()
{
    delete m_model;
    m_model = nullptr;
    m_bridge->shutdown();
}

void tst_SearchWorkflow::setupTestData()
{
    // Create photos with various attributes
    for (int i = 1; i <= 50; ++i) {
        QJsonObject options;
        options["fileName"] = QString("vacation_%1.jpg").arg(i);
        options["isFavorite"] = (i % 5 == 0);  // Every 5th photo is favorite
        options["rating"] = (i % 6);  // Ratings 0-5

        QJsonObject photo = TestDataGenerator::generatePhoto(i, options);
        m_mockFFI->database()->addPhoto(photo);
    }

    // Add some photos with different names
    for (int i = 51; i <= 60; ++i) {
        QJsonObject options;
        options["fileName"] = QString("birthday_%1.jpg").arg(i);
        options["isFavorite"] = true;
        options["rating"] = 5;

        QJsonObject photo = TestDataGenerator::generatePhoto(i, options);
        m_mockFFI->database()->addPhoto(photo);
    }

    // Create a tag and assign to some photos
    QJsonObject tag = m_mockFFI->database()->createTag("Nature", "#00FF00");
    qint64 tagId = tag.value("id").toInteger();
    m_mockFFI->database()->addTagToPhotos(tagId, {1, 2, 3, 4, 5});
}

void tst_SearchWorkflow::testSearchByFilename()
{
    // Set search filter for filename
    QJsonObject filters;
    filters["query"] = "vacation";
    m_model->setSearchFilters(filters);

    // Load with filters
    m_model->loadInitial();

    // Wait for results
    QTRY_VERIFY(m_model->count() > 0);

    // Should find 50 vacation photos
    QCOMPARE(m_model->count(), 50);

    // Verify all results contain "vacation"
    for (int i = 0; i < m_model->count(); ++i) {
        QModelIndex index = m_model->index(i);
        QString fileName = m_model->data(index, PhotoModel::FileNameRole).toString();
        QVERIFY(fileName.contains("vacation"));
    }
}

void tst_SearchWorkflow::testFilterByFavorite()
{
    // Set favorite filter
    QJsonObject filters;
    filters["favoritesOnly"] = true;
    m_model->setSearchFilters(filters);

    m_model->loadInitial();
    QTRY_VERIFY(m_model->count() > 0);

    // 10 vacation photos (every 5th) + 10 birthday photos = 20 favorites
    QCOMPARE(m_model->count(), 20);

    // Verify all results are favorites
    for (int i = 0; i < m_model->count(); ++i) {
        QModelIndex index = m_model->index(i);
        bool isFavorite = m_model->data(index, PhotoModel::IsFavoriteRole).toBool();
        QVERIFY(isFavorite);
    }
}

void tst_SearchWorkflow::testFilterByRating()
{
    // Set minimum rating filter
    QJsonObject filters;
    filters["minRating"] = 4;
    m_model->setSearchFilters(filters);

    m_model->loadInitial();
    QTRY_VERIFY(m_model->count() > 0);

    // Verify all results have rating >= 4
    for (int i = 0; i < m_model->count(); ++i) {
        QModelIndex index = m_model->index(i);
        int rating = m_model->data(index, PhotoModel::RatingRole).toInt();
        QVERIFY(rating >= 4);
    }
}

void tst_SearchWorkflow::testFilterByTag()
{
    // Get the tag ID
    QJsonArray tags = m_mockFFI->database()->getAllTags();
    QVERIFY(tags.size() > 0);
    qint64 tagId = tags.at(0).toObject().value("id").toInteger();

    // Set tag filter
    QJsonObject filters;
    QJsonArray tagIds;
    tagIds.append(tagId);
    filters["tagIds"] = tagIds;
    m_model->setSearchFilters(filters);

    m_model->loadInitial();
    QTRY_VERIFY(m_model->count() > 0);

    // Should find 5 photos with the tag
    QCOMPARE(m_model->count(), 5);
}

void tst_SearchWorkflow::testMultipleFilters()
{
    // Combine filters: favorite + query
    QJsonObject filters;
    filters["favoritesOnly"] = true;
    filters["query"] = "birthday";
    m_model->setSearchFilters(filters);

    m_model->loadInitial();
    QTRY_VERIFY(m_model->count() > 0);

    // Should find 10 birthday photos (all are favorites)
    QCOMPARE(m_model->count(), 10);

    // Verify all match both criteria
    for (int i = 0; i < m_model->count(); ++i) {
        QModelIndex index = m_model->index(i);
        QString fileName = m_model->data(index, PhotoModel::FileNameRole).toString();
        bool isFavorite = m_model->data(index, PhotoModel::IsFavoriteRole).toBool();
        QVERIFY(fileName.contains("birthday"));
        QVERIFY(isFavorite);
    }
}

void tst_SearchWorkflow::testClearFilters()
{
    // First apply a filter
    QJsonObject filters;
    filters["favoritesOnly"] = true;
    m_model->setSearchFilters(filters);
    m_model->loadInitial();
    QTRY_VERIFY(m_model->count() > 0);
    int filteredCount = m_model->count();

    // Clear filters
    m_model->setSearchFilters(QJsonObject());
    m_model->refresh();

    // Wait for refresh
    QTRY_VERIFY(m_model->count() > filteredCount);

    // Should show all 60 photos
    QCOMPARE(m_model->count(), 60);
}

QTEST_MAIN(tst_SearchWorkflow)
#include "tst_SearchWorkflow.moc"
