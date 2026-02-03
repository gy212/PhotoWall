#include "PhotoModel.h"
#include "RustBridge.h"
#include "utils/JsonHelper.h"

#include <QUrl>

PhotoModel::PhotoModel(QObject* parent)
    : QAbstractListModel(parent)
{
    // Connect to RustBridge signals
    connect(RustBridge::instance(), &RustBridge::photosReady,
            this, &PhotoModel::onPhotosReady);
}

int PhotoModel::rowCount(const QModelIndex& parent) const
{
    if (parent.isValid()) return 0;
    return m_photos.size();
}

QVariant PhotoModel::data(const QModelIndex& index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_photos.size()) {
        return QVariant();
    }

    const PhotoData& photo = m_photos.at(index.row());

    switch (role) {
    case PhotoIdRole:
        return photo.id;
    case FilePathRole:
        return photo.filePath;
    case FileNameRole:
        return photo.fileName;
    case FileHashRole:
        return photo.fileHash;
    case WidthRole:
        return photo.width;
    case HeightRole:
        return photo.height;
    case DateTakenRole:
        return photo.dateTaken;
    case DateAddedRole:
        return photo.dateAdded;
    case IsFavoriteRole:
        return photo.isFavorite;
    case RatingRole:
        return photo.rating;
    case SelectedRole:
        return m_selectedIds.contains(photo.id);
    case CameraModelRole:
        return photo.cameraModel;
    case LensModelRole:
        return photo.lensModel;
    case FileSizeRole:
        return photo.fileSize;
    case ThumbnailUrlRole:
        if (photo.filePath.isEmpty()) {
            return QStringLiteral("image://thumbnail/%1/medium").arg(photo.fileHash);
        }
        return QStringLiteral("image://thumbnail/%1|%2/medium")
            .arg(photo.fileHash, QString::fromUtf8(QUrl::toPercentEncoding(photo.filePath)));
    default:
        return QVariant();
    }
}

QHash<int, QByteArray> PhotoModel::roleNames() const
{
    return {
        {PhotoIdRole, "photoId"},
        {FilePathRole, "filePath"},
        {FileNameRole, "fileName"},
        {FileHashRole, "fileHash"},
        {WidthRole, "width"},
        {HeightRole, "height"},
        {DateTakenRole, "dateTaken"},
        {DateAddedRole, "dateAdded"},
        {IsFavoriteRole, "isFavorite"},
        {RatingRole, "rating"},
        {SelectedRole, "selected"},
        {CameraModelRole, "cameraModel"},
        {LensModelRole, "lensModel"},
        {FileSizeRole, "fileSize"},
        {ThumbnailUrlRole, "thumbnailUrl"}
    };
}

// ============================================================================
// Properties
// ============================================================================

void PhotoModel::setSearchFilters(const QJsonObject& filters)
{
    if (m_searchFilters != filters) {
        m_searchFilters = filters;
        emit searchFiltersChanged();
    }
}

void PhotoModel::setSortField(const QString& field)
{
    if (m_sortField != field) {
        m_sortField = field;
        emit sortFieldChanged();
    }
}

void PhotoModel::setSortOrder(const QString& order)
{
    if (m_sortOrder != order) {
        m_sortOrder = order;
        emit sortOrderChanged();
    }
}

void PhotoModel::setLoading(bool loading)
{
    if (m_loading != loading) {
        m_loading = loading;
        emit loadingChanged();
    }
}

// ============================================================================
// Data Loading
// ============================================================================

void PhotoModel::loadInitial()
{
    if (m_loading) return;

    clear();
    setLoading(true);

    QJsonObject sortOptions;
    sortOptions[QStringLiteral("field")] = m_sortField;
    sortOptions[QStringLiteral("order")] = m_sortOrder;

    if (m_searchFilters.isEmpty()) {
        RustBridge::instance()->getPhotosAsync(PAGE_SIZE, QJsonObject(), sortOptions);
    } else {
        RustBridge::instance()->searchPhotosAsync(m_searchFilters, PAGE_SIZE, QJsonObject(), sortOptions);
    }
}

void PhotoModel::loadMore()
{
    if (m_loading || !m_hasMore) return;

    setLoading(true);

    QJsonObject sortOptions;
    sortOptions[QStringLiteral("field")] = m_sortField;
    sortOptions[QStringLiteral("order")] = m_sortOrder;

    if (m_searchFilters.isEmpty()) {
        RustBridge::instance()->getPhotosAsync(PAGE_SIZE, m_nextCursor, sortOptions);
    } else {
        RustBridge::instance()->searchPhotosAsync(m_searchFilters, PAGE_SIZE, m_nextCursor, sortOptions);
    }
}

void PhotoModel::refresh()
{
    loadInitial();
}

void PhotoModel::clear()
{
    if (!m_photos.isEmpty()) {
        beginResetModel();
        m_photos.clear();
        m_idToIndex.clear();
        m_nextCursor = QJsonObject();
        m_totalCount = 0;
        m_hasMore = false;
        endResetModel();

        emit countChanged();
        emit totalCountChanged();
        emit hasMoreChanged();
    }
}

void PhotoModel::onPhotosReady(const QJsonArray& photos, const QJsonObject& nextCursor,
                               int total, bool hasMore)
{
    setLoading(false);

    if (photos.isEmpty()) {
        m_hasMore = false;
        emit hasMoreChanged();
        return;
    }

    int startRow = m_photos.size();
    int endRow = startRow + photos.size() - 1;

    beginInsertRows(QModelIndex(), startRow, endRow);

    for (const QJsonValue& val : photos) {
        if (val.isObject()) {
            PhotoData photo = PhotoData::fromJson(val.toObject());
            m_idToIndex[photo.id] = m_photos.size();
            m_photos.append(photo);
        }
    }

    endInsertRows();

    m_nextCursor = nextCursor;
    m_totalCount = total;
    m_hasMore = hasMore;

    emit countChanged();
    emit totalCountChanged();
    emit hasMoreChanged();
}

// ============================================================================
// Selection
// ============================================================================

void PhotoModel::setSelected(qint64 photoId, bool selected)
{
    int idx = indexOfPhoto(photoId);
    if (idx < 0) return;

    bool changed = false;
    if (selected && !m_selectedIds.contains(photoId)) {
        m_selectedIds.insert(photoId);
        changed = true;
    } else if (!selected && m_selectedIds.contains(photoId)) {
        m_selectedIds.remove(photoId);
        changed = true;
    }

    if (changed) {
        QModelIndex modelIdx = index(idx);
        emit dataChanged(modelIdx, modelIdx, {SelectedRole});
        emit selectionChanged();
    }
}

bool PhotoModel::isSelected(qint64 photoId) const
{
    return m_selectedIds.contains(photoId);
}

QList<qint64> PhotoModel::selectedIds() const
{
    return m_selectedIds.values();
}

void PhotoModel::clearSelection()
{
    if (m_selectedIds.isEmpty()) return;

    QSet<qint64> oldSelection = m_selectedIds;
    m_selectedIds.clear();

    // Notify changed rows
    for (qint64 id : oldSelection) {
        int idx = indexOfPhoto(id);
        if (idx >= 0) {
            QModelIndex modelIdx = index(idx);
            emit dataChanged(modelIdx, modelIdx, {SelectedRole});
        }
    }

    emit selectionChanged();
}

// ============================================================================
// Lookup
// ============================================================================

QJsonObject PhotoModel::getPhotoById(qint64 photoId) const
{
    int idx = indexOfPhoto(photoId);
    if (idx < 0) return QJsonObject();

    const PhotoData& photo = m_photos.at(idx);
    QJsonObject obj;
    obj[QStringLiteral("id")] = photo.id;
    obj[QStringLiteral("filePath")] = photo.filePath;
    obj[QStringLiteral("fileName")] = photo.fileName;
    obj[QStringLiteral("fileHash")] = photo.fileHash;
    obj[QStringLiteral("width")] = photo.width;
    obj[QStringLiteral("height")] = photo.height;
    obj[QStringLiteral("dateTaken")] = photo.dateTaken;
    obj[QStringLiteral("dateAdded")] = photo.dateAdded;
    obj[QStringLiteral("isFavorite")] = photo.isFavorite;
    obj[QStringLiteral("rating")] = photo.rating;
    obj[QStringLiteral("cameraModel")] = photo.cameraModel;
    obj[QStringLiteral("lensModel")] = photo.lensModel;
    obj[QStringLiteral("fileSize")] = photo.fileSize;
    return obj;
}

int PhotoModel::indexOfPhoto(qint64 photoId) const
{
    auto it = m_idToIndex.find(photoId);
    return (it != m_idToIndex.end()) ? it.value() : -1;
}

void PhotoModel::rebuildIndex()
{
    m_idToIndex.clear();
    for (int i = 0; i < m_photos.size(); ++i) {
        m_idToIndex[m_photos[i].id] = i;
    }
}

// ============================================================================
// PhotoData
// ============================================================================

PhotoModel::PhotoData PhotoModel::PhotoData::fromJson(const QJsonObject& obj)
{
    PhotoData data;
    data.id = JsonHelper::getInt64(obj, QStringLiteral("photoId"));
    data.filePath = JsonHelper::getString(obj, QStringLiteral("filePath"));
    data.fileName = JsonHelper::getString(obj, QStringLiteral("fileName"));
    data.fileHash = JsonHelper::getString(obj, QStringLiteral("fileHash"));
    data.width = JsonHelper::getInt(obj, QStringLiteral("width"));
    data.height = JsonHelper::getInt(obj, QStringLiteral("height"));
    data.dateTaken = JsonHelper::getString(obj, QStringLiteral("dateTaken"));
    data.dateAdded = JsonHelper::getString(obj, QStringLiteral("dateAdded"));
    data.isFavorite = JsonHelper::getBool(obj, QStringLiteral("isFavorite"));
    data.rating = JsonHelper::getInt(obj, QStringLiteral("rating"));
    data.cameraModel = JsonHelper::getString(obj, QStringLiteral("cameraModel"));
    data.lensModel = JsonHelper::getString(obj, QStringLiteral("lensModel"));
    data.fileSize = JsonHelper::getInt64(obj, QStringLiteral("fileSize"));
    return data;
}
