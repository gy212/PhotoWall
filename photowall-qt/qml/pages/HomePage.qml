import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt5Compat.GraphicalEffects
import "../theme" as Theme
import "../components"

Rectangle {
    id: root
    color: Theme.Theme.background

    // Mock data for photos
    property var photos: []
    property int totalCount: 0
    property bool loading: false
    property var selectedIds: new Set()
    
    // ... (Keep existing properties and signals)
    property int thumbnailSize: 180
    property string sortField: "dateTaken"
    property string sortOrder: "desc"
    property bool groupByDate: true
    property string searchQuery: ""
    property bool hasActiveFilters: searchQuery.length > 0
    property bool isActionLoading: false

    signal photoDoubleClicked(var photo)
    signal loadMore()

    // ... (Keep existing functions: isSelected, toggleSelection, clearSelection, selectAll, getFilterTitle)
    function isSelected(photoId) { return selectedIds.has(photoId) }
    function toggleSelection(photoId) {
        var newSet = new Set(selectedIds);
        if (newSet.has(photoId)) newSet.delete(photoId);
        else newSet.add(photoId);
        selectedIds = newSet;
    }
    function clearSelection() { selectedIds = new Set() }
    function selectAll() {
        var newSet = new Set();
        for (var i = 0; i < photos.length; i++) newSet.add(photos[i].photoId);
        selectedIds = newSet;
    }
    function getFilterTitle() {
        if (!hasActiveFilters) return "全部照片"
        return "搜索: \"" + searchQuery + "\""
    }

    ScrollView {
        id: scrollView
        anchors.fill: parent
        contentWidth: availableWidth
        clip: true
        ScrollBar.vertical: ThemedScrollBar {}

        Item {
            width: scrollView.availableWidth
            height: contentColumn.implicitHeight + 48

            ColumnLayout {
                id: contentColumn
                anchors.top: parent.top
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.leftMargin: 24
                anchors.rightMargin: 24
                anchors.topMargin: 24
                spacing: 24

                HeroSection {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 300
                    onPhotoClicked: function(photo) { console.log("Hero clicked", photo) }
                }

                TagRibbon {
                    Layout.fillWidth: true
                    onFilterSelected: function(id) { console.log("Filter:", id) }
                }

                ContentShelf {
                    Layout.fillWidth: true
                    title: "最近添加"
                    icon: "schedule"
                    onPhotoClicked: function(photo) { console.log("Recent clicked", photo) }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 12

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8

                        Icon {
                            name: root.hasActiveFilters ? "search" : "grid_view"
                            size: 18
                            color: Theme.Theme.primary
                            filled: true
                        }
                        Text {
                            text: root.getFilterTitle()
                            font.pixelSize: Theme.Theme.fontSizeMd
                            font.weight: Font.DemiBold
                            color: Theme.Theme.primary
                        }

                        Item { Layout.fillWidth: true }

                        Text {
                            text: root.totalCount + " 张"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        radius: Theme.Theme.radiusXLarge
                        color: Theme.Theme.surface
                        border.width: 1
                        border.color: Theme.Theme.border
                        clip: true
                        implicitHeight: Math.max(280, photoGrid.implicitHeight)
                        Layout.preferredHeight: implicitHeight

                        GridBackground {
                            anchors.fill: parent
                        }

                        PhotoGrid {
                            id: photoGrid
                            anchors.fill: parent
                            embedded: true
                            photos: root.photos
                            selectedIds: root.selectedIds
                            thumbnailSize: root.thumbnailSize
                            gap: 12
                            groupByDate: true

                            onPhotoClicked: function(photoId, mouse) {
                                if (mouse.modifiers & Qt.ControlModifier) {
                                    root.toggleSelection(photoId)
                                } else {
                                    root.clearSelection()
                                    root.toggleSelection(photoId)
                                }
                            }

                            onPhotoDoubleClicked: function(photoId) {
                                // root.photoDoubleClicked(photo)
                            }
                        }
                    }
                }
            }
        }
    }

    // ... (Keep Floating Selection Toolbar)
    Rectangle {
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 32
        anchors.horizontalCenter: parent.horizontalCenter
        width: selectionToolbarRow.width + 32
        height: 56
        radius: 28
        color: Theme.Theme.surface
        border.width: 1
        border.color: Theme.Theme.border
        visible: selectedIds.size > 0
        opacity: selectedIds.size > 0 ? 1 : 0

        Behavior on opacity { NumberAnimation { duration: 200 } }
        
        layer.enabled: true
        layer.effect: DropShadow {
            transparentBorder: true
            horizontalOffset: 0
            verticalOffset: 4
            radius: 12
            samples: 17
            color: Qt.rgba(0,0,0,0.2)
        }

        RowLayout {
            id: selectionToolbarRow
            anchors.centerIn: parent
            spacing: 16

            Text {
                text: "已选择 " + selectedIds.size + " 张"
                font.pixelSize: 14
                font.weight: Font.Medium
                color: Theme.Theme.textPrimary
            }

            Rectangle { width: 1; height: 24; color: Theme.Theme.border }

            // Actions
            RowLayout {
                spacing: 4
                Repeater {
                    model: [
                        { icon: "label", label: "标签", color: Theme.Theme.textPrimary },
                        { icon: "favorite", label: "收藏", color: Theme.Theme.textPrimary },
                        { icon: "delete", label: "删除", color: Theme.Theme.danger }
                    ]
                    delegate: Button {
                        Layout.preferredHeight: 36
                        background: Rectangle { color: "transparent" }
                        contentItem: RowLayout {
                            spacing: 4
                            Icon { name: modelData.icon; size: 18; color: modelData.color; filled: true }
                            Text { text: modelData.label; font.pixelSize: 13; color: modelData.color }
                        }
                    }
                }
            }
            
            Rectangle { width: 1; height: 24; color: Theme.Theme.border }
            
            Button {
                background: Rectangle { color: "transparent" }
                contentItem: Icon { name: "close"; size: 16; color: Theme.Theme.textSecondary }
                onClicked: root.clearSelection()
            }
        }
    }
}

