#ifndef RUSTBRIDGE_H
#define RUSTBRIDGE_H

#include <QObject>
#include <QString>
#include <QJsonObject>
#include <QJsonArray>
#include <QMutex>
#include <memory>

#include "photowall.h"

/**
 * C-01: RustBridge
 * Qt wrapper for Rust FFI calls with singleton pattern and thread marshalling.
 */
class RustBridge : public QObject
{
    Q_OBJECT

public:
    // Singleton access
    static RustBridge* instance();

    // Lifecycle
    bool initialize(const QString& configJson = QString());
    void shutdown();
    bool isInitialized() const;
    QString lastError() const;

    // ========================================================================
    // Synchronous APIs
    // ========================================================================

    // Settings
    QJsonObject getSettings();
    bool saveSettings(const QJsonObject& settings);

    // Tags
    QJsonArray getAllTags();
    QJsonObject createTag(const QString& name, const QString& color);
    bool deleteTag(qint64 tagId);
    bool addTagToPhotos(qint64 tagId, const QList<qint64>& photoIds);
    bool removeTagFromPhotos(qint64 tagId, const QList<qint64>& photoIds);

    // Albums
    QJsonArray getAllAlbums();
    QJsonObject createAlbum(const QString& name, const QString& description);
    bool deleteAlbum(qint64 albumId);
    bool addPhotosToAlbum(qint64 albumId, const QList<qint64>& photoIds);
    bool removePhotosFromAlbum(qint64 albumId, const QList<qint64>& photoIds);

    // Thumbnails (sync check)
    QString getThumbnailPath(const QString& fileHash, const QString& size);

    // Photos (sync)
    QJsonObject getPhoto(qint64 photoId);
    bool updatePhoto(qint64 photoId, const QJsonObject& updates);
    bool batchUpdatePhotos(const QList<qint64>& photoIds, const QJsonObject& updates);
    bool setPhotosFavorite(const QList<qint64>& photoIds, bool favorite);
    bool setPhotosRating(const QList<qint64>& photoIds, int rating);

    // Folders
    QJsonArray getFolderTree(const QString& rootPath = QString());
    QJsonArray getFolderChildren(const QString& path);

    // File operations
    bool trashPhotos(const QList<qint64>& photoIds);
    bool restorePhotos(const QList<qint64>& photoIds);
    bool deletePhotosPermanently(const QList<qint64>& photoIds);

    // ========================================================================
    // Asynchronous APIs
    // ========================================================================

    // Photos (async via signals)
    void getPhotosAsync(int limit, const QJsonObject& cursor = QJsonObject(),
                        const QJsonObject& sort = QJsonObject());
    void searchPhotosAsync(const QJsonObject& filters, int limit, const QJsonObject& cursor = QJsonObject(),
                           const QJsonObject& sort = QJsonObject());

    // Indexing
    quint64 indexDirectoryAsync(const QString& path);

    // Thumbnails (batch async)
    void enqueueThumbnailsBatch(const QJsonArray& requests);

    // Job control
    void cancelJob(quint64 jobId);

signals:
    // Generic event from Rust
    void eventReceived(const QString& eventName, const QJsonObject& payload);

    // Photos
    void photosReady(const QJsonArray& photos, const QJsonObject& nextCursor,
                     int total, bool hasMore);

    // Indexing progress
    void indexProgress(int processed, int total, const QString& currentFile);
    void indexFinished(int indexed, int skipped, int failed);
    void indexCancelled();

    // Thumbnails
    void thumbnailReady(const QString& fileHash, const QString& size,
                        const QString& path, bool isPlaceholder,
                        const QString& placeholderBase64, bool useOriginal);

    // Settings
    void settingsChanged(const QJsonObject& settings);

    // Errors
    void errorOccurred(const QString& operation, const QString& message);

private:
    explicit RustBridge(QObject* parent = nullptr);
    ~RustBridge() override;

    // Prevent copying
    RustBridge(const RustBridge&) = delete;
    RustBridge& operator=(const RustBridge&) = delete;

    // Static callback for Rust events
    static void eventCallback(const char* name, const char* payload, void* userData);

    // Process event on Qt thread
    void processEvent(const QString& name, const QString& payload);

    // Helper to convert photo IDs to JSON
    QString photoIdsToJson(const QList<qint64>& ids);

    // Helper to free Rust strings
    QString takeRustString(char* str);

    PhotowallHandle* m_handle = nullptr;
    mutable QMutex m_mutex;
    QString m_lastError;

    static RustBridge* s_instance;
};

#endif // RUSTBRIDGE_H
