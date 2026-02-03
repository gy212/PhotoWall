#ifndef PHOTOSTORE_H
#define PHOTOSTORE_H

#include <QObject>
#include <QJsonObject>
#include <QSet>
#include <QtQml/qqmlregistration.h>

class PhotoModel;
class QQmlEngine;
class QJSEngine;

/**
 * C-04: PhotoStore
 * QML singleton for global state management.
 */
class PhotoStore : public QObject
{
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON

    // Models
    Q_PROPERTY(PhotoModel* photoModel READ photoModel CONSTANT)
    Q_PROPERTY(PhotoModel* favoritesModel READ favoritesModel CONSTANT)
    Q_PROPERTY(PhotoModel* trashModel READ trashModel CONSTANT)

    // Selection
    Q_PROPERTY(QList<qint64> selectedIds READ selectedIds NOTIFY selectionChanged)
    Q_PROPERTY(int selectedCount READ selectedCount NOTIFY selectionChanged)
    Q_PROPERTY(bool hasSelection READ hasSelection NOTIFY selectionChanged)

    // Search
    Q_PROPERTY(QString searchQuery READ searchQuery WRITE setSearchQuery NOTIFY searchQueryChanged)
    Q_PROPERTY(QJsonObject searchFilters READ searchFilters WRITE setSearchFilters NOTIFY searchFiltersChanged)

    // View state
    Q_PROPERTY(QString currentView READ currentView WRITE setCurrentView NOTIFY currentViewChanged)
    Q_PROPERTY(QString currentFolderPath READ currentFolderPath WRITE setCurrentFolderPath NOTIFY currentFolderPathChanged)
    Q_PROPERTY(qint64 currentTagId READ currentTagId WRITE setCurrentTagId NOTIFY currentTagIdChanged)
    Q_PROPERTY(qint64 currentAlbumId READ currentAlbumId WRITE setCurrentAlbumId NOTIFY currentAlbumIdChanged)

    // Indexing state
    Q_PROPERTY(bool indexing READ indexing NOTIFY indexingChanged)
    Q_PROPERTY(double indexProgress READ indexProgress NOTIFY indexProgressChanged)
    Q_PROPERTY(QString indexCurrentFile READ indexCurrentFile NOTIFY indexCurrentFileChanged)

public:
    explicit PhotoStore(QObject* parent = nullptr);
    ~PhotoStore() override = default;

    static PhotoStore* create(QQmlEngine* qmlEngine, QJSEngine* jsEngine);

    // Models
    PhotoModel* photoModel() const { return m_photoModel; }
    PhotoModel* favoritesModel() const { return m_favoritesModel; }
    PhotoModel* trashModel() const { return m_trashModel; }

    // Selection
    QList<qint64> selectedIds() const;
    int selectedCount() const;
    bool hasSelection() const;

    // Search
    QString searchQuery() const { return m_searchQuery; }
    void setSearchQuery(const QString& query);

    QJsonObject searchFilters() const { return m_searchFilters; }
    void setSearchFilters(const QJsonObject& filters);

    // View state
    QString currentView() const { return m_currentView; }
    void setCurrentView(const QString& view);

    QString currentFolderPath() const { return m_currentFolderPath; }
    void setCurrentFolderPath(const QString& path);

    qint64 currentTagId() const { return m_currentTagId; }
    void setCurrentTagId(qint64 tagId);

    qint64 currentAlbumId() const { return m_currentAlbumId; }
    void setCurrentAlbumId(qint64 albumId);

    // Indexing state
    bool indexing() const { return m_indexing; }
    double indexProgress() const { return m_indexProgress; }
    QString indexCurrentFile() const { return m_indexCurrentFile; }

    // Selection methods
    Q_INVOKABLE void selectPhoto(qint64 id, bool append = false);
    Q_INVOKABLE void toggleSelection(qint64 id);
    Q_INVOKABLE void selectRange(qint64 fromId, qint64 toId);
    Q_INVOKABLE void selectAll();
    Q_INVOKABLE void clearSelection();
    Q_INVOKABLE bool isSelected(qint64 id) const;

    // Batch operations
    Q_INVOKABLE void setFavorite(bool favorite);
    Q_INVOKABLE void setRating(int rating);
    Q_INVOKABLE void deleteSelected();
    Q_INVOKABLE void restoreSelected();
    Q_INVOKABLE void permanentlyDeleteSelected();

    // Tag operations
    Q_INVOKABLE void addTagToSelected(qint64 tagId);
    Q_INVOKABLE void removeTagFromSelected(qint64 tagId);

    // Album operations
    Q_INVOKABLE void addSelectedToAlbum(qint64 albumId);
    Q_INVOKABLE void removeSelectedFromAlbum(qint64 albumId);

    // Indexing
    Q_INVOKABLE void startIndexing(const QString& path);
    Q_INVOKABLE void cancelIndexing();

signals:
    void selectionChanged();
    void searchQueryChanged();
    void searchFiltersChanged();
    void currentViewChanged();
    void currentFolderPathChanged();
    void currentTagIdChanged();
    void currentAlbumIdChanged();
    void indexingChanged();
    void indexProgressChanged();
    void indexCurrentFileChanged();

private slots:
    void onIndexProgress(int processed, int total, const QString& currentFile);
    void onIndexFinished(int indexed, int skipped, int failed);
    void onIndexCancelled();

private:
    void setIndexing(bool indexing);
    void updateActiveModel();

    PhotoModel* m_photoModel = nullptr;
    PhotoModel* m_favoritesModel = nullptr;
    PhotoModel* m_trashModel = nullptr;

    QSet<qint64> m_selectedIds;
    QString m_searchQuery;
    QJsonObject m_searchFilters;

    QString m_currentView = QStringLiteral("all");
    QString m_currentFolderPath;
    qint64 m_currentTagId = 0;
    qint64 m_currentAlbumId = 0;

    bool m_indexing = false;
    double m_indexProgress = 0.0;
    QString m_indexCurrentFile;
    quint64 m_currentIndexJobId = 0;

    static PhotoStore* s_instance;
};

#endif // PHOTOSTORE_H
