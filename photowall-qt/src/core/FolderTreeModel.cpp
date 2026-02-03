#include "FolderTreeModel.h"
#include "RustBridge.h"
#include "utils/JsonHelper.h"

FolderTreeModel::FolderTreeModel(QObject* parent)
    : QAbstractItemModel(parent)
{
    // Create virtual root node
    m_rootNode = std::make_unique<TreeNode>();
    m_rootNode->name = QStringLiteral("Root");
    m_rootNode->hasChildren = true;
}

FolderTreeModel::~FolderTreeModel() = default;

// ============================================================================
// QAbstractItemModel Interface
// ============================================================================

QModelIndex FolderTreeModel::index(int row, int column, const QModelIndex& parent) const
{
    if (!hasIndex(row, column, parent)) {
        return QModelIndex();
    }

    TreeNode* parentNode = parent.isValid() ? nodeFromIndex(parent) : m_rootNode.get();
    if (!parentNode || row >= static_cast<int>(parentNode->children.size())) {
        return QModelIndex();
    }

    return createIndex(row, column, parentNode->children[static_cast<size_t>(row)].get());
}

QModelIndex FolderTreeModel::parent(const QModelIndex& child) const
{
    if (!child.isValid()) {
        return QModelIndex();
    }

    TreeNode* node = nodeFromIndex(child);
    if (!node || !node->parent || node->parent == m_rootNode.get()) {
        return QModelIndex();
    }

    return indexFromNode(node->parent);
}

int FolderTreeModel::rowCount(const QModelIndex& parent) const
{
    TreeNode* node = parent.isValid() ? nodeFromIndex(parent) : m_rootNode.get();
    return node ? static_cast<int>(node->children.size()) : 0;
}

int FolderTreeModel::columnCount(const QModelIndex& parent) const
{
    Q_UNUSED(parent)
    return 1;
}

QVariant FolderTreeModel::data(const QModelIndex& index, int role) const
{
    if (!index.isValid()) {
        return QVariant();
    }

    TreeNode* node = nodeFromIndex(index);
    if (!node) {
        return QVariant();
    }

    switch (role) {
    case Qt::DisplayRole:
    case NameRole:
        return node->name;
    case PathRole:
        return node->path;
    case PhotoCountRole:
        return node->photoCount;
    case HasChildrenRole:
        return node->hasChildren;
    case ExpandedRole:
        return node->expanded;
    case DepthRole:
        return node->depth;
    default:
        return QVariant();
    }
}

QHash<int, QByteArray> FolderTreeModel::roleNames() const
{
    return {
        {PathRole, "path"},
        {NameRole, "name"},
        {PhotoCountRole, "photoCount"},
        {HasChildrenRole, "hasChildren"},
        {ExpandedRole, "expanded"},
        {DepthRole, "depth"}
    };
}

bool FolderTreeModel::hasChildren(const QModelIndex& parent) const
{
    TreeNode* node = parent.isValid() ? nodeFromIndex(parent) : m_rootNode.get();
    return node && node->hasChildren;
}

bool FolderTreeModel::canFetchMore(const QModelIndex& parent) const
{
    TreeNode* node = parent.isValid() ? nodeFromIndex(parent) : m_rootNode.get();
    return node && node->hasChildren && !node->childrenLoaded;
}

void FolderTreeModel::fetchMore(const QModelIndex& parent)
{
    TreeNode* node = parent.isValid() ? nodeFromIndex(parent) : m_rootNode.get();
    if (!node || node->childrenLoaded) {
        return;
    }

    loadChildren(node);
}

// ============================================================================
// Properties
// ============================================================================

void FolderTreeModel::setSelectedPath(const QString& path)
{
    if (m_selectedPath != path) {
        m_selectedPath = path;
        emit selectedPathChanged();
        emit folderSelected(path);
    }
}

void FolderTreeModel::setLoading(bool loading)
{
    if (m_loading != loading) {
        m_loading = loading;
        emit loadingChanged();
    }
}

// ============================================================================
// Methods
// ============================================================================

void FolderTreeModel::refresh()
{
    beginResetModel();

    m_rootNode->children.clear();
    m_rootNode->childrenLoaded = false;

    endResetModel();

    // Trigger loading of root children
    loadChildren(m_rootNode.get());
}

void FolderTreeModel::expandPath(const QString& path)
{
    QModelIndex idx = indexForPath(path);
    if (!idx.isValid()) return;

    TreeNode* node = nodeFromIndex(idx);
    if (!node || node->expanded) return;

    if (!node->childrenLoaded) {
        loadChildren(node);
    }

    node->expanded = true;
    emit dataChanged(idx, idx, {ExpandedRole});
}

void FolderTreeModel::collapsePath(const QString& path)
{
    QModelIndex idx = indexForPath(path);
    if (!idx.isValid()) return;

    TreeNode* node = nodeFromIndex(idx);
    if (!node || !node->expanded) return;

    node->expanded = false;
    emit dataChanged(idx, idx, {ExpandedRole});
}

void FolderTreeModel::toggleExpanded(const QModelIndex& index)
{
    if (!index.isValid()) return;

    TreeNode* node = nodeFromIndex(index);
    if (!node) return;

    if (node->expanded) {
        node->expanded = false;
    } else {
        if (!node->childrenLoaded) {
            loadChildren(node);
        }
        node->expanded = true;
    }

    emit dataChanged(index, index, {ExpandedRole});
}

QModelIndex FolderTreeModel::indexForPath(const QString& path) const
{
    std::function<QModelIndex(TreeNode*, const QString&)> findNode;
    findNode = [this, &findNode](TreeNode* node, const QString& targetPath) -> QModelIndex {
    for (int i = 0; i < static_cast<int>(node->children.size()); ++i) {
        TreeNode* child = node->children[static_cast<size_t>(i)].get();
        if (child->path == targetPath) {
            return indexFromNode(child);
        }
            if (targetPath.startsWith(child->path)) {
                QModelIndex result = findNode(child, targetPath);
                if (result.isValid()) {
                    return result;
                }
            }
        }
        return QModelIndex();
    };

    return findNode(m_rootNode.get(), path);
}

// ============================================================================
// Private
// ============================================================================

FolderTreeModel::TreeNode* FolderTreeModel::nodeFromIndex(const QModelIndex& index) const
{
    if (!index.isValid()) {
        return nullptr;
    }
    return static_cast<TreeNode*>(index.internalPointer());
}

QModelIndex FolderTreeModel::indexFromNode(TreeNode* node) const
{
    if (!node || !node->parent) {
        return QModelIndex();
    }

    TreeNode* parent = node->parent;
    for (int i = 0; i < static_cast<int>(parent->children.size()); ++i) {
        if (parent->children[static_cast<size_t>(i)].get() == node) {
            return createIndex(i, 0, node);
        }
    }

    return QModelIndex();
}

void FolderTreeModel::loadChildren(TreeNode* node)
{
    if (!node || node->childrenLoaded) return;

    setLoading(true);

    QJsonArray children = RustBridge::instance()->getFolderChildren(node->path);

    QModelIndex parentIndex = indexFromNode(node);
    if (!parentIndex.isValid() && node != m_rootNode.get()) {
        setLoading(false);
        return;
    }

    if (!children.isEmpty()) {
        beginInsertRows(parentIndex, 0, static_cast<int>(children.size()) - 1);

        for (const QJsonValue& val : children) {
            if (val.isObject()) {
                auto childNode = TreeNode::fromJson(val.toObject(), node, node->depth + 1);
                node->children.push_back(std::move(childNode));
            }
        }

        endInsertRows();
    }

    node->childrenLoaded = true;
    setLoading(false);
}

// ============================================================================
// TreeNode
// ============================================================================

std::unique_ptr<FolderTreeModel::TreeNode> FolderTreeModel::TreeNode::fromJson(
    const QJsonObject& obj, TreeNode* parent, int depth)
{
    auto node = std::make_unique<TreeNode>();
    node->path = JsonHelper::getString(obj, QStringLiteral("path"));
    node->name = JsonHelper::getString(obj, QStringLiteral("name"));
    node->photoCount = JsonHelper::getInt(obj, QStringLiteral("photoCount"));
    node->hasChildren = JsonHelper::getBool(obj, QStringLiteral("hasChildren"));
    node->parent = parent;
    node->depth = depth;
    return node;
}
