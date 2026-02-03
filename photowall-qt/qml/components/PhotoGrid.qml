import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Item {
    id: root
    implicitHeight: contentHeight

    // Properties
    property var model: null  // PhotoModel from C++
    property var photos: null  // Backward-compatible array model
    property int thumbnailSize: 200
    property int gap: 16
    property bool groupByDate: false
    property bool embedded: false  // Disable internal scroll when embedded

    // Selection state
    property var selectedIds: new Set()

    // Signals
    signal photoClicked(int photoId, var mouse)
    signal photoDoubleClicked(int photoId)
    signal contextMenuRequested(int photoId, point pos)
    signal loadMoreRequested()

    // Header item support
    property Component headerItem: null

    // Computed properties
    readonly property bool hasModel: root.model !== null && root.model !== undefined
    readonly property int itemCount: root.hasModel
                                    ? (root.model.count !== undefined ? root.model.count : 0)
                                    : (root.photos ? root.photos.length : 0)

    // Layout derived from available width; keeps the grid responsive while respecting `thumbnailSize`.
    readonly property int columns: Math.max(2, Math.floor((width - gap * 2) / (thumbnailSize + gap)))
    readonly property int cellWidth: Math.max(80, Math.floor((width - gap * (columns + 1)) / columns))
    readonly property int cellHeight: cellWidth
    readonly property int contentHeight: root.groupByDate
                                       ? dateGroupedView.contentHeight + root.gap * 2
                                       : gridView.contentHeight + root.gap * 2

    // Main grid view with virtual scrolling
    GridView {
        id: gridView
        anchors.fill: parent
        anchors.margins: root.gap
        visible: !root.groupByDate

        header: root.headerItem // Add this line

        model: root.hasModel ? root.model : root.photos
        cellWidth: root.cellWidth + root.gap
        cellHeight: root.cellHeight + root.gap
        clip: true
        cacheBuffer: 1500
        interactive: !root.embedded
        height: root.embedded ? contentHeight : parent.height

        // Scroll behavior
        boundsBehavior: Flickable.StopAtBounds
        flickDeceleration: 3000

        delegate: Item {
            width: gridView.cellWidth
            height: gridView.cellHeight

            readonly property var itemData: (typeof modelData !== "undefined" && modelData !== null)
                                              ? modelData
                                              : ({
                                                    photoId: photoId,
                                                    fileHash: fileHash,
                                                    filePath: filePath,
                                                    fileName: fileName,
                                                    dateTaken: dateTaken,
                                                    fileSize: fileSize,
                                                    isFavorite: isFavorite,
                                                    rating: rating
                                                })

            PhotoThumbnail {
                anchors.fill: parent
                anchors.margins: root.gap / 2

                photoId: itemData.photoId
                fileHash: itemData.fileHash
                filePath: itemData.filePath
                fileName: itemData.fileName
                dateTaken: itemData.dateTaken || ""
                fileSize: itemData.fileSize
                isFavorite: itemData.isFavorite
                rating: itemData.rating
                selected: root.selectedIds.has(itemData.photoId)

                onClicked: function(photoId, mouse) {
                    root.photoClicked(photoId, mouse)
                }
                onDoubleClicked: function(photoId) {
                    root.photoDoubleClicked(photoId)
                }
                onRightClicked: function(photoId, pos) {
                    root.contextMenuRequested(photoId, pos)
                }
                onSelectToggled: function(photoId, selected) {
                    if (selected) {
                        root.selectedIds.add(photoId)
                    } else {
                        root.selectedIds.delete(photoId)
                    }
                    root.selectedIds = new Set(root.selectedIds)  // Trigger binding update
                }
            }
        }

        // Infinite scroll: load more when near bottom
        onContentYChanged: {
            if (contentY + height > contentHeight - 500) {
                if (root.hasModel && root.model.hasMore && !root.model.loading) {
                    root.loadMoreRequested()
                }
            }
        }

        // Footer loading indicator
        footer: Item {
            width: gridView.width
            height: root.hasModel && root.model.hasMore ? 80 : 0
            visible: root.hasModel && root.model.hasMore

            Row {
                anchors.centerIn: parent
                spacing: 8
                visible: root.hasModel && root.model.loading

                BusyIndicator {
                    width: 24
                    height: 24
                    running: true
                }

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    text: "加载更多..."
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                }
            }
        }

        // Scroll bar
        ScrollBar.vertical: ThemedScrollBar {}
    }

    // Date-grouped view (ListView with sections)
    ListView {
        id: dateGroupedView
        anchors.fill: parent
        anchors.margins: root.gap
        visible: root.groupByDate

        model: root.hasModel ? root.model : root.photos
        clip: true
        cacheBuffer: 1500
        interactive: !root.embedded
        height: root.embedded ? contentHeight : parent.height

        // Section headers for date groups
        section.property: "dateGroup"
        section.criteria: ViewSection.FullString
        section.delegate: Rectangle {
            width: dateGroupedView.width
            height: 48
            color: "transparent"

            // Sticky header effect
            z: 2

            Text {
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                text: section
                font.pixelSize: Theme.Theme.fontSizeLg
                font.weight: Font.Bold
                color: Theme.Theme.textPrimary
            }

            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.Theme.border
                opacity: 0.5
            }
        }

        delegate: Item {
            width: dateGroupedView.width
            height: root.cellHeight + root.gap

            readonly property var itemData: (typeof modelData !== "undefined" && modelData !== null)
                                              ? modelData
                                              : ({
                                                    photoId: photoId,
                                                    fileHash: fileHash,
                                                    filePath: filePath,
                                                    fileName: fileName,
                                                    dateTaken: dateTaken,
                                                    fileSize: fileSize,
                                                    isFavorite: isFavorite,
                                                    rating: rating
                                                })

            PhotoThumbnail {
                width: root.cellWidth
                height: root.cellHeight
                anchors.verticalCenter: parent.verticalCenter

                photoId: itemData.photoId
                fileHash: itemData.fileHash
                filePath: itemData.filePath
                fileName: itemData.fileName
                dateTaken: itemData.dateTaken || ""
                fileSize: itemData.fileSize
                isFavorite: itemData.isFavorite
                rating: itemData.rating
                selected: root.selectedIds.has(itemData.photoId)

                onClicked: function(photoId, mouse) {
                    root.photoClicked(photoId, mouse)
                }
                onDoubleClicked: function(photoId) {
                    root.photoDoubleClicked(photoId)
                }
                onRightClicked: function(photoId, pos) {
                    root.contextMenuRequested(photoId, pos)
                }
                onSelectToggled: function(photoId, selected) {
                    if (selected) {
                        root.selectedIds.add(photoId)
                    } else {
                        root.selectedIds.delete(photoId)
                    }
                    root.selectedIds = new Set(root.selectedIds)
                }
            }
        }

        // Infinite scroll
        onContentYChanged: {
            if (contentY + height > contentHeight - 500) {
                if (root.hasModel && root.model.hasMore && !root.model.loading) {
                    root.loadMoreRequested()
                }
            }
        }

        ScrollBar.vertical: ThemedScrollBar {}
    }

    // Center loading indicator (initial load)
    BusyIndicator {
        id: loadingIndicator
        anchors.centerIn: parent
        width: 48
        height: 48
        running: root.hasModel && root.model.loading && root.itemCount === 0
        visible: running
    }

    // Helper functions
    function clearSelection() {
        root.selectedIds = new Set()
    }

    function selectAll() {
        if (root.photos && root.photos.length > 0) {
            let newSelection = new Set()
            for (let i = 0; i < root.photos.length; i++) {
                let item = root.photos[i]
                if (item && item.photoId !== undefined) {
                    newSelection.add(item.photoId)
                }
            }
            root.selectedIds = newSelection
            return
        }

        if (!root.model || typeof root.model.get !== "function") return
        let newSelection = new Set()
        for (let i = 0; i < root.model.count; i++) {
            let item = root.model.get(i)
            if (item) {
                newSelection.add(item.photoId)
            }
        }
        root.selectedIds = newSelection
    }

    function scrollToTop() {
        if (root.groupByDate) {
            dateGroupedView.positionViewAtBeginning()
        } else {
            gridView.positionViewAtBeginning()
        }
    }
}
