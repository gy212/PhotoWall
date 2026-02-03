#include "MockFFI.h"
#include <QJsonDocument>
#include <QMutexLocker>
#include <cstring>

MockFFI* MockFFI::s_instance = nullptr;

MockFFI* MockFFI::instance()
{
    if (!s_instance) {
        s_instance = new MockFFI();
    }
    return s_instance;
}

void MockFFI::resetInstance()
{
    if (s_instance) {
        s_instance->reset();
    }
}

MockFFI::MockFFI(QObject* parent)
    : QObject(parent)
{
    m_settings["theme"] = "dark";
    m_settings["thumbnailSize"] = "medium";
}

void MockFFI::reset()
{
    QMutexLocker locker(&m_mutex);
    m_database.reset();
    m_eventCallback = nullptr;
    m_eventUserData = nullptr;
    m_lastError.clear();
    m_nextError.clear();
    m_failNextCall = false;
    m_initialized = false;
    m_settings = QJsonObject();
    m_settings["theme"] = "dark";
    m_settings["thumbnailSize"] = "medium";
    m_nextJobId = 1;
    m_activeJobs.clear();
    m_callHistory.clear();
}

void MockFFI::recordCall(const QString& function, const QJsonObject& params)
{
    QMutexLocker locker(&m_mutex);
    m_callHistory.append({function, params});
}

char* MockFFI::allocString(const QString& str)
{
    QByteArray utf8 = str.toUtf8();
    char* result = new char[utf8.size() + 1];
    std::memcpy(result, utf8.constData(), utf8.size() + 1);
    return result;
}

QList<qint64> MockFFI::parsePhotoIds(const char* json)
{
    QList<qint64> ids;
    if (!json) return ids;

    QJsonDocument doc = QJsonDocument::fromJson(json);
    if (doc.isArray()) {
        for (const QJsonValue& val : doc.array()) {
            ids.append(val.toInteger());
        }
    }
    return ids;
}

// ============================================================================
// FFI Function Implementations
// ============================================================================

PhotowallHandle* MockFFI::init()
{
    recordCall("init");

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Init failed" : m_nextError;
        m_nextError.clear();
        return nullptr;
    }

    m_initialized = true;
    return reinterpret_cast<PhotowallHandle*>(this);
}

void MockFFI::shutdown(PhotowallHandle* handle)
{
    Q_UNUSED(handle)
    recordCall("shutdown");
    m_initialized = false;
}

const char* MockFFI::lastError()
{
    static QByteArray errorBytes;
    errorBytes = m_lastError.toUtf8();
    return errorBytes.constData();
}

int MockFFI::setEventCallback(PhotowallHandle* handle, EventCallback cb, void* userData)
{
    Q_UNUSED(handle)
    m_eventCallback = cb;
    m_eventUserData = userData;
    return 0;
}

int MockFFI::clearEventCallback(PhotowallHandle* handle)
{
    Q_UNUSED(handle)
    m_eventCallback = nullptr;
    m_eventUserData = nullptr;
    return 0;
}

void MockFFI::freeString(char* str)
{
    delete[] str;
}

int MockFFI::getPhotosCursorJson(PhotowallHandle* handle, uint32_t limit,
                                 const char* cursorJson, const char* sortJson,
                                 char** outJson)
{
    Q_UNUSED(handle)
    Q_UNUSED(sortJson)
    QJsonObject params;
    params["limit"] = limit;
    if (cursorJson) params["cursor"] = QString::fromUtf8(cursorJson);
    if (sortJson) params["sort"] = QString::fromUtf8(sortJson);
    recordCall("getPhotosCursor", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    int offset = 0;
    if (cursorJson) {
        QJsonDocument doc = QJsonDocument::fromJson(cursorJson);
        offset = doc.object().value("offset").toInt(0);
    }

    QJsonArray photos = m_database.getPhotos(static_cast<int>(limit), offset);
    int total = m_database.photoCount();
    bool hasMore = (offset + photos.size()) < total;

    QJsonObject response;
    response["photos"] = photos;
    response["total"] = total;
    response["hasMore"] = hasMore;
    if (hasMore) {
        QJsonObject nextCursor;
        nextCursor["offset"] = offset + photos.size();
        response["nextCursor"] = nextCursor;
    } else {
        response["nextCursor"] = QJsonValue::Null;
    }

    *outJson = allocString(QJsonDocument(response).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::searchPhotosCursorJson(PhotowallHandle* handle, const char* filtersJson,
                                    uint32_t limit, const char* cursorJson,
                                    const char* sortJson, int includeTotal,
                                    char** outJson)
{
    Q_UNUSED(handle)
    Q_UNUSED(sortJson)
    QJsonObject params;
    params["limit"] = limit;
    if (filtersJson) params["filters"] = QString::fromUtf8(filtersJson);
    if (cursorJson) params["cursor"] = QString::fromUtf8(cursorJson);
    if (sortJson) params["sort"] = QString::fromUtf8(sortJson);
    params["includeTotal"] = includeTotal;
    recordCall("searchPhotosCursor", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonObject filters;
    if (filtersJson) {
        filters = QJsonDocument::fromJson(filtersJson).object();
    }

    int offset = 0;
    if (cursorJson) {
        QJsonDocument doc = QJsonDocument::fromJson(cursorJson);
        offset = doc.object().value("offset").toInt(0);
    }

    QJsonArray photos = m_database.searchPhotos(filters, static_cast<int>(limit), offset);
    int total = m_database.totalPhotoCount(filters);
    bool hasMore = (offset + photos.size()) < total;

    QJsonObject response;
    response["photos"] = photos;
    if (includeTotal) {
        response["total"] = total;
    } else {
        response["total"] = QJsonValue::Null;
    }
    response["hasMore"] = hasMore;
    if (hasMore) {
        QJsonObject nextCursor;
        nextCursor["offset"] = offset + photos.size();
        response["nextCursor"] = nextCursor;
    } else {
        response["nextCursor"] = QJsonValue::Null;
    }

    *outJson = allocString(QJsonDocument(response).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::getPhotoJson(PhotowallHandle* handle, int64_t photoId, char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["photoId"] = photoId;
    recordCall("getPhoto", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonObject photo = m_database.getPhoto(photoId);
    if (photo.isEmpty()) {
        *outJson = nullptr;
        return 1;
    }

    *outJson = allocString(QJsonDocument(photo).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::updatePhotoJson(PhotowallHandle* handle, int64_t photoId, const char* updatesJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["photoId"] = photoId;
    if (updatesJson) params["updates"] = QString::fromUtf8(updatesJson);
    recordCall("updatePhoto", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Update failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    if (!updatesJson) {
        m_lastError = "updatesJson is null";
        return -1;
    }

    QJsonObject updates = QJsonDocument::fromJson(updatesJson).object();
    if (!m_database.updatePhoto(photoId, updates)) {
        return 1;
    }
    return 0;
}

int MockFFI::setPhotosFavorite(PhotowallHandle* handle, const char* photoIdsJson,
                               int isFavorite)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (photoIdsJson) params["photoIds"] = QString::fromUtf8(photoIdsJson);
    params["isFavorite"] = isFavorite;
    recordCall("setPhotosFavorite", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Set favorite failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    QList<qint64> ids = parsePhotoIds(photoIdsJson);
    int updated = 0;
    QJsonObject updates;
    updates["isFavorite"] = (isFavorite != 0);
    for (qint64 id : ids) {
        if (m_database.updatePhoto(id, updates)) {
            ++updated;
        }
    }
    return updated;
}

int MockFFI::setPhotoRating(PhotowallHandle* handle, int64_t photoId, int32_t rating)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["photoId"] = photoId;
    params["rating"] = rating;
    recordCall("setPhotoRating", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Set rating failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    QJsonObject updates;
    updates["rating"] = rating;
    if (!m_database.updatePhoto(photoId, updates)) {
        return 1;
    }
    return 0;
}

char* MockFFI::getThumbnailPathUtf8(PhotowallHandle* handle, const char* fileHash,
                                    const char* size)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (fileHash) params["fileHash"] = QString::fromUtf8(fileHash);
    if (size) params["size"] = QString::fromUtf8(size);
    recordCall("getThumbnailPathUtf8", params);

    // Return a mock path
    QString path = QString("C:/Thumbnails/%1_%2.jpg")
        .arg(QString::fromUtf8(fileHash))
        .arg(QString::fromUtf8(size));
    return allocString(path);
}

int MockFFI::isThumbnailCached(PhotowallHandle* handle, const char* fileHash,
                               const char* size)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (fileHash) params["fileHash"] = QString::fromUtf8(fileHash);
    if (size) params["size"] = QString::fromUtf8(size);
    recordCall("isThumbnailCached", params);
    return 0;
}

int MockFFI::enqueueThumbnailsBatch(PhotowallHandle* handle, const char* requestsJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (requestsJson) params["requests"] = QString::fromUtf8(requestsJson);
    recordCall("enqueueThumbnailsBatch", params);

    if (!requestsJson) {
        return -1;
    }
    QJsonDocument doc = QJsonDocument::fromJson(requestsJson);
    if (!doc.isArray()) {
        return -1;
    }
    return doc.array().size();
}

JobId MockFFI::indexDirectoryAsync(PhotowallHandle* handle, const char* path)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (path) params["path"] = QString::fromUtf8(path);
    recordCall("indexDirectoryAsync", params);

    JobId jobId = m_nextJobId++;
    m_activeJobs[jobId] = true;
    return jobId;
}

int MockFFI::cancelJob(PhotowallHandle* handle, JobId jobId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["jobId"] = static_cast<qint64>(jobId);
    recordCall("cancelJob", params);

    if (m_activeJobs.contains(jobId)) {
        m_activeJobs[jobId] = false;
        simulateIndexCancelled(jobId);
        return 1;
    }
    return 0;
}

int MockFFI::getActiveJobCount(PhotowallHandle* handle)
{
    Q_UNUSED(handle)
    return m_activeJobs.size();
}

int MockFFI::isJobActive(PhotowallHandle* handle, JobId jobId)
{
    Q_UNUSED(handle)
    if (m_activeJobs.contains(jobId) && m_activeJobs.value(jobId)) {
        return 1;
    }
    return 0;
}

int MockFFI::getSettingsJson(PhotowallHandle* handle, char** outJson)
{
    Q_UNUSED(handle)
    recordCall("getSettings");
    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }
    *outJson = allocString(QJsonDocument(m_settings).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::saveSettingsJson(PhotowallHandle* handle, const char* settingsJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (settingsJson) params["settings"] = QString::fromUtf8(settingsJson);
    recordCall("saveSettings", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Save settings failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    if (!settingsJson) {
        m_lastError = "settingsJson is null";
        return -1;
    }

    m_settings = QJsonDocument::fromJson(settingsJson).object();
    return 0;
}

int MockFFI::getAllTagsJson(PhotowallHandle* handle, char** outJson)
{
    Q_UNUSED(handle)
    recordCall("getAllTags");
    QJsonArray tags = m_database.getAllTags();
    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }
    *outJson = allocString(QJsonDocument(tags).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::createTagJson(PhotowallHandle* handle, const char* name, const char* color,
                           char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (name) params["name"] = QString::fromUtf8(name);
    if (color) params["color"] = QString::fromUtf8(color);
    recordCall("createTag", params);

    if (!outJson || !name) {
        m_lastError = "name or outJson is null";
        return -1;
    }

    QJsonObject tag = m_database.createTag(QString::fromUtf8(name), QString::fromUtf8(color));
    *outJson = allocString(QJsonDocument(tag).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::deleteTag(PhotowallHandle* handle, int64_t tagId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["tagId"] = tagId;
    recordCall("deleteTag", params);

    if (m_database.deleteTag(tagId)) {
        return 0;
    }
    return 1;
}

int MockFFI::addTagToPhoto(PhotowallHandle* handle, int64_t photoId, int64_t tagId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["photoId"] = photoId;
    params["tagId"] = tagId;
    recordCall("addTagToPhoto", params);

    QList<qint64> ids;
    ids.append(photoId);
    if (!m_database.addTagToPhotos(tagId, ids)) {
        return -1;
    }
    return 0;
}

int MockFFI::removeTagFromPhoto(PhotowallHandle* handle, int64_t photoId, int64_t tagId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["photoId"] = photoId;
    params["tagId"] = tagId;
    recordCall("removeTagFromPhoto", params);

    QList<qint64> ids;
    ids.append(photoId);
    if (!m_database.removeTagFromPhotos(tagId, ids)) {
        return -1;
    }
    return 0;
}

int MockFFI::updateTagJson(PhotowallHandle* handle, int64_t tagId, const char* name,
                           const char* color, char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["tagId"] = tagId;
    if (name) params["name"] = QString::fromUtf8(name);
    if (color) params["color"] = QString::fromUtf8(color);
    recordCall("updateTag", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonObject updated = m_database.updateTag(tagId, name ? QString::fromUtf8(name) : QString(),
                                               color ? QString::fromUtf8(color) : QString());
    if (updated.isEmpty()) {
        return 1;
    }
    *outJson = allocString(QJsonDocument(updated).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::getAllAlbumsJson(PhotowallHandle* handle, char** outJson)
{
    Q_UNUSED(handle)
    recordCall("getAllAlbums");
    QJsonArray albums = m_database.getAllAlbums();
    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }
    *outJson = allocString(QJsonDocument(albums).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::createAlbumJson(PhotowallHandle* handle, const char* name,
                             const char* description, char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (name) params["name"] = QString::fromUtf8(name);
    if (description) params["description"] = QString::fromUtf8(description);
    recordCall("createAlbum", params);

    if (!outJson || !name) {
        m_lastError = "name or outJson is null";
        return -1;
    }

    QJsonObject album = m_database.createAlbum(QString::fromUtf8(name),
                                                QString::fromUtf8(description));
    *outJson = allocString(QJsonDocument(album).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::deleteAlbum(PhotowallHandle* handle, int64_t albumId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["albumId"] = albumId;
    recordCall("deleteAlbum", params);

    if (m_database.deleteAlbum(albumId)) {
        return 0;
    }
    return 1;
}

int MockFFI::addPhotoToAlbum(PhotowallHandle* handle, int64_t albumId, int64_t photoId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["albumId"] = albumId;
    params["photoId"] = photoId;
    recordCall("addPhotoToAlbum", params);

    QList<qint64> ids;
    ids.append(photoId);
    if (!m_database.addPhotosToAlbum(albumId, ids)) {
        return -1;
    }
    return 0;
}

int MockFFI::removePhotoFromAlbum(PhotowallHandle* handle, int64_t albumId,
                                  int64_t photoId)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["albumId"] = albumId;
    params["photoId"] = photoId;
    recordCall("removePhotoFromAlbum", params);

    QList<qint64> ids;
    ids.append(photoId);
    if (!m_database.removePhotosFromAlbum(albumId, ids)) {
        return -1;
    }
    return 0;
}

int MockFFI::getAlbumPhotosJson(PhotowallHandle* handle, int64_t albumId, uint32_t page,
                                uint32_t pageSize, const char* sortJson, char** outJson)
{
    Q_UNUSED(handle)
    Q_UNUSED(sortJson)
    QJsonObject params;
    params["albumId"] = albumId;
    params["page"] = static_cast<int>(page);
    params["pageSize"] = static_cast<int>(pageSize);
    recordCall("getAlbumPhotos", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonArray items = m_database.getAlbumPhotos(albumId);
    int total = items.size();
    int start = static_cast<int>((page - 1) * pageSize);
    int end = qMin(start + static_cast<int>(pageSize), total);

    QJsonArray pageItems;
    for (int i = start; i < end; ++i) {
        pageItems.append(items.at(i));
    }

    QJsonObject response;
    response["items"] = pageItems;
    response["total"] = total;
    response["page"] = static_cast<int>(page);
    response["pageSize"] = static_cast<int>(pageSize);
    response["totalPages"] = pageSize > 0 ? (total + static_cast<int>(pageSize) - 1) / static_cast<int>(pageSize) : 0;

    *outJson = allocString(QJsonDocument(response).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::getFolderTreeJson(PhotowallHandle* handle, char** outJson)
{
    Q_UNUSED(handle)
    recordCall("getFolderTree");

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonArray roots;
    QJsonObject root;
    root["path"] = "C:/Photos";
    root["name"] = "Photos";
    root["photoCount"] = m_database.photoCount();
    root["hasChildren"] = false;
    root["children"] = QJsonArray();
    roots.append(root);

    *outJson = allocString(QJsonDocument(roots).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::getFolderChildrenJson(PhotowallHandle* handle, const char* path, char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (path) params["path"] = QString::fromUtf8(path);
    recordCall("getFolderChildren", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    *outJson = allocString("[]");
    return 0;
}

int MockFFI::getFolderPhotosJson(PhotowallHandle* handle, const char* folderPath,
                                 int includeSubfolders, uint32_t page, uint32_t pageSize,
                                 const char* sortJson, char** outJson)
{
    Q_UNUSED(handle)
    Q_UNUSED(includeSubfolders)
    Q_UNUSED(sortJson)
    QJsonObject params;
    if (folderPath) params["folderPath"] = QString::fromUtf8(folderPath);
    params["page"] = static_cast<int>(page);
    params["pageSize"] = static_cast<int>(pageSize);
    recordCall("getFolderPhotos", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonArray items = m_database.getPhotos(static_cast<int>(pageSize),
                                            static_cast<int>((page - 1) * pageSize));
    int total = m_database.photoCount();

    QJsonObject response;
    response["items"] = items;
    response["total"] = total;
    response["page"] = static_cast<int>(page);
    response["pageSize"] = static_cast<int>(pageSize);
    response["totalPages"] = pageSize > 0 ? (total + static_cast<int>(pageSize) - 1) / static_cast<int>(pageSize) : 0;

    *outJson = allocString(QJsonDocument(response).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::trashSoftDelete(PhotowallHandle* handle, const char* photoIdsJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (photoIdsJson) params["photoIds"] = QString::fromUtf8(photoIdsJson);
    recordCall("trashSoftDelete", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Trash failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    QList<qint64> ids = parsePhotoIds(photoIdsJson);
    int count = 0;
    for (qint64 id : ids) {
        if (m_database.trashPhoto(id)) {
            ++count;
        }
    }
    return count;
}

int MockFFI::trashRestore(PhotowallHandle* handle, const char* photoIdsJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (photoIdsJson) params["photoIds"] = QString::fromUtf8(photoIdsJson);
    recordCall("trashRestore", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Restore failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    QList<qint64> ids = parsePhotoIds(photoIdsJson);
    int count = 0;
    for (qint64 id : ids) {
        if (m_database.restorePhoto(id)) {
            ++count;
        }
    }
    return count;
}

int MockFFI::trashPermanentDelete(PhotowallHandle* handle, const char* photoIdsJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    if (photoIdsJson) params["photoIds"] = QString::fromUtf8(photoIdsJson);
    recordCall("trashPermanentDelete", params);

    if (m_failNextCall) {
        m_failNextCall = false;
        m_lastError = m_nextError.isEmpty() ? "Delete failed" : m_nextError;
        m_nextError.clear();
        return -1;
    }

    QList<qint64> ids = parsePhotoIds(photoIdsJson);
    int count = 0;
    for (qint64 id : ids) {
        if (m_database.permanentlyDeletePhoto(id)) {
            ++count;
        }
    }
    return count;
}

int MockFFI::trashGetPhotosJson(PhotowallHandle* handle, uint32_t page, uint32_t pageSize,
                                char** outJson)
{
    Q_UNUSED(handle)
    QJsonObject params;
    params["page"] = static_cast<int>(page);
    params["pageSize"] = static_cast<int>(pageSize);
    recordCall("trashGetPhotos", params);

    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonArray trashed = m_database.getTrashedPhotos();
    int total = trashed.size();
    int start = static_cast<int>((page - 1) * pageSize);
    int end = qMin(start + static_cast<int>(pageSize), total);

    QJsonArray pageItems;
    for (int i = start; i < end; ++i) {
        pageItems.append(trashed.at(i));
    }

    QJsonObject response;
    response["items"] = pageItems;
    response["total"] = total;
    response["page"] = static_cast<int>(page);
    response["pageSize"] = static_cast<int>(pageSize);
    response["totalPages"] = pageSize > 0 ? (total + static_cast<int>(pageSize) - 1) / static_cast<int>(pageSize) : 0;

    *outJson = allocString(QJsonDocument(response).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::trashEmpty(PhotowallHandle* handle)
{
    Q_UNUSED(handle)
    recordCall("trashEmpty");
    QJsonArray trashed = m_database.getTrashedPhotos();
    int count = trashed.size();
    for (const QJsonValue& val : trashed) {
        qint64 id = val.toObject().value("photoId").toInteger();
        if (id > 0) {
            m_database.permanentlyDeletePhoto(id);
        }
    }
    return count;
}

int MockFFI::trashGetStatsJson(PhotowallHandle* handle, char** outJson)
{
    Q_UNUSED(handle)
    recordCall("trashGetStats");
    if (!outJson) {
        m_lastError = "outJson is null";
        return -1;
    }

    QJsonObject stats;
    stats["totalCount"] = m_database.getTrashedPhotos().size();
    stats["totalSize"] = 0;
    *outJson = allocString(QJsonDocument(stats).toJson(QJsonDocument::Compact));
    return 0;
}

int MockFFI::softDeletePhotos(PhotowallHandle* handle, const char* photoIdsJson)
{
    return trashSoftDelete(handle, photoIdsJson);
}

// ============================================================================
// Test Control
// ============================================================================

void MockFFI::emitEvent(const QString& name, const QJsonObject& payload)
{
    if (m_eventCallback) {
        QByteArray nameBytes = name.toUtf8();
        QByteArray payloadBytes = QJsonDocument(payload).toJson(QJsonDocument::Compact);
        m_eventCallback(nameBytes.constData(), payloadBytes.constData(), m_eventUserData);
    }
}

void MockFFI::simulateIndexProgress(int processed, int total, const QString& currentFile)
{
    QJsonObject payload;
    payload["processed"] = processed;
    payload["total"] = total;
    payload["currentFile"] = currentFile;
    payload["indexed"] = processed;
    payload["skipped"] = 0;
    payload["failed"] = 0;
    payload["percentage"] = total > 0 ? (static_cast<double>(processed) / total) * 100.0 : 0.0;
    emitEvent("index-progress", payload);
}

void MockFFI::simulateIndexFinished(int indexed, int skipped, int failed)
{
    QJsonObject payload;
    payload["jobId"] = static_cast<qint64>(0);
    payload["indexed"] = indexed;
    payload["skipped"] = skipped;
    payload["failed"] = failed;
    payload["failedFiles"] = QJsonArray();
    emitEvent("index-finished", payload);
}

void MockFFI::simulateIndexCancelled(JobId jobId)
{
    QJsonObject payload;
    payload["jobId"] = static_cast<qint64>(jobId);
    emitEvent("index-cancelled", payload);
}

void MockFFI::simulateThumbnailReady(const QString& fileHash, const QString& size,
                                      const QString& path)
{
    QJsonObject payload;
    payload["fileHash"] = fileHash;
    payload["size"] = size;
    payload["path"] = path;
    payload["isPlaceholder"] = false;
    payload["useOriginal"] = false;
    emitEvent("thumbnail-ready", payload);
}

void MockFFI::setNextError(const QString& error)
{
    m_nextError = error;
}

void MockFFI::setFailNextCall(bool fail)
{
    m_failNextCall = fail;
}

QList<MockFFI::CallRecord> MockFFI::callHistory() const
{
    QMutexLocker locker(&m_mutex);
    return m_callHistory;
}

void MockFFI::clearCallHistory()
{
    QMutexLocker locker(&m_mutex);
    m_callHistory.clear();
}

bool MockFFI::wasCalledWith(const QString& function, const QJsonObject& params) const
{
    QMutexLocker locker(&m_mutex);
    for (const CallRecord& record : m_callHistory) {
        if (record.function == function) {
            if (params.isEmpty()) {
                return true;
            }
            bool match = true;
            for (const QString& key : params.keys()) {
                if (record.params.value(key) != params.value(key)) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return true;
            }
        }
    }
    return false;
}

int MockFFI::callCount(const QString& function) const
{
    QMutexLocker locker(&m_mutex);
    int count = 0;
    for (const CallRecord& record : m_callHistory) {
        if (record.function == function) {
            ++count;
        }
    }
    return count;
}

// ============================================================================
// C FFI Function Implementations
// ============================================================================

extern "C" {

PhotowallHandle* photowall_init(void)
{
    return MockFFI::instance()->init();
}

void photowall_shutdown(PhotowallHandle* handle)
{
    MockFFI::instance()->shutdown(handle);
}

const char* photowall_last_error(void)
{
    return MockFFI::instance()->lastError();
}

int photowall_set_event_callback(PhotowallHandle* handle, EventCallback cb, void* user_data)
{
    return MockFFI::instance()->setEventCallback(handle, cb, user_data);
}

int photowall_clear_event_callback(PhotowallHandle* handle)
{
    return MockFFI::instance()->clearEventCallback(handle);
}

void photowall_free_string(char* str)
{
    MockFFI::instance()->freeString(str);
}

char* photowall_version(void)
{
    const char* version = "mock";
    size_t len = std::strlen(version);
    char* result = new char[len + 1];
    std::memcpy(result, version, len + 1);
    return result;
}

int photowall_get_photos_cursor_json(PhotowallHandle* handle, uint32_t limit,
                                     const char* cursor_json, const char* sort_json,
                                     char** out_json)
{
    return MockFFI::instance()->getPhotosCursorJson(handle, limit, cursor_json, sort_json, out_json);
}

int photowall_search_photos_cursor_json(PhotowallHandle* handle, const char* filters_json,
                                        uint32_t limit, const char* cursor_json,
                                        const char* sort_json, int include_total,
                                        char** out_json)
{
    return MockFFI::instance()->searchPhotosCursorJson(
        handle, filters_json, limit, cursor_json, sort_json, include_total, out_json);
}

int photowall_get_photo_json(PhotowallHandle* handle, int64_t photo_id, char** out_json)
{
    return MockFFI::instance()->getPhotoJson(handle, photo_id, out_json);
}

int photowall_update_photo_json(PhotowallHandle* handle, int64_t photo_id,
                                const char* updates_json)
{
    return MockFFI::instance()->updatePhotoJson(handle, photo_id, updates_json);
}

int photowall_enqueue_thumbnails_batch(PhotowallHandle* handle, const char* requests_json)
{
    return MockFFI::instance()->enqueueThumbnailsBatch(handle, requests_json);
}

char* photowall_get_thumbnail_path_utf8(PhotowallHandle* handle, const char* file_hash,
                                        const char* size)
{
    return MockFFI::instance()->getThumbnailPathUtf8(handle, file_hash, size);
}

int photowall_is_thumbnail_cached(PhotowallHandle* handle, const char* file_hash,
                                  const char* size)
{
    return MockFFI::instance()->isThumbnailCached(handle, file_hash, size);
}

JobId photowall_index_directory_async(PhotowallHandle* handle, const char* path)
{
    return MockFFI::instance()->indexDirectoryAsync(handle, path);
}

int photowall_cancel_job(PhotowallHandle* handle, JobId job_id)
{
    return MockFFI::instance()->cancelJob(handle, job_id);
}

int photowall_get_active_job_count(PhotowallHandle* handle)
{
    return MockFFI::instance()->getActiveJobCount(handle);
}

int photowall_is_job_active(PhotowallHandle* handle, JobId job_id)
{
    return MockFFI::instance()->isJobActive(handle, job_id);
}

int photowall_get_settings_json(PhotowallHandle* handle, char** out_json)
{
    return MockFFI::instance()->getSettingsJson(handle, out_json);
}

int photowall_save_settings_json(PhotowallHandle* handle, const char* settings_json)
{
    return MockFFI::instance()->saveSettingsJson(handle, settings_json);
}

int photowall_tags_get_all_json(PhotowallHandle* handle, char** out_json)
{
    return MockFFI::instance()->getAllTagsJson(handle, out_json);
}

int photowall_tags_create_json(PhotowallHandle* handle, const char* name, const char* color,
                               char** out_json)
{
    return MockFFI::instance()->createTagJson(handle, name, color, out_json);
}

int photowall_tags_delete(PhotowallHandle* handle, int64_t tag_id)
{
    return MockFFI::instance()->deleteTag(handle, tag_id);
}

int photowall_tags_add_to_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id)
{
    return MockFFI::instance()->addTagToPhoto(handle, photo_id, tag_id);
}

int photowall_tags_remove_from_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id)
{
    return MockFFI::instance()->removeTagFromPhoto(handle, photo_id, tag_id);
}

int photowall_tags_update_json(PhotowallHandle* handle, int64_t tag_id, const char* name,
                               const char* color, char** out_json)
{
    return MockFFI::instance()->updateTagJson(handle, tag_id, name, color, out_json);
}

int photowall_albums_get_all_json(PhotowallHandle* handle, char** out_json)
{
    return MockFFI::instance()->getAllAlbumsJson(handle, out_json);
}

int photowall_albums_create_json(PhotowallHandle* handle, const char* name,
                                 const char* description, char** out_json)
{
    return MockFFI::instance()->createAlbumJson(handle, name, description, out_json);
}

int photowall_albums_delete(PhotowallHandle* handle, int64_t album_id)
{
    return MockFFI::instance()->deleteAlbum(handle, album_id);
}

int photowall_albums_add_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id)
{
    return MockFFI::instance()->addPhotoToAlbum(handle, album_id, photo_id);
}

int photowall_albums_remove_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id)
{
    return MockFFI::instance()->removePhotoFromAlbum(handle, album_id, photo_id);
}

int photowall_albums_get_photos_json(PhotowallHandle* handle, int64_t album_id, uint32_t page,
                                     uint32_t page_size, const char* sort_json,
                                     char** out_json)
{
    return MockFFI::instance()->getAlbumPhotosJson(
        handle, album_id, page, page_size, sort_json, out_json);
}

int photowall_get_folder_tree_json(PhotowallHandle* handle, char** out_json)
{
    return MockFFI::instance()->getFolderTreeJson(handle, out_json);
}

int photowall_get_folder_children_json(PhotowallHandle* handle, const char* path,
                                       char** out_json)
{
    return MockFFI::instance()->getFolderChildrenJson(handle, path, out_json);
}

int photowall_get_folder_photos_json(PhotowallHandle* handle, const char* folder_path,
                                     int include_subfolders, uint32_t page,
                                     uint32_t page_size, const char* sort_json,
                                     char** out_json)
{
    return MockFFI::instance()->getFolderPhotosJson(
        handle, folder_path, include_subfolders, page, page_size, sort_json, out_json);
}

int photowall_trash_soft_delete(PhotowallHandle* handle, const char* photo_ids_json)
{
    return MockFFI::instance()->trashSoftDelete(handle, photo_ids_json);
}

int photowall_trash_restore(PhotowallHandle* handle, const char* photo_ids_json)
{
    return MockFFI::instance()->trashRestore(handle, photo_ids_json);
}

int photowall_trash_permanent_delete(PhotowallHandle* handle, const char* photo_ids_json)
{
    return MockFFI::instance()->trashPermanentDelete(handle, photo_ids_json);
}

int photowall_trash_get_photos_json(PhotowallHandle* handle, uint32_t page, uint32_t page_size,
                                    char** out_json)
{
    return MockFFI::instance()->trashGetPhotosJson(handle, page, page_size, out_json);
}

int photowall_trash_empty(PhotowallHandle* handle)
{
    return MockFFI::instance()->trashEmpty(handle);
}

int photowall_trash_get_stats_json(PhotowallHandle* handle, char** out_json)
{
    return MockFFI::instance()->trashGetStatsJson(handle, out_json);
}

int photowall_set_photos_favorite(PhotowallHandle* handle, const char* photo_ids_json,
                                  int is_favorite)
{
    return MockFFI::instance()->setPhotosFavorite(handle, photo_ids_json, is_favorite);
}

int photowall_set_photo_rating(PhotowallHandle* handle, int64_t photo_id, int32_t rating)
{
    return MockFFI::instance()->setPhotoRating(handle, photo_id, rating);
}

int photowall_soft_delete_photos(PhotowallHandle* handle, const char* photo_ids_json)
{
    return MockFFI::instance()->softDeletePhotos(handle, photo_ids_json);
}

} // extern "C"
