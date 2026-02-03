#include "PhotoStore.h"
#include "PhotoModel.h"
#include "RustBridge.h"
#include "EventDispatcher.h"

#include <QQmlEngine>
#include <QJSEngine>

PhotoStore* PhotoStore::s_instance = nullptr;

PhotoStore::PhotoStore(QObject* parent)
    : QObject(parent)
{
    s_instance = this;

    // Create models
    m_photoModel = new PhotoModel(this);
    m_favoritesModel = new PhotoModel(this);
    m_trashModel = new PhotoModel(this);

    // Set up favorites filter
    QJsonObject favFilter;
    favFilter[QStringLiteral("favoritesOnly")] = true;
    m_favoritesModel->setSearchFilters(favFilter);

    // Set up trash filter
    QJsonObject trashFilter;
    trashFilter[QStringLiteral("inTrash")] = true;
    m_trashModel->setSearchFilters(trashFilter);

    // Connect to EventDispatcher
    connect(EventDispatcher::instance(), &EventDispatcher::indexProgress,
            this, &PhotoStore::onIndexProgress);
    connect(EventDispatcher::instance(), &EventDispatcher::indexFinished,
            this, &PhotoStore::onIndexFinished);
    connect(EventDispatcher::instance(), &EventDispatcher::indexCancelled,
            this, &PhotoStore::onIndexCancelled);
}

PhotoStore* PhotoStore::create(QQmlEngine* qmlEngine, QJSEngine* jsEngine)
{
    Q_UNUSED(jsEngine)

    if (!s_instance) {
        s_instance = new PhotoStore(qmlEngine);
    }
    return s_instance;
}

// ============================================================================
// Selection
// ============================================================================

QList<qint64> PhotoStore::selectedIds() const
{
    return m_selectedIds.values();
}

int PhotoStore::selectedCount() const
{
    return m_selectedIds.size();
}

bool PhotoStore::hasSelection() const
{
    return !m_selectedIds.isEmpty();
}

void PhotoStore::selectPhoto(qint64 id, bool append)
{
    if (!append) {
        m_selectedIds.clear();
    }
    m_selectedIds.insert(id);
    m_photoModel->setSelected(id, true);
    emit selectionChanged();
}

void PhotoStore::toggleSelection(qint64 id)
{
    if (m_selectedIds.contains(id)) {
        m_selectedIds.remove(id);
        m_photoModel->setSelected(id, false);
    } else {
        m_selectedIds.insert(id);
        m_photoModel->setSelected(id, true);
    }
    emit selectionChanged();
}

void PhotoStore::selectRange(qint64 fromId, qint64 toId)
{
    int fromIdx = m_photoModel->indexOfPhoto(fromId);
    int toIdx = m_photoModel->indexOfPhoto(toId);

    if (fromIdx < 0 || toIdx < 0) return;

    if (fromIdx > toIdx) std::swap(fromIdx, toIdx);

    for (int i = fromIdx; i <= toIdx; ++i) {
        QModelIndex idx = m_photoModel->index(i);
        qint64 id = m_photoModel->data(idx, PhotoModel::PhotoIdRole).toLongLong();
        m_selectedIds.insert(id);
        m_photoModel->setSelected(id, true);
    }
    emit selectionChanged();
}

void PhotoStore::selectAll()
{
    for (int i = 0; i < m_photoModel->rowCount(); ++i) {
        QModelIndex idx = m_photoModel->index(i);
        qint64 id = m_photoModel->data(idx, PhotoModel::PhotoIdRole).toLongLong();
        m_selectedIds.insert(id);
        m_photoModel->setSelected(id, true);
    }
    emit selectionChanged();
}

void PhotoStore::clearSelection()
{
    m_selectedIds.clear();
    m_photoModel->clearSelection();
    emit selectionChanged();
}

bool PhotoStore::isSelected(qint64 id) const
{
    return m_selectedIds.contains(id);
}

// ============================================================================
// Properties
// ============================================================================

void PhotoStore::setSearchQuery(const QString& query)
{
    if (m_searchQuery != query) {
        m_searchQuery = query;
        emit searchQueryChanged();
        updateActiveModel();
    }
}

void PhotoStore::setSearchFilters(const QJsonObject& filters)
{
    if (m_searchFilters != filters) {
        m_searchFilters = filters;
        emit searchFiltersChanged();
        updateActiveModel();
    }
}

void PhotoStore::setCurrentView(const QString& view)
{
    if (m_currentView != view) {
        m_currentView = view;
        emit currentViewChanged();
        updateActiveModel();
    }
}

void PhotoStore::setCurrentFolderPath(const QString& path)
{
    if (m_currentFolderPath != path) {
        m_currentFolderPath = path;
        emit currentFolderPathChanged();
        updateActiveModel();
    }
}

void PhotoStore::setCurrentTagId(qint64 tagId)
{
    if (m_currentTagId != tagId) {
        m_currentTagId = tagId;
        emit currentTagIdChanged();
        updateActiveModel();
    }
}

void PhotoStore::setCurrentAlbumId(qint64 albumId)
{
    if (m_currentAlbumId != albumId) {
        m_currentAlbumId = albumId;
        emit currentAlbumIdChanged();
        updateActiveModel();
    }
}

// ============================================================================
// Batch Operations
// ============================================================================

void PhotoStore::setFavorite(bool favorite)
{
    if (m_selectedIds.isEmpty()) return;

    RustBridge::instance()->setPhotosFavorite(selectedIds(), favorite);
    m_photoModel->refresh();
}

void PhotoStore::setRating(int rating)
{
    if (m_selectedIds.isEmpty()) return;

    RustBridge::instance()->setPhotosRating(selectedIds(), rating);
    m_photoModel->refresh();
}

void PhotoStore::deleteSelected()
{
    if (m_selectedIds.isEmpty()) return;

    RustBridge::instance()->trashPhotos(selectedIds());
    clearSelection();
    m_photoModel->refresh();
    m_trashModel->refresh();
}

void PhotoStore::restoreSelected()
{
    if (m_selectedIds.isEmpty()) return;

    RustBridge::instance()->restorePhotos(selectedIds());
    clearSelection();
    m_photoModel->refresh();
    m_trashModel->refresh();
}

void PhotoStore::permanentlyDeleteSelected()
{
    if (m_selectedIds.isEmpty()) return;

    RustBridge::instance()->deletePhotosPermanently(selectedIds());
    clearSelection();
    m_trashModel->refresh();
}

// ============================================================================
// Tag Operations
// ============================================================================

void PhotoStore::addTagToSelected(qint64 tagId)
{
    if (m_selectedIds.isEmpty()) return;
    RustBridge::instance()->addTagToPhotos(tagId, selectedIds());
}

void PhotoStore::removeTagFromSelected(qint64 tagId)
{
    if (m_selectedIds.isEmpty()) return;
    RustBridge::instance()->removeTagFromPhotos(tagId, selectedIds());
}

// ============================================================================
// Album Operations
// ============================================================================

void PhotoStore::addSelectedToAlbum(qint64 albumId)
{
    if (m_selectedIds.isEmpty()) return;
    RustBridge::instance()->addPhotosToAlbum(albumId, selectedIds());
}

void PhotoStore::removeSelectedFromAlbum(qint64 albumId)
{
    if (m_selectedIds.isEmpty()) return;
    RustBridge::instance()->removePhotosFromAlbum(albumId, selectedIds());
}

// ============================================================================
// Indexing
// ============================================================================

void PhotoStore::startIndexing(const QString& path)
{
    if (m_indexing) return;

    setIndexing(true);
    m_currentIndexJobId = RustBridge::instance()->indexDirectoryAsync(path);
}

void PhotoStore::cancelIndexing()
{
    if (!m_indexing || m_currentIndexJobId == 0) return;

    RustBridge::instance()->cancelJob(m_currentIndexJobId);
}

void PhotoStore::setIndexing(bool indexing)
{
    if (m_indexing != indexing) {
        m_indexing = indexing;
        emit indexingChanged();
    }
}

void PhotoStore::onIndexProgress(int processed, int total, const QString& currentFile)
{
    m_indexProgress = total > 0 ? static_cast<double>(processed) / total : 0.0;
    m_indexCurrentFile = currentFile;
    emit indexProgressChanged();
    emit indexCurrentFileChanged();
}

void PhotoStore::onIndexFinished(int indexed, int skipped, int failed)
{
    Q_UNUSED(indexed)
    Q_UNUSED(skipped)
    Q_UNUSED(failed)

    setIndexing(false);
    m_currentIndexJobId = 0;
    m_indexProgress = 1.0;
    m_indexCurrentFile.clear();
    emit indexProgressChanged();
    emit indexCurrentFileChanged();

    // Refresh models after indexing
    m_photoModel->refresh();
}

void PhotoStore::onIndexCancelled()
{
    setIndexing(false);
    m_currentIndexJobId = 0;
    m_indexProgress = 0.0;
    m_indexCurrentFile.clear();
    emit indexProgressChanged();
    emit indexCurrentFileChanged();
}

// ============================================================================
// Private
// ============================================================================

void PhotoStore::updateActiveModel()
{
    QJsonObject filters = m_searchFilters;

    if (!m_searchQuery.isEmpty()) {
        filters[QStringLiteral("query")] = m_searchQuery;
    }

    if (!m_currentFolderPath.isEmpty()) {
        filters[QStringLiteral("folderPath")] = m_currentFolderPath;
        bool includeSubfolders = true;
        const auto includeValue = filters.value(QStringLiteral("includeSubfolders"));
        if (!includeValue.isUndefined()) {
            includeSubfolders = includeValue.toBool();
        }
        filters[QStringLiteral("includeSubfolders")] = includeSubfolders;
    }

    if (m_currentTagId > 0) {
        QJsonArray tagIds;
        tagIds.append(m_currentTagId);
        filters[QStringLiteral("tagIds")] = tagIds;
    }

    if (m_currentAlbumId > 0) {
        filters[QStringLiteral("albumId")] = m_currentAlbumId;
    }

    m_photoModel->setSearchFilters(filters);
    m_photoModel->refresh();
}
