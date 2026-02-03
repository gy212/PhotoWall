/**
 * @file photowall.h
 * @brief PhotoWall Core Library - C API
 *
 * This header provides the C interface for the PhotoWall photo management library.
 * It enables Qt and other non-Rust frontends to interact with the Rust core.
 *
 * ## Usage
 *
 * 1. Call photowall_init() to create a handle
 * 2. Optionally register an event callback with photowall_set_event_callback()
 * 3. Use the various API functions
 * 4. Call photowall_shutdown() to clean up
 *
 * ## Error Handling
 *
 * Most functions return 0 on success, -1 on error.
 * Call photowall_last_error() to get the error message.
 *
 * ## Memory Management
 *
 * - Strings returned via out_json must be freed with photowall_free_string()
 * - The handle must be freed with photowall_shutdown()
 * - Input strings are borrowed (not freed by the library)
 *
 * ## Thread Safety
 *
 * - All functions are thread-safe
 * - Event callbacks may be invoked from background threads
 * - Qt must marshal callbacks to the UI thread if needed
 */

#ifndef PHOTOWALL_H
#define PHOTOWALL_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Types
 * ============================================================================ */

/**
 * Opaque handle to the PhotoWall library instance.
 * Created by photowall_init(), freed by photowall_shutdown().
 */
typedef struct PhotowallHandle PhotowallHandle;

/**
 * Job identifier for async operations.
 * Returned by async functions, used with photowall_cancel_job().
 */
typedef uint64_t JobId;

/**
 * Event callback function type.
 *
 * @param name       Event name (null-terminated UTF-8)
 * @param payload    JSON payload (null-terminated UTF-8)
 * @param user_data  User-provided context pointer
 *
 * Note: This callback may be invoked from background threads.
 * Qt applications should use Qt::QueuedConnection or similar
 * to marshal to the UI thread.
 */
typedef void (*EventCallback)(const char* name, const char* payload, void* user_data);

/* ============================================================================
 * Initialization and Lifecycle
 * ============================================================================ */

/**
 * Initialize the PhotoWall library.
 *
 * @return Valid handle pointer on success, NULL on error.
 *         Call photowall_last_error() for error details.
 *
 * The returned handle must be freed with photowall_shutdown().
 */
PhotowallHandle* photowall_init(void);

/**
 * Shutdown the PhotoWall library and free resources.
 *
 * @param handle  Handle from photowall_init() (may be NULL)
 *
 * After calling this function, the handle is invalid.
 */
void photowall_shutdown(PhotowallHandle* handle);

/**
 * Get the last error message.
 *
 * @return Pointer to error message, or NULL if no error.
 *         The pointer is valid until the next FFI call on this thread.
 */
const char* photowall_last_error(void);

/**
 * Free a string allocated by the library.
 *
 * @param s  String pointer from a photowall function (may be NULL)
 *
 * After calling this function, the pointer is invalid.
 */
void photowall_free_string(char* s);

/**
 * Get the library version.
 *
 * @return Version string (must be freed with photowall_free_string())
 */
char* photowall_version(void);

/* ============================================================================
 * Event Callbacks
 * ============================================================================ */

/**
 * Register an event callback.
 *
 * @param handle     Valid handle from photowall_init()
 * @param callback   Callback function pointer
 * @param user_data  User context passed to callback (may be NULL)
 *
 * @return 0 on success, -1 on error
 *
 * Events emitted:
 * - "index-progress": Indexing progress updates
 * - "index-finished": Indexing completed
 * - "index-cancelled": Indexing was cancelled
 * - "thumbnail-ready": Thumbnail generation completed
 * - "settings-changed": Settings were updated
 */
int photowall_set_event_callback(
    PhotowallHandle* handle,
    EventCallback callback,
    void* user_data
);

/**
 * Clear the event callback.
 *
 * @param handle  Valid handle from photowall_init()
 * @return 0 on success, -1 on error
 */
int photowall_clear_event_callback(PhotowallHandle* handle);

/* ============================================================================
 * Photo Query API
 * ============================================================================ */

/**
 * Get photos with cursor-based pagination.
 *
 * @param handle       Valid handle
 * @param limit        Maximum number of photos to return
 * @param cursor_json  JSON cursor from previous call (NULL for first page)
 * @param sort_json    JSON sort options (NULL for defaults)
 * @param out_json     Output: JSON object with {photos, nextCursor, total, hasMore}
 *
 * @return 0 on success, -1 on error
 */
int photowall_get_photos_cursor_json(
    PhotowallHandle* handle,
    uint32_t limit,
    const char* cursor_json,
    const char* sort_json,
    char** out_json
);

/**
 * Search photos with filters and cursor-based pagination.
 *
 * @param handle        Valid handle
 * @param filters_json  JSON search filters
 * @param limit         Maximum number of photos to return
 * @param cursor_json   JSON cursor from previous call (NULL for first page)
 * @param sort_json     JSON sort options (NULL for defaults)
 * @param include_total Whether to include total count (1=yes, 0=no)
 * @param out_json      Output: JSON object with {photos, nextCursor, total, hasMore}
 *
 * @return 0 on success, -1 on error
 */
int photowall_search_photos_cursor_json(
    PhotowallHandle* handle,
    const char* filters_json,
    uint32_t limit,
    const char* cursor_json,
    const char* sort_json,
    int include_total,
    char** out_json
);

/**
 * Get a single photo by ID.
 *
 * @param handle    Valid handle
 * @param photo_id  Photo ID
 * @param out_json  Output: JSON photo object
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_get_photo_json(
    PhotowallHandle* handle,
    int64_t photo_id,
    char** out_json
);

/* ============================================================================
 * Indexing API
 * ============================================================================ */

/**
 * Start indexing a directory asynchronously.
 *
 * @param handle     Valid handle
 * @param path_utf8  UTF-8 encoded directory path
 *
 * @return Job ID (> 0) on success, 0 on error
 *
 * Events emitted:
 * - "index-progress": {total, processed, indexed, skipped, failed, currentFile, percentage}
 * - "index-finished": {jobId, indexed, skipped, failed, failedFiles}
 * - "index-cancelled": {jobId}
 */
JobId photowall_index_directory_async(
    PhotowallHandle* handle,
    const char* path_utf8
);

/* ============================================================================
 * Thumbnail API
 * ============================================================================ */

/**
 * Enqueue multiple thumbnail generation requests.
 *
 * @param handle         Valid handle
 * @param requests_json  JSON array of thumbnail requests
 *
 * Request format:
 * [{"filePath": "...", "fileHash": "...", "size": "small", "priority": 10, "width": 1920, "height": 1080}]
 *
 * Size values: "tiny", "small", "medium", "large"
 *
 * @return Number of requests enqueued (>= 0), -1 on error
 */
int photowall_enqueue_thumbnails_batch(
    PhotowallHandle* handle,
    const char* requests_json
);

/**
 * Get the path to a cached thumbnail.
 *
 * @param handle     Valid handle
 * @param file_hash  File hash
 * @param size       Size name ("tiny", "small", "medium", "large")
 *
 * @return Path string (free with photowall_free_string), NULL if not cached
 */
char* photowall_get_thumbnail_path_utf8(
    PhotowallHandle* handle,
    const char* file_hash,
    const char* size
);

/**
 * Check if a thumbnail is cached.
 *
 * @param handle     Valid handle
 * @param file_hash  File hash
 * @param size       Size name
 *
 * @return 1 if cached, 0 if not cached, -1 on error
 */
int photowall_is_thumbnail_cached(
    PhotowallHandle* handle,
    const char* file_hash,
    const char* size
);

/* ============================================================================
 * Tag API
 * ============================================================================ */

/**
 * Get all tags as JSON.
 *
 * @param handle    Valid handle
 * @param out_json  Output: JSON array of tags with counts
 *
 * @return 0 on success, -1 on error
 */
int photowall_tags_get_all_json(PhotowallHandle* handle, char** out_json);

/**
 * Add a tag to a photo.
 *
 * @return 0 on success, 1 if already tagged, -1 on error
 */
int photowall_tags_add_to_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id);

/**
 * Remove a tag from a photo.
 *
 * @return 0 on success, 1 if not tagged, -1 on error
 */
int photowall_tags_remove_from_photo(PhotowallHandle* handle, int64_t photo_id, int64_t tag_id);

/**
 * Create a new tag.
 *
 * @param handle    Valid handle
 * @param name      Tag name (required)
 * @param color     Tag color (may be NULL)
 * @param out_json  Output: JSON tag object
 *
 * @return 0 on success, -1 on error
 */
int photowall_tags_create_json(
    PhotowallHandle* handle,
    const char* name,
    const char* color,
    char** out_json
);

/**
 * Delete a tag.
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_tags_delete(PhotowallHandle* handle, int64_t tag_id);

/**
 * Update a tag.
 *
 * @param handle    Valid handle
 * @param tag_id    Tag ID
 * @param name      New name (may be NULL to keep current)
 * @param color     New color (may be NULL to keep current)
 * @param out_json  Output: JSON updated tag object
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_tags_update_json(
    PhotowallHandle* handle,
    int64_t tag_id,
    const char* name,
    const char* color,
    char** out_json
);

/* ============================================================================
 * Album API
 * ============================================================================ */

/**
 * Get all albums as JSON.
 *
 * @return 0 on success, -1 on error
 */
int photowall_albums_get_all_json(PhotowallHandle* handle, char** out_json);

/**
 * Add a photo to an album.
 *
 * @return 0 on success, 1 if already in album, -1 on error
 */
int photowall_albums_add_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id);

/**
 * Remove a photo from an album.
 *
 * @return 0 on success, 1 if not in album, -1 on error
 */
int photowall_albums_remove_photo(PhotowallHandle* handle, int64_t album_id, int64_t photo_id);

/**
 * Create a new album.
 *
 * @param handle       Valid handle
 * @param name         Album name (required)
 * @param description  Album description (may be NULL)
 * @param out_json     Output: JSON album object
 *
 * @return 0 on success, -1 on error
 */
int photowall_albums_create_json(
    PhotowallHandle* handle,
    const char* name,
    const char* description,
    char** out_json
);

/**
 * Delete an album.
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_albums_delete(PhotowallHandle* handle, int64_t album_id);

/**
 * Get photos in an album with pagination.
 *
 * @param handle     Valid handle
 * @param album_id   Album ID
 * @param page       Page number (1-based)
 * @param page_size  Items per page
 * @param sort_json  JSON sort options (may be NULL)
 * @param out_json   Output: JSON paginated result
 *
 * @return 0 on success, -1 on error
 */
int photowall_albums_get_photos_json(
    PhotowallHandle* handle,
    int64_t album_id,
    uint32_t page,
    uint32_t page_size,
    const char* sort_json,
    char** out_json
);

/* ============================================================================
 * Trash API
 * ============================================================================ */

/**
 * Soft delete photos (move to trash).
 *
 * @param handle          Valid handle
 * @param photo_ids_json  JSON array of photo IDs
 *
 * @return Number of photos deleted (>= 0), -1 on error
 */
int photowall_trash_soft_delete(PhotowallHandle* handle, const char* photo_ids_json);

/**
 * Restore photos from trash.
 *
 * @return Number of photos restored (>= 0), -1 on error
 */
int photowall_trash_restore(PhotowallHandle* handle, const char* photo_ids_json);

/**
 * Permanently delete photos.
 *
 * @return Number of photos deleted (>= 0), -1 on error
 */
int photowall_trash_permanent_delete(PhotowallHandle* handle, const char* photo_ids_json);

/**
 * Get deleted photos with pagination.
 *
 * @return 0 on success, -1 on error
 */
int photowall_trash_get_photos_json(
    PhotowallHandle* handle,
    uint32_t page,
    uint32_t page_size,
    char** out_json
);

/**
 * Empty the trash (permanently delete all trashed photos).
 *
 * @return Number of photos deleted (>= 0), -1 on error
 */
int photowall_trash_empty(PhotowallHandle* handle);

/**
 * Get trash statistics.
 *
 * @return 0 on success, -1 on error
 */
int photowall_trash_get_stats_json(PhotowallHandle* handle, char** out_json);

/* ============================================================================
 * Settings API
 * ============================================================================ */

/**
 * Get current settings as JSON.
 *
 * @return 0 on success, -1 on error
 */
int photowall_get_settings_json(PhotowallHandle* handle, char** out_json);

/**
 * Save settings from JSON.
 *
 * Emits "settings-changed" event on success.
 *
 * @return 0 on success, -1 on error
 */
int photowall_save_settings_json(PhotowallHandle* handle, const char* settings_json);

/* ============================================================================
 * Folder API
 * ============================================================================ */

/**
 * Get folder tree with photo counts as JSON.
 *
 * Returns an array of nodes:
 * {path, name, photoCount, hasChildren, children?}
 *
 * @return 0 on success, -1 on error
 */
int photowall_get_folder_tree_json(PhotowallHandle* handle, char** out_json);

/**
 * Get child folders for a given path.
 *
 * @param handle      Valid handle
 * @param folder_path Folder path (NULL for root)
 * @param out_json    Output: JSON array of folder nodes
 *
 * @return 0 on success, -1 on error
 */
int photowall_get_folder_children_json(
    PhotowallHandle* handle,
    const char* folder_path,
    char** out_json
);

/**
 * Get photos in a folder with pagination.
 *
 * @param handle             Valid handle
 * @param folder_path        Folder path
 * @param include_subfolders Include photos from subfolders (1=yes, 0=no)
 * @param page               Page number (1-based)
 * @param page_size          Items per page
 * @param sort_json          JSON sort options (may be NULL)
 * @param out_json           Output: JSON paginated result
 *
 * @return 0 on success, -1 on error
 */
int photowall_get_folder_photos_json(
    PhotowallHandle* handle,
    const char* folder_path,
    int include_subfolders,
    uint32_t page,
    uint32_t page_size,
    const char* sort_json,
    char** out_json
);

/* ============================================================================
 * Photo Operations API
 * ============================================================================ */

/**
 * Set favorite status for multiple photos.
 *
 * @param handle          Valid handle
 * @param photo_ids_json  JSON array of photo IDs
 * @param is_favorite     1 to favorite, 0 to unfavorite
 *
 * @return Number of photos updated (>= 0), -1 on error
 */
int photowall_set_photos_favorite(
    PhotowallHandle* handle,
    const char* photo_ids_json,
    int is_favorite
);

/**
 * Set rating for a single photo.
 *
 * @param handle    Valid handle
 * @param photo_id  Photo ID
 * @param rating    Rating value (0-5)
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_set_photo_rating(PhotowallHandle* handle, int64_t photo_id, int32_t rating);

/**
 * Soft delete multiple photos.
 *
 * @return Number of photos deleted (>= 0), -1 on error
 */
int photowall_soft_delete_photos(PhotowallHandle* handle, const char* photo_ids_json);

/**
 * Update a photo's metadata.
 *
 * @param handle        Valid handle
 * @param photo_id      Photo ID
 * @param updates_json  JSON object with fields to update
 *
 * @return 0 on success, 1 if not found, -1 on error
 */
int photowall_update_photo_json(
    PhotowallHandle* handle,
    int64_t photo_id,
    const char* updates_json
);

/* ============================================================================
 * Job Management API
 * ============================================================================ */

/**
 * Cancel a running job.
 *
 * @param handle  Valid handle
 * @param job_id  Job ID from an async function
 *
 * @return 1 if cancelled, 0 if not found, -1 on error
 */
int photowall_cancel_job(PhotowallHandle* handle, JobId job_id);

/**
 * Get the number of active jobs.
 *
 * @return Number of active jobs (>= 0), -1 on error
 */
int photowall_get_active_job_count(PhotowallHandle* handle);

/**
 * Check if a job is active.
 *
 * @return 1 if active, 0 if not active, -1 on error
 */
int photowall_is_job_active(PhotowallHandle* handle, JobId job_id);

#ifdef __cplusplus
}
#endif

#endif /* PHOTOWALL_H */
