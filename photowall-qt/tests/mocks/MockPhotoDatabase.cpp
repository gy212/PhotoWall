#include "MockPhotoDatabase.h"
#include <QMutexLocker>
#include <algorithm>

MockPhotoDatabase::MockPhotoDatabase(QObject* parent)
    : QObject(parent)
{
}

void MockPhotoDatabase::reset()
{
    QMutexLocker locker(&m_mutex);
    m_photos.clear();
    m_tags.clear();
    m_photoTags.clear();
    m_albums.clear();
    m_albumPhotos.clear();
    m_nextPhotoId = 1;
    m_nextTagId = 1;
    m_nextAlbumId = 1;
}

// ============================================================================
// Photos
// ============================================================================

void MockPhotoDatabase::addPhoto(const QJsonObject& photo)
{
    QMutexLocker locker(&m_mutex);
    qint64 id = photo.value("photoId").toInteger();
    if (id == 0) {
        id = photo.value("id").toInteger();
    }
    if (id == 0) {
        id = m_nextPhotoId++;
        QJsonObject newPhoto = photo;
        newPhoto["photoId"] = id;
        m_photos[id] = newPhoto;
    } else {
        QJsonObject normalized = photo;
        if (!normalized.contains("photoId")) {
            normalized["photoId"] = id;
        }
        m_photos[id] = normalized;
        if (id >= m_nextPhotoId) {
            m_nextPhotoId = id + 1;
        }
    }
}

void MockPhotoDatabase::addPhotos(const QJsonArray& photos)
{
    for (const QJsonValue& val : photos) {
        addPhoto(val.toObject());
    }
}

QJsonObject MockPhotoDatabase::getPhoto(qint64 id) const
{
    QMutexLocker locker(&m_mutex);
    return m_photos.value(id);
}

QJsonArray MockPhotoDatabase::getPhotos(int limit, int offset) const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    QList<qint64> ids = m_photos.keys();
    std::sort(ids.begin(), ids.end());

    int count = 0;
    for (int i = offset; i < ids.size() && count < limit; ++i) {
        const QJsonObject& photo = m_photos[ids[i]];
        if (!photo.value("isDeleted").toBool(false)) {
            result.append(photo);
            ++count;
        }
    }
    return result;
}

QJsonArray MockPhotoDatabase::searchPhotos(const QJsonObject& filters, int limit, int offset) const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    QList<qint64> ids = m_photos.keys();
    std::sort(ids.begin(), ids.end());

    int skipped = 0;
    int count = 0;
    for (qint64 id : ids) {
        const QJsonObject& photo = m_photos[id];
        if (matchesFilters(photo, filters)) {
            if (skipped < offset) {
                ++skipped;
                continue;
            }
            if (count >= limit) {
                break;
            }
            result.append(photo);
            ++count;
        }
    }
    return result;
}

bool MockPhotoDatabase::updatePhoto(qint64 id, const QJsonObject& updates)
{
    QMutexLocker locker(&m_mutex);
    if (!m_photos.contains(id)) {
        return false;
    }

    QJsonObject photo = m_photos[id];
    for (const QString& key : updates.keys()) {
        photo[key] = updates.value(key);
    }
    m_photos[id] = photo;
    return true;
}

bool MockPhotoDatabase::batchUpdatePhotos(const QList<qint64>& ids, const QJsonObject& updates)
{
    for (qint64 id : ids) {
        if (!updatePhoto(id, updates)) {
            return false;
        }
    }
    return true;
}

bool MockPhotoDatabase::deletePhoto(qint64 id)
{
    QMutexLocker locker(&m_mutex);
    return m_photos.remove(id) > 0;
}

int MockPhotoDatabase::photoCount() const
{
    QMutexLocker locker(&m_mutex);
    int count = 0;
    for (const QJsonObject& photo : m_photos) {
        if (!photo.value("isDeleted").toBool(false)) {
            ++count;
        }
    }
    return count;
}

int MockPhotoDatabase::totalPhotoCount(const QJsonObject& filters) const
{
    QMutexLocker locker(&m_mutex);
    int count = 0;
    for (const QJsonObject& photo : m_photos) {
        if (matchesFilters(photo, filters)) {
            ++count;
        }
    }
    return count;
}

bool MockPhotoDatabase::trashPhoto(qint64 id)
{
    QJsonObject updates;
    updates["isDeleted"] = true;
    return updatePhoto(id, updates);
}

bool MockPhotoDatabase::restorePhoto(qint64 id)
{
    QJsonObject updates;
    updates["isDeleted"] = false;
    return updatePhoto(id, updates);
}

bool MockPhotoDatabase::permanentlyDeletePhoto(qint64 id)
{
    return deletePhoto(id);
}

QJsonArray MockPhotoDatabase::getTrashedPhotos() const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    for (const QJsonObject& photo : m_photos) {
        if (photo.value("isDeleted").toBool(false)) {
            result.append(photo);
        }
    }
    return result;
}

// ============================================================================
// Tags
// ============================================================================

QJsonObject MockPhotoDatabase::createTag(const QString& name, const QString& color)
{
    QMutexLocker locker(&m_mutex);
    qint64 id = m_nextTagId++;
    QJsonObject tag;
    tag["id"] = id;
    tag["name"] = name;
    tag["color"] = color;
    tag["photoCount"] = 0;
    m_tags[id] = tag;
    return tag;
}

QJsonArray MockPhotoDatabase::getAllTags() const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    for (const QJsonObject& tag : m_tags) {
        result.append(tag);
    }
    return result;
}

bool MockPhotoDatabase::deleteTag(qint64 tagId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_tags.contains(tagId)) {
        return false;
    }
    m_tags.remove(tagId);
    // Remove tag from all photos
    for (auto& tagSet : m_photoTags) {
        tagSet.remove(tagId);
    }
    return true;
}

QJsonObject MockPhotoDatabase::updateTag(qint64 tagId, const QString& name, const QString& color)
{
    QMutexLocker locker(&m_mutex);
    if (!m_tags.contains(tagId)) {
        return QJsonObject();
    }

    QJsonObject tag = m_tags[tagId];
    if (!name.isEmpty()) {
        tag["name"] = name;
    }
    if (!color.isEmpty()) {
        tag["color"] = color;
    }
    m_tags[tagId] = tag;
    return tag;
}
bool MockPhotoDatabase::addTagToPhotos(qint64 tagId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_tags.contains(tagId)) {
        return false;
    }
    for (qint64 photoId : photoIds) {
        if (m_photos.contains(photoId)) {
            m_photoTags[photoId].insert(tagId);
        }
    }
    return true;
}

bool MockPhotoDatabase::removeTagFromPhotos(qint64 tagId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    for (qint64 photoId : photoIds) {
        m_photoTags[photoId].remove(tagId);
    }
    return true;
}

QJsonArray MockPhotoDatabase::getPhotoTags(qint64 photoId) const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    const QSet<qint64>& tagIds = m_photoTags.value(photoId);
    for (qint64 tagId : tagIds) {
        if (m_tags.contains(tagId)) {
            result.append(m_tags[tagId]);
        }
    }
    return result;
}

QJsonArray MockPhotoDatabase::getPhotosWithTag(qint64 tagId) const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    for (auto it = m_photoTags.constBegin(); it != m_photoTags.constEnd(); ++it) {
        if (it.value().contains(tagId) && m_photos.contains(it.key())) {
            result.append(m_photos[it.key()]);
        }
    }
    return result;
}

// ============================================================================
// Albums
// ============================================================================

QJsonObject MockPhotoDatabase::createAlbum(const QString& name, const QString& description)
{
    QMutexLocker locker(&m_mutex);
    qint64 id = m_nextAlbumId++;
    QJsonObject album;
    album["id"] = id;
    album["name"] = name;
    album["description"] = description;
    album["photoCount"] = 0;
    album["coverPhotoId"] = QJsonValue::Null;
    m_albums[id] = album;
    return album;
}

QJsonArray MockPhotoDatabase::getAllAlbums() const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    for (const QJsonObject& album : m_albums) {
        result.append(album);
    }
    return result;
}

bool MockPhotoDatabase::deleteAlbum(qint64 albumId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_albums.contains(albumId)) {
        return false;
    }
    m_albums.remove(albumId);
    m_albumPhotos.remove(albumId);
    return true;
}

bool MockPhotoDatabase::addPhotosToAlbum(qint64 albumId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_albums.contains(albumId)) {
        return false;
    }
    for (qint64 photoId : photoIds) {
        if (m_photos.contains(photoId)) {
            m_albumPhotos[albumId].insert(photoId);
        }
    }
    return true;
}

bool MockPhotoDatabase::removePhotosFromAlbum(qint64 albumId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_albums.contains(albumId)) {
        return false;
    }
    for (qint64 photoId : photoIds) {
        m_albumPhotos[albumId].remove(photoId);
    }
    return true;
}

QJsonArray MockPhotoDatabase::getAlbumPhotos(qint64 albumId) const
{
    QMutexLocker locker(&m_mutex);
    QJsonArray result;
    const QSet<qint64>& photoIds = m_albumPhotos.value(albumId);
    for (qint64 photoId : photoIds) {
        if (m_photos.contains(photoId)) {
            result.append(m_photos[photoId]);
        }
    }
    return result;
}

// ============================================================================
// Private
// ============================================================================

bool MockPhotoDatabase::matchesFilters(const QJsonObject& photo, const QJsonObject& filters) const
{
    // Trash filter (default: exclude trashed)
    bool isDeleted = photo.value("isDeleted").toBool(false);
    if (filters.contains("inTrash")) {
        if (filters.value("inTrash").toBool(false) != isDeleted) {
            return false;
        }
    } else if (isDeleted) {
        return false;
    }

    // Check favorite filter
    if (filters.contains("favoritesOnly")) {
        if (filters.value("favoritesOnly").toBool(false) && !photo.value("isFavorite").toBool()) {
            return false;
        }
    } else if (filters.contains("isFavorite")) {
        if (photo.value("isFavorite").toBool() != filters.value("isFavorite").toBool()) {
            return false;
        }
    }

    // Check rating filter
    if (filters.contains("minRating")) {
        if (photo.value("rating").toInt() < filters.value("minRating").toInt()) {
            return false;
        }
    }
    if (filters.contains("maxRating")) {
        if (photo.value("rating").toInt() > filters.value("maxRating").toInt()) {
            return false;
        }
    }

    // Check search query
    if (filters.contains("query")) {
        QString query = filters.value("query").toString().toLower();
        QString fileName = photo.value("fileName").toString().toLower();
        QString filePath = photo.value("filePath").toString().toLower();
        if (!fileName.contains(query) && !filePath.contains(query)) {
            return false;
        }
    }

    // Check tag filter
    if (filters.contains("tagIds")) {
        QJsonArray tagIds = filters.value("tagIds").toArray();
        if (!tagIds.isEmpty()) {
            qint64 photoId = photo.value("photoId").toInteger();
            bool hasTag = false;
            for (const QJsonValue& val : tagIds) {
                qint64 tagId = val.toInteger();
                if (m_photoTags.value(photoId).contains(tagId)) {
                    hasTag = true;
                    break;
                }
            }
            if (!hasTag) {
                return false;
            }
        }
    } else if (filters.contains("tagId")) {
        qint64 tagId = filters.value("tagId").toInteger();
        qint64 photoId = photo.value("photoId").toInteger();
        if (!m_photoTags.value(photoId).contains(tagId)) {
            return false;
        }
    }

    // Album filter
    if (filters.contains("albumId")) {
        qint64 albumId = filters.value("albumId").toInteger();
        qint64 photoId = photo.value("photoId").toInteger();
        if (!m_albumPhotos.value(albumId).contains(photoId)) {
            return false;
        }
    }

    // Folder filter
    if (filters.contains("folderPath")) {
        QString folderPath = filters.value("folderPath").toString();
        bool includeSubfolders = filters.value("includeSubfolders").toBool(true);
        QString filePath = photo.value("filePath").toString();
        if (includeSubfolders) {
            if (!filePath.startsWith(folderPath, Qt::CaseInsensitive)) {
                return false;
            }
        } else {
            int lastSlash = filePath.lastIndexOf('/');
            int lastBackslash = filePath.lastIndexOf('\\');
            int idx = qMax(lastSlash, lastBackslash);
            QString parent = idx >= 0 ? filePath.left(idx) : QString();
            if (parent.compare(folderPath, Qt::CaseInsensitive) != 0) {
                return false;
            }
        }
    }

    return true;
}
