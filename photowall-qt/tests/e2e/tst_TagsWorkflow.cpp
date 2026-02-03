#include <QtTest>
#include <QSignalSpy>
#include "mocks/MockFFI.h"
#include "common/TestConfig.h"
#include "common/TestUtils.h"
#include "common/TestDataGenerator.h"
#include "core/RustBridge.h"

class tst_TagsWorkflow : public QObject
{
    Q_OBJECT

private slots:
    void initTestCase();
    void cleanupTestCase();
    void init();
    void cleanup();

    void testCreateTag();
    void testGetAllTags();
    void testDeleteTag();
    void testAddTagToSelectedPhotos();
    void testRemoveTagFromSelectedPhotos();

private:
    MockFFI* m_mockFFI = nullptr;
    RustBridge* m_bridge = nullptr;
};

void tst_TagsWorkflow::initTestCase()
{
    m_mockFFI = MockFFI::instance();
}

void tst_TagsWorkflow::cleanupTestCase()
{
}

void tst_TagsWorkflow::init()
{
    MockFFI::resetInstance();
    m_bridge = RustBridge::instance();
    m_bridge->initialize();

    // Add test photos
    QJsonArray photos = TestDataGenerator::generatePhotos(20);
    m_mockFFI->database()->addPhotos(photos);
}

void tst_TagsWorkflow::cleanup()
{
    m_bridge->shutdown();
}

void tst_TagsWorkflow::testCreateTag()
{
    // Create a new tag
    QJsonObject tag = m_bridge->createTag("Landscape", "#4CAF50");

    // Verify tag was created
    QVERIFY(!tag.isEmpty());
    QVERIFY(tag.contains("id"));
    QCOMPARE(tag.value("name").toString(), QString("Landscape"));
    QCOMPARE(tag.value("color").toString(), QString("#4CAF50"));

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("createTag"));
}

void tst_TagsWorkflow::testGetAllTags()
{
    // Create some tags first
    m_bridge->createTag("Nature", "#00FF00");
    m_bridge->createTag("Portrait", "#FF0000");
    m_bridge->createTag("Urban", "#0000FF");

    // Get all tags
    QJsonArray tags = m_bridge->getAllTags();

    // Verify tags were retrieved
    QCOMPARE(tags.size(), 3);

    // Verify tag names
    QStringList names;
    for (const QJsonValue& val : tags) {
        names.append(val.toObject().value("name").toString());
    }
    QVERIFY(names.contains("Nature"));
    QVERIFY(names.contains("Portrait"));
    QVERIFY(names.contains("Urban"));
}

void tst_TagsWorkflow::testDeleteTag()
{
    // Create a tag
    QJsonObject tag = m_bridge->createTag("ToDelete", "#FF0000");
    qint64 tagId = tag.value("id").toInteger();

    // Verify tag exists
    QJsonArray tagsBefore = m_bridge->getAllTags();
    QCOMPARE(tagsBefore.size(), 1);

    // Delete the tag
    bool success = m_bridge->deleteTag(tagId);
    QVERIFY(success);

    // Verify tag was deleted
    QJsonArray tagsAfter = m_bridge->getAllTags();
    QCOMPARE(tagsAfter.size(), 0);

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("deleteTag"));
}

void tst_TagsWorkflow::testAddTagToSelectedPhotos()
{
    // Create a tag
    QJsonObject tag = m_bridge->createTag("Favorites", "#FFD700");
    qint64 tagId = tag.value("id").toInteger();

    // Add tag to selected photos
    QList<qint64> photoIds = {1, 2, 3, 4, 5};
    bool success = m_bridge->addTagToPhotos(tagId, photoIds);
    QVERIFY(success);

    // Verify photos have the tag
    QJsonArray photosWithTag = m_mockFFI->database()->getPhotosWithTag(tagId);
    QCOMPARE(photosWithTag.size(), 5);

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("addTagToPhoto"));
}

void tst_TagsWorkflow::testRemoveTagFromSelectedPhotos()
{
    // Create a tag and add to photos
    QJsonObject tag = m_bridge->createTag("ToRemove", "#FF0000");
    qint64 tagId = tag.value("id").toInteger();

    QList<qint64> photoIds = {1, 2, 3, 4, 5};
    m_bridge->addTagToPhotos(tagId, photoIds);

    // Verify photos have the tag
    QJsonArray photosWithTagBefore = m_mockFFI->database()->getPhotosWithTag(tagId);
    QCOMPARE(photosWithTagBefore.size(), 5);

    // Remove tag from some photos
    QList<qint64> removeFromIds = {1, 2, 3};
    bool success = m_bridge->removeTagFromPhotos(tagId, removeFromIds);
    QVERIFY(success);

    // Verify tag was removed from specified photos
    QJsonArray photosWithTagAfter = m_mockFFI->database()->getPhotosWithTag(tagId);
    QCOMPARE(photosWithTagAfter.size(), 2);

    // Verify FFI was called
    QVERIFY(m_mockFFI->wasCalledWith("removeTagFromPhoto"));
}

QTEST_MAIN(tst_TagsWorkflow)
#include "tst_TagsWorkflow.moc"
