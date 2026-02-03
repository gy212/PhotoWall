#ifndef PHOTOMODEL_H
#define PHOTOMODEL_H

#include <QAbstractListModel>
#include <QJsonObject>
#include <QJsonArray>
#include <QHash>
#include <QSet>

/**
 * C-02: PhotoModel
 * QAbstractListModel for QML GridView with cursor-based pagination.
 */
class PhotoModel : public QAbstractListModel
{
    Q_OBJECT

    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(bool loading READ loading NOTIFY loadingChanged)
    Q_PROPERTY(bool hasMore READ hasMore NOTIFY hasMoreChanged)
    Q_PROPERTY(int totalCount READ totalCount NOTIFY totalCountChanged)
    Q_PROPERTY(QJsonObject searchFilters READ searchFilters WRITE setSearchFilters NOTIFY searchFiltersChanged)
    Q_PROPERTY(QString sortField READ sortField WRITE setSortField NOTIFY sortFieldChanged)
    Q_PROPERTY(QString sortOrder READ sortOrder WRITE setSortOrder NOTIFY sortOrderChanged)

public:
    enum PhotoRoles {
        PhotoIdRole = Qt::UserRole + 1,
        FilePathRole,
        FileNameRole,
        FileHashRole,
        WidthRole,
        HeightRole,
        DateTakenRole,
        DateAddedRole,
        IsFavoriteRole,
        RatingRole,
        SelectedRole,
        CameraModelRole,
        LensModelRole,
        FileSizeRole,
        ThumbnailUrlRole
    };
    Q_ENUM(PhotoRoles)

    explicit PhotoModel(QObject* parent = nullptr);
    ~PhotoModel() override = default;

    // QAbstractListModel interface
    int rowCount(const QModelIndex& parent = QModelIndex()) const override;
    QVariant data(const QModelIndex& index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    // Properties
    int count() const { return m_photos.size(); }
    bool loading() const { return m_loading; }
    bool hasMore() const { return m_hasMore; }
    int totalCount() const { return m_totalCount; }

    QJsonObject searchFilters() const { return m_searchFilters; }
    void setSearchFilters(const QJsonObject& filters);

    QString sortField() const { return m_sortField; }
    void setSortField(const QString& field);

    QString sortOrder() const { return m_sortOrder; }
    void setSortOrder(const QString& order);

    // Data loading
    Q_INVOKABLE void loadInitial();
    Q_INVOKABLE void loadMore();
    Q_INVOKABLE void refresh();
    Q_INVOKABLE void clear();

    // Selection
    Q_INVOKABLE void setSelected(qint64 photoId, bool selected);
    Q_INVOKABLE bool isSelected(qint64 photoId) const;
    Q_INVOKABLE QList<qint64> selectedIds() const;
    Q_INVOKABLE void clearSelection();

    // Lookup
    Q_INVOKABLE QJsonObject getPhotoById(qint64 photoId) const;
    Q_INVOKABLE int indexOfPhoto(qint64 photoId) const;

signals:
    void countChanged();
    void loadingChanged();
    void hasMoreChanged();
    void totalCountChanged();
    void searchFiltersChanged();
    void sortFieldChanged();
    void sortOrderChanged();
    void selectionChanged();

public slots:
    void onPhotosReady(const QJsonArray& photos, const QJsonObject& nextCursor,
                       int total, bool hasMore);

private:
    struct PhotoData {
        qint64 id = 0;
        QString filePath;
        QString fileName;
        QString fileHash;
        int width = 0;
        int height = 0;
        QString dateTaken;
        QString dateAdded;
        bool isFavorite = false;
        int rating = 0;
        QString cameraModel;
        QString lensModel;
        qint64 fileSize = 0;

        static PhotoData fromJson(const QJsonObject& obj);
    };

    QVector<PhotoData> m_photos;
    QHash<qint64, int> m_idToIndex;
    QSet<qint64> m_selectedIds;

    QJsonObject m_nextCursor;
    QJsonObject m_searchFilters;
    QString m_sortField = QStringLiteral("dateTaken");
    QString m_sortOrder = QStringLiteral("desc");

    int m_totalCount = 0;
    bool m_loading = false;
    bool m_hasMore = false;

    static constexpr int PAGE_SIZE = 100;

    void setLoading(bool loading);
    void rebuildIndex();
};

#endif // PHOTOMODEL_H
