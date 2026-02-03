#ifndef MOCKFFI_H
#define MOCKFFI_H

#include <QObject>
#include <QJsonObject>
#include <QJsonArray>
#include <QHash>
#include <QMutex>
#include <QTimer>
#include <functional>

#include "MockPhotoDatabase.h"
#include "photowall.h"

/**
 * Mock FFI implementation for testing.
 * Replaces the real Rust FFI with controllable test behavior.
 */
class MockFFI : public QObject
{
    Q_OBJECT

public:
    static MockFFI* instance();
    static void resetInstance();

    // Database access
    MockPhotoDatabase* database() { return &m_database; }

    // ========================================================================
    // FFI Function Implementations
    // ========================================================================
    PhotowallHandle* init();
    void shutdown(PhotowallHandle* handle);
    const char* lastError();
    int setEventCallback(PhotowallHandle* handle, EventCallback cb, void* userData);
    int clearEventCallback(PhotowallHandle* handle);
    void freeString(char* str);

    // Photos
    int getPhotosCursorJson(PhotowallHandle* handle, uint32_t limit,
                            const char* cursorJson, const char* sortJson,
                            char** outJson);
    int searchPhotosCursorJson(PhotowallHandle* handle, const char* filtersJson,
                               uint32_t limit, const char* cursorJson,
                               const char* sortJson, int includeTotal,
                               char** outJson);
    int getPhotoJson(PhotowallHandle* handle, int64_t photoId, char** outJson);
    int updatePhotoJson(PhotowallHandle* handle, int64_t photoId, const char* updatesJson);
    int setPhotosFavorite(PhotowallHandle* handle, const char* photoIdsJson, int isFavorite);
    int setPhotoRating(PhotowallHandle* handle, int64_t photoId, int32_t rating);

    // Thumbnails
    char* getThumbnailPathUtf8(PhotowallHandle* handle, const char* fileHash, const char* size);
    int isThumbnailCached(PhotowallHandle* handle, const char* fileHash, const char* size);
    int enqueueThumbnailsBatch(PhotowallHandle* handle, const char* requestsJson);

    // Indexing
    JobId indexDirectoryAsync(PhotowallHandle* handle, const char* path);
    int cancelJob(PhotowallHandle* handle, JobId jobId);
    int getActiveJobCount(PhotowallHandle* handle);
    int isJobActive(PhotowallHandle* handle, JobId jobId);

    // Settings
    int getSettingsJson(PhotowallHandle* handle, char** outJson);
    int saveSettingsJson(PhotowallHandle* handle, const char* settingsJson);

    // Tags
    int getAllTagsJson(PhotowallHandle* handle, char** outJson);
    int createTagJson(PhotowallHandle* handle, const char* name, const char* color, char** outJson);
    int deleteTag(PhotowallHandle* handle, int64_t tagId);
    int addTagToPhoto(PhotowallHandle* handle, int64_t photoId, int64_t tagId);
    int removeTagFromPhoto(PhotowallHandle* handle, int64_t photoId, int64_t tagId);
    int updateTagJson(PhotowallHandle* handle, int64_t tagId, const char* name,
                      const char* color, char** outJson);

    // Albums
    int getAllAlbumsJson(PhotowallHandle* handle, char** outJson);
    int createAlbumJson(PhotowallHandle* handle, const char* name, const char* description,
                        char** outJson);
    int deleteAlbum(PhotowallHandle* handle, int64_t albumId);
    int addPhotoToAlbum(PhotowallHandle* handle, int64_t albumId, int64_t photoId);
    int removePhotoFromAlbum(PhotowallHandle* handle, int64_t albumId, int64_t photoId);
    int getAlbumPhotosJson(PhotowallHandle* handle, int64_t albumId, uint32_t page,
                           uint32_t pageSize, const char* sortJson, char** outJson);

    // Folders
    int getFolderTreeJson(PhotowallHandle* handle, char** outJson);
    int getFolderChildrenJson(PhotowallHandle* handle, const char* path, char** outJson);
    int getFolderPhotosJson(PhotowallHandle* handle, const char* folderPath,
                            int includeSubfolders, uint32_t page, uint32_t pageSize,
                            const char* sortJson, char** outJson);

    // File operations
    int trashSoftDelete(PhotowallHandle* handle, const char* photoIdsJson);
    int trashRestore(PhotowallHandle* handle, const char* photoIdsJson);
    int trashPermanentDelete(PhotowallHandle* handle, const char* photoIdsJson);
    int trashGetPhotosJson(PhotowallHandle* handle, uint32_t page, uint32_t pageSize,
                           char** outJson);
    int trashEmpty(PhotowallHandle* handle);
    int trashGetStatsJson(PhotowallHandle* handle, char** outJson);
    int softDeletePhotos(PhotowallHandle* handle, const char* photoIdsJson);

    // ========================================================================
    // Test Control
    // ========================================================================

    // Reset all state
    void reset();

    // Simulate events
    void emitEvent(const QString& name, const QJsonObject& payload);
    void simulateIndexProgress(int processed, int total, const QString& currentFile);
    void simulateIndexFinished(int indexed, int skipped, int failed);
    void simulateIndexCancelled(JobId jobId = 0);
    void simulateThumbnailReady(const QString& fileHash, const QString& size,
                                 const QString& path);

    // Error injection
    void setNextError(const QString& error);
    void setFailNextCall(bool fail);

    // Call recording
    struct CallRecord {
        QString function;
        QJsonObject params;
    };
    QList<CallRecord> callHistory() const;
    void clearCallHistory();
    bool wasCalledWith(const QString& function, const QJsonObject& params = {}) const;
    int callCount(const QString& function) const;

private:
    explicit MockFFI(QObject* parent = nullptr);
    ~MockFFI() override = default;

    void recordCall(const QString& function, const QJsonObject& params = {});
    char* allocString(const QString& str);
    QList<qint64> parsePhotoIds(const char* json);

    static MockFFI* s_instance;

    MockPhotoDatabase m_database;
    EventCallback m_eventCallback = nullptr;
    void* m_eventUserData = nullptr;

    QString m_lastError;
    QString m_nextError;
    bool m_failNextCall = false;
    bool m_initialized = false;

    QJsonObject m_settings;
    JobId m_nextJobId = 1;
    QHash<JobId, bool> m_activeJobs;

    mutable QMutex m_mutex;
    QList<CallRecord> m_callHistory;
};

// ============================================================================
// C FFI Function Declarations (for linking)
// ============================================================================

extern "C" {
    PhotowallHandle* photowall_init(void);
    void photowall_shutdown(PhotowallHandle* handle);
    const char* photowall_last_error(void);
    int photowall_set_event_callback(PhotowallHandle* handle, EventCallback cb, void* user_data);
    int photowall_clear_event_callback(PhotowallHandle* handle);
    void photowall_free_string(char* str);

    int photowall_get_photos_cursor_json(PhotowallHandle* handle, uint32_t limit,
                                         const char* cursor_json, const char* sort_json,
                                         char** out_json);
    int photowall_search_photos_cursor_json(PhotowallHandle* handle, const char* filters_json,
                                            uint32_t limit, const char* cursor_json,
                                            const char* sort_json, int include_total,
                                            char** out_json);
    int photowall_get_photo_json(PhotowallHandle* handle, int64_t photo_id, char** out_json);
    int photowall_update_photo_json(PhotowallHandle* handle, int64_t photo_id,
                                    const char* updates_json);

    int photowall_enqueue_thumbnails_batch(PhotowallHandle* handle, const char* requests_json);
    char* photowall_get_thumbnail_path_utf8(PhotowallHandle* handle, const char* file_hash,
                                            const char* size);
    int photowall_is_thumbnail_cached(PhotowallHandle* handle, const char* file_hash,
                                      const char* size);

    JobId photowall_index_directory_async(PhotowallHandle* handle, const char* path);
    int photowall_cancel_job(PhotowallHandle* handle, JobId job_id);
    int photowall_get_active_job_count(PhotowallHandle* handle);
    int photowall_is_job_active(PhotowallHandle* handle, JobId job_id);

    int photowall_get_settings_json(PhotowallHandle* handle, char** out_json);
    int photowall_save_settings_json(PhotowallHandle* handle, const char* settings_json);

    int photowall_tags_get_all_json(PhotowallHandle* handle, char** out_json);
    int photowall_tags_create_json(PhotowallHandle* handle, const char* name, const char* color,
                                   char** out_json);
    int photowall_tags_delete(PhotowallHandle* handle, int64_t tag_id);
    int photowall_tags_add_to_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id);
    int photowall_tags_remove_from_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id);
    int photowall_tags_update_json(PhotowallHandle* handle, int64_t tag_id, const char* name,
                                   const char* color, char** out_json);

    int photowall_albums_get_all_json(PhotowallHandle* handle, char** out_json);
    int photowall_albums_create_json(PhotowallHandle* handle, const char* name,
                                     const char* description, char** out_json);
    int photowall_albums_delete(PhotowallHandle* handle, int64_t album_id);
    int photowall_albums_add_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id);
    int photowall_albums_remove_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id);
    int photowall_albums_get_photos_json(PhotowallHandle* handle, int64_t album_id,
                                         uint32_t page, uint32_t page_size,
                                         const char* sort_json, char** out_json);

    int photowall_get_folder_tree_json(PhotowallHandle* handle, char** out_json);
    int photowall_get_folder_children_json(PhotowallHandle* handle, const char* path,
                                           char** out_json);
    int photowall_get_folder_photos_json(PhotowallHandle* handle, const char* folder_path,
                                         int include_subfolders, uint32_t page,
                                         uint32_t page_size, const char* sort_json,
                                         char** out_json);

    int photowall_trash_soft_delete(PhotowallHandle* handle, const char* photo_ids_json);
    int photowall_trash_restore(PhotowallHandle* handle, const char* photo_ids_json);
    int photowall_trash_permanent_delete(PhotowallHandle* handle, const char* photo_ids_json);
    int photowall_trash_get_photos_json(PhotowallHandle* handle, uint32_t page,
                                        uint32_t page_size, char** out_json);
    int photowall_trash_empty(PhotowallHandle* handle);
    int photowall_trash_get_stats_json(PhotowallHandle* handle, char** out_json);

    int photowall_set_photos_favorite(PhotowallHandle* handle, const char* photo_ids_json,
                                      int is_favorite);
    int photowall_set_photo_rating(PhotowallHandle* handle, int64_t photo_id, int32_t rating);
    int photowall_soft_delete_photos(PhotowallHandle* handle, const char* photo_ids_json);
}

#endif // MOCKFFI_H
