#ifndef MOCKPHOTODATABASE_H
#define MOCKPHOTODATABASE_H

#include <QObject>
#include <QJsonObject>
#include <QJsonArray>
#include <QHash>
#include <QSet>
#include <QMutex>

/**
 * In-memory mock database for testing.
 * Provides CRUD operations for photos, tags, and albums.
 */
class MockPhotoDatabase : public QObject
{
    Q_OBJECT

public:
    explicit MockPhotoDatabase(QObject* parent = nullptr);
    ~MockPhotoDatabase() override = default;

    // Reset database to empty state
    void reset();

    // ========================================================================
    // Photos
    // ========================================================================
    void addPhoto(const QJsonObject& photo);
    void addPhotos(const QJsonArray& photos);
    QJsonObject getPhoto(qint64 id) const;
    QJsonArray getPhotos(int limit, int offset = 0) const;
    QJsonArray searchPhotos(const QJsonObject& filters, int limit, int offset = 0) const;
    bool updatePhoto(qint64 id, const QJsonObject& updates);
    bool batchUpdatePhotos(const QList<qint64>& ids, const QJsonObject& updates);
    bool deletePhoto(qint64 id);
    int photoCount() const;
    int totalPhotoCount(const QJsonObject& filters = {}) const;

    // Trash operations
    bool trashPhoto(qint64 id);
    bool restorePhoto(qint64 id);
    bool permanentlyDeletePhoto(qint64 id);
    QJsonArray getTrashedPhotos() const;

    // ========================================================================
    // Tags
    // ========================================================================
    QJsonObject createTag(const QString& name, const QString& color);
    QJsonArray getAllTags() const;
    bool deleteTag(qint64 tagId);
    QJsonObject updateTag(qint64 tagId, const QString& name, const QString& color);
    bool addTagToPhotos(qint64 tagId, const QList<qint64>& photoIds);
    bool removeTagFromPhotos(qint64 tagId, const QList<qint64>& photoIds);
    QJsonArray getPhotoTags(qint64 photoId) const;
    QJsonArray getPhotosWithTag(qint64 tagId) const;

    // ========================================================================
    // Albums
    // ========================================================================
    QJsonObject createAlbum(const QString& name, const QString& description);
    QJsonArray getAllAlbums() const;
    bool deleteAlbum(qint64 albumId);
    bool addPhotosToAlbum(qint64 albumId, const QList<qint64>& photoIds);
    bool removePhotosFromAlbum(qint64 albumId, const QList<qint64>& photoIds);
    QJsonArray getAlbumPhotos(qint64 albumId) const;

private:
    mutable QMutex m_mutex;

    // Photos storage
    QHash<qint64, QJsonObject> m_photos;
    qint64 m_nextPhotoId = 1;

    // Tags storage
    QHash<qint64, QJsonObject> m_tags;
    QHash<qint64, QSet<qint64>> m_photoTags;  // photoId -> tagIds
    qint64 m_nextTagId = 1;

    // Albums storage
    QHash<qint64, QJsonObject> m_albums;
    QHash<qint64, QSet<qint64>> m_albumPhotos;  // albumId -> photoIds
    qint64 m_nextAlbumId = 1;

    bool matchesFilters(const QJsonObject& photo, const QJsonObject& filters) const;
};

#endif // MOCKPHOTODATABASE_H
