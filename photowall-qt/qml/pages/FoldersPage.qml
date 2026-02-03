import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import PhotoWall 1.0
import "../theme" as Theme
import "../components"

Rectangle {
    id: root
    color: Theme.Theme.background

    property var store: PhotoStore
    property int totalFolders: 0
    property int totalPhotos: store ? store.photoModel.totalCount : 0

    // Selected folder state
    property string selectedFolderPath: ""
    property string selectedFolderName: ""
    property bool includeSubfolders: false
    property var selectedIds: new Set()

    signal photoDoubleClicked(var photo)

    // Selection helpers
    function toggleSelection(photoId) {
        var newSet = new Set(selectedIds)
        if (newSet.has(photoId)) {
            newSet.delete(photoId)
        } else {
            newSet.add(photoId)
        }
        selectedIds = newSet
    }

    function clearSelection() {
        selectedIds = new Set()
    }

    function selectFolder(folder) {
        selectedFolderPath = folder.path
        selectedFolderName = folder.name
        clearSelection()
        if (store) {
            store.currentFolderPath = folder.path
            var filters = store.searchFilters
            filters.includeSubfolders = includeSubfolders
            store.searchFilters = filters
        }
    }

    function updateFolderCount() {
        totalFolders = folderTreeModel.rowCount()
    }

    onIncludeSubfoldersChanged: {
        if (store && selectedFolderPath !== "") {
            var filters = store.searchFilters
            filters.includeSubfolders = includeSubfolders
            store.searchFilters = filters
        }
    }

    FolderTreeModel {
        id: folderTreeModel
    }

    Connections {
        target: folderTreeModel
        function onModelReset() { updateFolderCount() }
        function onRowsInserted() { updateFolderCount() }
        function onRowsRemoved() { updateFolderCount() }
    }

    Component.onCompleted: {
        folderTreeModel.refresh()
        updateFolderCount()
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: Theme.Theme.spacingLg
        spacing: Theme.Theme.spacingLg

        // Left panel - Folder tree
        Rectangle {
            Layout.preferredWidth: 300
            Layout.fillHeight: true
            color: Theme.Theme.surface
            radius: Theme.Theme.radiusXLarge
            border.width: 1
            border.color: Theme.Theme.border
            clip: true

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Header
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 72
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 4

                        Text {
                            text: "文件夹"
                            font.pixelSize: Theme.Theme.fontSizeLg
                            font.weight: Font.DemiBold
                            font.family: Theme.Theme.fontSerif
                            color: Theme.Theme.textPrimary
                        }
                        Text {
                            text: totalFolders + " 个文件夹，" + totalPhotos + " 张照片"
                            font.pixelSize: Theme.Theme.fontSizeXs
                            color: Theme.Theme.textSecondary
                        }
                    }
                }

                // Folder list
                TreeView {
                    id: folderTree
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    Layout.margins: Theme.Theme.spacingSm
                    clip: true
                    model: folderTreeModel

                    delegate: TreeViewDelegate {
                        id: folderDelegate
                        required property int row
                        required property var model

                        background: Rectangle {
                            radius: Theme.Theme.radiusMedium
                            color: root.selectedFolderPath === model.path
                                   ? Theme.Theme.primary
                                   : "transparent"
                            border.width: root.selectedFolderPath === model.path ? 0 : 0
                        }

                        indicator: Item {
                            implicitWidth: 16
                            implicitHeight: 16
                            visible: folderDelegate.hasChildren

                            Icon {
                                anchors.centerIn: parent
                                name: "chevron_right"
                                size: 12
                                color: root.selectedFolderPath === model.path ? "white" : Theme.Theme.textSecondary
                                rotation: folderDelegate.expanded ? 90 : 0
                            }

                            MouseArea {
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: folderDelegate.treeView.toggleExpanded(folderDelegate.row)
                            }
                        }

                        contentItem: RowLayout {
                            spacing: 8

                            Icon {
                                name: folderDelegate.expanded ? "folder_open" : "folder"
                                size: 16
                                color: root.selectedFolderPath === model.path ? "white" : Theme.Theme.primary
                                filled: true
                            }

                            Text {
                                text: model.name
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: root.selectedFolderPath === model.path ? Font.Medium : Font.Normal
                                color: root.selectedFolderPath === model.path ? "white" : Theme.Theme.textSecondary
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }

                            Rectangle {
                                width: badgeText.implicitWidth + 12
                                height: 20
                                radius: 10
                                color: root.selectedFolderPath === model.path ? Qt.rgba(1, 1, 1, 0.2) : Theme.Theme.element
                                border.width: root.selectedFolderPath === model.path ? 0 : 1
                                border.color: Theme.Theme.border
                                visible: model.photoCount > 0

                                Text {
                                    id: badgeText
                                    anchors.centerIn: parent
                                    text: model.photoCount
                                    font.pixelSize: 10
                                    font.weight: Font.Bold
                                    color: root.selectedFolderPath === model.path ? "white" : Theme.Theme.textSecondary
                                }
                            }
                        }

                        onClicked: root.selectFolder(model)
                    }
                }
            }
        }

        // Right panel - Photo grid
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.Theme.surface
            radius: Theme.Theme.radiusXLarge
            border.width: 1
            border.color: Theme.Theme.border
            clip: true

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Header with breadcrumb
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: selectedFolderPath ? 88 : 0
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border
                    visible: selectedFolderPath !== ""

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 8

                        // Breadcrumb
                        RowLayout {
                            spacing: 8

                            Text {
                                text: "文件夹"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.Medium
                                color: Theme.Theme.textSecondary
                            }

                            Repeater {
                                model: selectedFolderPath.split(/[\\\/]/).filter(s => s.length > 0)
                                delegate: RowLayout {
                                    spacing: 8

                                    Text {
                                        text: "/"
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        color: Theme.Theme.textTertiary
                                    }
                                    Text {
                                        text: modelData
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        font.weight: index === selectedFolderPath.split(/[\\\/]/).filter(s => s.length > 0).length - 1 ? Font.Bold : Font.Medium
                                        color: index === selectedFolderPath.split(/[\\\/]/).filter(s => s.length > 0).length - 1 ? Theme.Theme.textPrimary : Theme.Theme.textSecondary
                                    }
                                }
                            }
                        }

                        // Folder name and options
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 16

                            Text {
                                text: selectedFolderName
                                font.pixelSize: 22
                                font.weight: Font.Bold
                                font.family: Theme.Theme.fontSerif
                                color: Theme.Theme.textPrimary
                            }

                            Rectangle {
                                width: countLabel.width + 16
                                height: 22
                                radius: 11
                                color: Theme.Theme.background
                                border.width: 1
                                border.color: Theme.Theme.border
                                visible: store && store.photoModel.totalCount > 0

                                Text {
                                    id: countLabel
                                    anchors.centerIn: parent
                                    text: store ? store.photoModel.totalCount + " 张照片" : "0 张照片"
                                    font.pixelSize: Theme.Theme.fontSizeXs
                                    color: Theme.Theme.textSecondary
                                }
                            }

                            Item { Layout.fillWidth: true }

                            // Include subfolders toggle
                            RowLayout {
                                spacing: 8

                                Rectangle {
                                    width: 16
                                    height: 16
                                    radius: 4
                                    color: includeSubfolders ? Theme.Theme.primary : Theme.Theme.background
                                    border.width: 1
                                    border.color: includeSubfolders ? Theme.Theme.primary : Theme.Theme.border

                                    Icon {
                                        anchors.centerIn: parent
                                        name: "check"
                                        size: 12
                                        color: "white"
                                        visible: includeSubfolders
                                    }

                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: includeSubfolders = !includeSubfolders
                                    }
                                }

                                Text {
                                    text: "包含子文件夹"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: Theme.Theme.textSecondary

                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: includeSubfolders = !includeSubfolders
                                    }
                                }
                            }
                        }
                    }
                }

                // Content area
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: Theme.Theme.background

                    // No folder selected state
                    Column {
                        anchors.centerIn: parent
                        spacing: Theme.Theme.spacingLg
                        visible: selectedFolderPath === ""

                        Rectangle {
                            width: 96
                            height: 96
                            radius: Theme.Theme.radiusXXLarge
                            color: Theme.Theme.element
                            anchors.horizontalCenter: parent.horizontalCenter

                            Icon {
                                anchors.centerIn: parent
                                name: "folder_open"
                                size: 48
                                color: Theme.Theme.textSecondary
                                opacity: 0.5
                            }
                        }

                        Text {
                            text: "从左侧面板选择一个文件夹"
                            font.pixelSize: Theme.Theme.fontSizeLg
                            font.weight: Font.Medium
                            color: Theme.Theme.textSecondary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Loading state
                    Column {
                        anchors.centerIn: parent
                        spacing: 12
                        visible: store && store.photoModel.loading && selectedFolderPath !== ""

                        BusyIndicator {
                            width: 32
                            height: 32
                            running: store && store.photoModel.loading
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                        Text {
                            text: "加载中..."
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textTertiary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Empty folder state
                    Column {
                        anchors.centerIn: parent
                        spacing: Theme.Theme.spacingMd
                        visible: store && !store.photoModel.loading && selectedFolderPath !== "" && store.photoModel.count === 0

                        Rectangle {
                            width: 80
                            height: 80
                            radius: 20
                            color: Theme.Theme.element
                            anchors.horizontalCenter: parent.horizontalCenter

                            Icon {
                                anchors.centerIn: parent
                                name: "photo_library"
                                size: 36
                                color: Theme.Theme.textSecondary
                                opacity: 0.5
                            }
                        }

                        Text {
                            text: "此文件夹中没有照片"
                            font.pixelSize: Theme.Theme.fontSizeLg
                            font.weight: Font.Medium
                            color: Theme.Theme.textPrimary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Text {
                            text: includeSubfolders
                                  ? "尝试取消\"包含子文件夹\"选项"
                                  : "尝试勾选\"包含子文件夹\"选项"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Photo grid
                    PhotoGrid {
                        id: photoGrid
                        anchors.fill: parent
                        visible: store && !store.photoModel.loading && selectedFolderPath !== "" && store.photoModel.count > 0
                        model: store ? store.photoModel : null
                        selectedIds: root.selectedIds
                        thumbnailSize: 180
                        gap: 12
                        groupByDate: false

                        onPhotoClicked: function(photoId, mouse) {
                            if (mouse.modifiers & Qt.ControlModifier) {
                                root.toggleSelection(photoId)
                            } else if (mouse.modifiers & Qt.ShiftModifier) {
                                root.toggleSelection(photoId)
                            } else {
                                root.clearSelection()
                                root.toggleSelection(photoId)
                            }
                        }

                        onPhotoDoubleClicked: function(photoId) {
                            if (store) {
                                root.photoDoubleClicked(store.photoModel.getPhotoById(photoId))
                            }
                        }

                        onLoadMoreRequested: {
                            if (store) {
                                store.photoModel.loadMore()
                            }
                        }
                    }
                }

                // Selection toolbar
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: selectedIds.size > 0 ? 64 : 0
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border
                    visible: selectedIds.size > 0

                    Behavior on Layout.preferredHeight {
                        NumberAnimation { duration: Theme.Theme.durationNormal }
                    }

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 24
                        anchors.rightMargin: 24
                        spacing: Theme.Theme.spacingMd

                        Text {
                            text: "已选择 " + selectedIds.size + " 张照片"
                            font.pixelSize: Theme.Theme.fontSizeMd
                            font.weight: Font.Medium
                            color: Theme.Theme.textPrimary
                        }

                        Item { Layout.fillWidth: true }

                        Button {
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.hover : Theme.Theme.element
                                border.width: 1
                                border.color: Theme.Theme.border
                            }
                            contentItem: RowLayout {
                                spacing: 6
                                anchors.centerIn: parent
                                Icon { name: "label"; size: 14; color: Theme.Theme.textPrimary; filled: true }
                                Text {
                                    text: "标签"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: Theme.Theme.textPrimary
                                }
                            }
                        }

                        Rectangle {
                            width: 1
                            height: 24
                            color: Theme.Theme.border
                        }

                        Button {
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.hover : Theme.Theme.element
                                border.width: 1
                                border.color: Theme.Theme.border
                            }
                            contentItem: RowLayout {
                                spacing: 6
                                anchors.centerIn: parent
                                Icon { name: "favorite"; size: 14; color: Theme.Theme.textPrimary; filled: true }
                                Text {
                                    text: "收藏"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: Theme.Theme.textPrimary
                                }
                            }
                        }

                        Rectangle {
                            width: 1
                            height: 24
                            color: Theme.Theme.border
                        }

                        Button {
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.dangerHover : Theme.Theme.danger
                            }
                            contentItem: RowLayout {
                                spacing: 6
                                anchors.centerIn: parent
                                Icon { name: "delete"; size: 14; color: "#ffffff"; filled: true }
                                Text {
                                    text: "删除"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: "#ffffff"
                                }
                            }
                        }

                        Button {
                            Layout.preferredWidth: 36
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: 18
                                color: parent.pressed ? Theme.Theme.hover : "transparent"
                            }
                            contentItem: Icon {
                                anchors.centerIn: parent
                                name: "close"
                                size: 16
                                color: Theme.Theme.textSecondary
                            }
                            onClicked: clearSelection()
                        }
                    }
                }
            }
        }
    }

}
