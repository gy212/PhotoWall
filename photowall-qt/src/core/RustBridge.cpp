#include "RustBridge.h"
#include "utils/JsonHelper.h"

#include <QCoreApplication>
#include <QJsonDocument>
#include <QMutexLocker>

RustBridge* RustBridge::s_instance = nullptr;

RustBridge* RustBridge::instance()
{
    if (!s_instance) {
        s_instance = new RustBridge(qApp);
    }
    return s_instance;
}

RustBridge::RustBridge(QObject* parent)
    : QObject(parent)
{
}

RustBridge::~RustBridge()
{
    shutdown();
}

bool RustBridge::initialize(const QString& configJson)
{
    QMutexLocker locker(&m_mutex);

    if (m_handle) {
        return true; // Already initialized
    }

    Q_UNUSED(configJson)
    m_handle = photowall_init();

    if (!m_handle) {
        m_lastError = QStringLiteral("Failed to initialize PhotoWall library");
        return false;
    }

    // Set up event callback
    if (photowall_set_event_callback(m_handle, &RustBridge::eventCallback, this) != 0) {
        m_lastError = QStringLiteral("Failed to register event callback");
        return false;
    }

    return true;
}

void RustBridge::shutdown()
{
    QMutexLocker locker(&m_mutex);

    if (m_handle) {
        photowall_shutdown(m_handle);
        m_handle = nullptr;
    }
}

bool RustBridge::isInitialized() const
{
    QMutexLocker locker(&m_mutex);
    return m_handle != nullptr;
}

QString RustBridge::lastError() const
{
    QMutexLocker locker(&m_mutex);
    const char* err = photowall_last_error();
    if (err) {
        return QString::fromUtf8(err);
    }
    return m_lastError;
}

QString RustBridge::takeRustString(char* str)
{
    if (!str) return QString();
    QString result = QString::fromUtf8(str);
    photowall_free_string(str);
    return result;
}

QString RustBridge::photoIdsToJson(const QList<qint64>& ids)
{
    return JsonHelper::stringify(JsonHelper::fromInt64List(ids));
}

// ============================================================================
// Event Handling
// ============================================================================

void RustBridge::eventCallback(const char* name, const char* payload, void* userData)
{
    auto* bridge = static_cast<RustBridge*>(userData);
    if (!bridge) return;

    QString eventName = QString::fromUtf8(name);
    QString eventPayload = QString::fromUtf8(payload);

    // Marshal to Qt main thread
    QMetaObject::invokeMethod(bridge, [bridge, eventName, eventPayload]() {
        bridge->processEvent(eventName, eventPayload);
    }, Qt::QueuedConnection);
}

void RustBridge::processEvent(const QString& name, const QString& payload)
{
    auto doc = JsonHelper::parse(payload);
    QJsonObject obj = doc ? doc->object() : QJsonObject();

    // Emit generic event
    emit eventReceived(name, obj);

    // Route to specific signals
    if (name == QStringLiteral("photos-ready")) {
        emit photosReady(
            JsonHelper::getArray(obj, QStringLiteral("photos")),
            JsonHelper::getObject(obj, QStringLiteral("nextCursor")),
            JsonHelper::getInt(obj, QStringLiteral("total")),
            JsonHelper::getBool(obj, QStringLiteral("hasMore"))
        );
    }
    else if (name == QStringLiteral("index-progress")) {
        emit indexProgress(
            JsonHelper::getInt(obj, QStringLiteral("processed")),
            JsonHelper::getInt(obj, QStringLiteral("total")),
            JsonHelper::getString(obj, QStringLiteral("currentFile"))
        );
    }
    else if (name == QStringLiteral("index-finished")) {
        emit indexFinished(
            JsonHelper::getInt(obj, QStringLiteral("indexed")),
            JsonHelper::getInt(obj, QStringLiteral("skipped")),
            JsonHelper::getInt(obj, QStringLiteral("failed"))
        );
    }
    else if (name == QStringLiteral("index-cancelled")) {
        emit indexCancelled();
    }
    else if (name == QStringLiteral("thumbnail-ready")) {
        emit thumbnailReady(
            JsonHelper::getString(obj, QStringLiteral("fileHash")),
            JsonHelper::getString(obj, QStringLiteral("size")),
            JsonHelper::getString(obj, QStringLiteral("path")),
            JsonHelper::getBool(obj, QStringLiteral("isPlaceholder")),
            JsonHelper::getString(obj, QStringLiteral("placeholderBase64")),
            JsonHelper::getBool(obj, QStringLiteral("useOriginal"))
        );
    }
    else if (name == QStringLiteral("settings-changed")) {
        emit settingsChanged(obj);
    }
}

// ============================================================================
// Synchronous APIs - Settings
// ============================================================================

QJsonObject RustBridge::getSettings()
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonObject();

    char* json = nullptr;
    if (photowall_get_settings_json(m_handle, &json) != 0) {
        return QJsonObject();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->object() : QJsonObject();
}

bool RustBridge::saveSettings(const QJsonObject& settings)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray json = JsonHelper::stringify(settings).toUtf8();
    return photowall_save_settings_json(m_handle, json.constData()) == 0;
}

// ============================================================================
// Synchronous APIs - Tags
// ============================================================================

QJsonArray RustBridge::getAllTags()
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonArray();

    char* json = nullptr;
    if (photowall_tags_get_all_json(m_handle, &json) != 0) {
        return QJsonArray();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->array() : QJsonArray();
}

QJsonObject RustBridge::createTag(const QString& name, const QString& color)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonObject();

    char* json = nullptr;
    if (photowall_tags_create_json(m_handle, name.toUtf8().constData(),
                                   color.isEmpty() ? nullptr : color.toUtf8().constData(),
                                   &json) != 0) {
        return QJsonObject();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->object() : QJsonObject();
}

bool RustBridge::deleteTag(qint64 tagId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;
    return photowall_tags_delete(m_handle, tagId) == 0;
}

bool RustBridge::addTagToPhotos(qint64 tagId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_tags_add_to_photo(m_handle, photoId, tagId);
        if (result < 0) {
            ok = false;
        }
    }
    return ok;
}

bool RustBridge::removeTagFromPhotos(qint64 tagId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_tags_remove_from_photo(m_handle, photoId, tagId);
        if (result < 0) {
            ok = false;
        }
    }
    return ok;
}

// ============================================================================
// Synchronous APIs - Albums
// ============================================================================

QJsonArray RustBridge::getAllAlbums()
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonArray();

    char* json = nullptr;
    if (photowall_albums_get_all_json(m_handle, &json) != 0) {
        return QJsonArray();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->array() : QJsonArray();
}

QJsonObject RustBridge::createAlbum(const QString& name, const QString& description)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonObject();

    char* json = nullptr;
    if (photowall_albums_create_json(
            m_handle,
            name.toUtf8().constData(),
            description.isEmpty() ? nullptr : description.toUtf8().constData(),
            &json) != 0) {
        return QJsonObject();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->object() : QJsonObject();
}

bool RustBridge::deleteAlbum(qint64 albumId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;
    return photowall_albums_delete(m_handle, albumId) == 0;
}

bool RustBridge::addPhotosToAlbum(qint64 albumId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_albums_add_photo(m_handle, albumId, photoId);
        if (result < 0) {
            ok = false;
        }
    }
    return ok;
}

bool RustBridge::removePhotosFromAlbum(qint64 albumId, const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_albums_remove_photo(m_handle, albumId, photoId);
        if (result < 0) {
            ok = false;
        }
    }
    return ok;
}

// ============================================================================
// Synchronous APIs - Thumbnails & Photos
// ============================================================================

QString RustBridge::getThumbnailPath(const QString& fileHash, const QString& size)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QString();

    char* path = photowall_get_thumbnail_path_utf8(m_handle, fileHash.toUtf8().constData(),
                                                   size.toUtf8().constData());
    return takeRustString(path);
}

QJsonObject RustBridge::getPhoto(qint64 photoId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonObject();

    char* json = nullptr;
    int result = photowall_get_photo_json(m_handle, photoId, &json);
    if (result != 0) {
        return QJsonObject();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->object() : QJsonObject();
}

bool RustBridge::updatePhoto(qint64 photoId, const QJsonObject& updates)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray json = JsonHelper::stringify(updates).toUtf8();
    return photowall_update_photo_json(m_handle, photoId, json.constData()) == 0;
}

bool RustBridge::batchUpdatePhotos(const QList<qint64>& photoIds, const QJsonObject& updates)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray updatesJson = JsonHelper::stringify(updates).toUtf8();
    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_update_photo_json(m_handle, photoId, updatesJson.constData());
        if (result != 0) {
            ok = false;
        }
    }
    return ok;
}

bool RustBridge::setPhotosFavorite(const QList<qint64>& photoIds, bool favorite)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray idsJson = photoIdsToJson(photoIds).toUtf8();
    return photowall_set_photos_favorite(m_handle, idsJson.constData(), favorite ? 1 : 0) >= 0;
}

bool RustBridge::setPhotosRating(const QList<qint64>& photoIds, int rating)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    bool ok = true;
    for (qint64 photoId : photoIds) {
        int result = photowall_set_photo_rating(m_handle, photoId, rating);
        if (result != 0) {
            ok = false;
        }
    }
    return ok;
}

// ============================================================================
// Synchronous APIs - Folders
// ============================================================================

QJsonArray RustBridge::getFolderTree(const QString& rootPath)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonArray();

    Q_UNUSED(rootPath)
    char* json = nullptr;
    if (photowall_get_folder_tree_json(m_handle, &json) != 0) {
        return QJsonArray();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->array() : QJsonArray();
}

QJsonArray RustBridge::getFolderChildren(const QString& path)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return QJsonArray();

    const char* pathUtf8 = path.isEmpty() ? nullptr : path.toUtf8().constData();
    char* json = nullptr;
    if (photowall_get_folder_children_json(m_handle, pathUtf8, &json) != 0) {
        return QJsonArray();
    }

    QString str = takeRustString(json);
    auto doc = JsonHelper::parse(str);
    return doc ? doc->array() : QJsonArray();
}

// ============================================================================
// Synchronous APIs - File Operations
// ============================================================================

bool RustBridge::trashPhotos(const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray idsJson = photoIdsToJson(photoIds).toUtf8();
    return photowall_trash_soft_delete(m_handle, idsJson.constData()) >= 0;
}

bool RustBridge::restorePhotos(const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray idsJson = photoIdsToJson(photoIds).toUtf8();
    return photowall_trash_restore(m_handle, idsJson.constData()) >= 0;
}

bool RustBridge::deletePhotosPermanently(const QList<qint64>& photoIds)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return false;

    QByteArray idsJson = photoIdsToJson(photoIds).toUtf8();
    return photowall_trash_permanent_delete(m_handle, idsJson.constData()) >= 0;
}

// ============================================================================
// Asynchronous APIs
// ============================================================================

void RustBridge::getPhotosAsync(int limit, const QJsonObject& cursor, const QJsonObject& sort)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) {
        // Emit empty result to end loading state in PhotoModel
        emit photosReady(QJsonArray(), QJsonObject(), 0, false);
        return;
    }

    const char* cursorJson = nullptr;
    QByteArray cursorBytes;
    if (!cursor.isEmpty()) {
        cursorBytes = JsonHelper::stringify(cursor).toUtf8();
        cursorJson = cursorBytes.constData();
    }

    const char* sortJson = nullptr;
    QByteArray sortBytes;
    if (!sort.isEmpty()) {
        sortBytes = JsonHelper::stringify(sort).toUtf8();
        sortJson = sortBytes.constData();
    }

    char* json = nullptr;
    if (photowall_get_photos_cursor_json(m_handle, limit, cursorJson, sortJson, &json) != 0) {
        // Emit empty result to end loading state in PhotoModel
        emit photosReady(QJsonArray(), QJsonObject(), 0, false);
        return;
    }

    QString str = takeRustString(json);

    // Parse and emit result
    auto doc = JsonHelper::parse(str);
    if (doc) {
        QJsonObject obj = doc->object();
        emit photosReady(
            JsonHelper::getArray(obj, QStringLiteral("photos")),
            JsonHelper::getObject(obj, QStringLiteral("nextCursor")),
            JsonHelper::getInt(obj, QStringLiteral("total")),
            JsonHelper::getBool(obj, QStringLiteral("hasMore"))
        );
    }
}

void RustBridge::searchPhotosAsync(const QJsonObject& filters, int limit, const QJsonObject& cursor,
                                   const QJsonObject& sort)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) {
        // Emit empty result to end loading state in PhotoModel
        emit photosReady(QJsonArray(), QJsonObject(), 0, false);
        return;
    }

    QByteArray filtersJson = JsonHelper::stringify(filters).toUtf8();

    const char* cursorJson = nullptr;
    QByteArray cursorBytes;
    if (!cursor.isEmpty()) {
        cursorBytes = JsonHelper::stringify(cursor).toUtf8();
        cursorJson = cursorBytes.constData();
    }

    const char* sortJson = nullptr;
    QByteArray sortBytes;
    if (!sort.isEmpty()) {
        sortBytes = JsonHelper::stringify(sort).toUtf8();
        sortJson = sortBytes.constData();
    }

    char* json = nullptr;
    if (photowall_search_photos_cursor_json(
            m_handle,
            filtersJson.constData(),
            limit,
            cursorJson,
            sortJson,
            1,
            &json) != 0) {
        // Emit empty result to end loading state in PhotoModel
        emit photosReady(QJsonArray(), QJsonObject(), 0, false);
        return;
    }

    QString str = takeRustString(json);

    auto doc = JsonHelper::parse(str);
    if (doc) {
        QJsonObject obj = doc->object();
        emit photosReady(
            JsonHelper::getArray(obj, QStringLiteral("photos")),
            JsonHelper::getObject(obj, QStringLiteral("nextCursor")),
            JsonHelper::getInt(obj, QStringLiteral("total")),
            JsonHelper::getBool(obj, QStringLiteral("hasMore"))
        );
    }
}

quint64 RustBridge::indexDirectoryAsync(const QString& path)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return 0;

    return photowall_index_directory_async(m_handle, path.toUtf8().constData());
}

void RustBridge::enqueueThumbnailsBatch(const QJsonArray& requests)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return;

    QByteArray json = JsonHelper::stringify(requests).toUtf8();
    photowall_enqueue_thumbnails_batch(m_handle, json.constData());
}

void RustBridge::cancelJob(quint64 jobId)
{
    QMutexLocker locker(&m_mutex);
    if (!m_handle) return;

    photowall_cancel_job(m_handle, jobId);
}
