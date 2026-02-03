#ifndef FOLDERTREEMODEL_H
#define FOLDERTREEMODEL_H

#include <QAbstractItemModel>
#include <QJsonObject>
#include <QJsonArray>
#include <memory>
#include <vector>

/**
 * C-06: FolderTreeModel
 * QAbstractItemModel for QML TreeView.
 */
class FolderTreeModel : public QAbstractItemModel
{
    Q_OBJECT

    Q_PROPERTY(bool loading READ loading NOTIFY loadingChanged)
    Q_PROPERTY(QString selectedPath READ selectedPath WRITE setSelectedPath NOTIFY selectedPathChanged)

public:
    enum FolderRoles {
        PathRole = Qt::UserRole + 1,
        NameRole,
        PhotoCountRole,
        HasChildrenRole,
        ExpandedRole,
        DepthRole
    };
    Q_ENUM(FolderRoles)

    explicit FolderTreeModel(QObject* parent = nullptr);
    ~FolderTreeModel() override;

    // QAbstractItemModel interface
    QModelIndex index(int row, int column, const QModelIndex& parent = QModelIndex()) const override;
    QModelIndex parent(const QModelIndex& child) const override;
    int rowCount(const QModelIndex& parent = QModelIndex()) const override;
    int columnCount(const QModelIndex& parent = QModelIndex()) const override;
    QVariant data(const QModelIndex& index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;
    bool hasChildren(const QModelIndex& parent = QModelIndex()) const override;
    bool canFetchMore(const QModelIndex& parent) const override;
    void fetchMore(const QModelIndex& parent) override;

    // Properties
    bool loading() const { return m_loading; }
    QString selectedPath() const { return m_selectedPath; }
    void setSelectedPath(const QString& path);

    // Methods
    Q_INVOKABLE void refresh();
    Q_INVOKABLE void expandPath(const QString& path);
    Q_INVOKABLE void collapsePath(const QString& path);
    Q_INVOKABLE void toggleExpanded(const QModelIndex& index);
    Q_INVOKABLE QModelIndex indexForPath(const QString& path) const;

signals:
    void loadingChanged();
    void selectedPathChanged();
    void folderSelected(const QString& path);

private:
    struct TreeNode {
        QString path;
        QString name;
        int photoCount = 0;
        bool hasChildren = false;
        bool expanded = false;
        bool childrenLoaded = false;
        int depth = 0;

        TreeNode* parent = nullptr;
        std::vector<std::unique_ptr<TreeNode>> children;

        static std::unique_ptr<TreeNode> fromJson(const QJsonObject& obj, TreeNode* parent, int depth);
    };

    TreeNode* nodeFromIndex(const QModelIndex& index) const;
    QModelIndex indexFromNode(TreeNode* node) const;
    void loadChildren(TreeNode* node);
    void setLoading(bool loading);

    std::unique_ptr<TreeNode> m_rootNode;
    QString m_selectedPath;
    bool m_loading = false;
};

#endif // FOLDERTREEMODEL_H
