import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Column {
    id: treeItem

    property var folder
    property int level: 0
    property string selectedPath: ""
    property var expandedPaths: new Set()

    signal folderClicked(var folder)
    signal toggleExpand(string path)

    width: parent ? parent.width : 200

    Rectangle {
        width: parent.width
        height: 40
        radius: Theme.Theme.radiusMedium
        color: selectedPath === folder.path
               ? Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.15)
               : (folderMouseArea.containsMouse ? Theme.Theme.hover : "transparent")
        border.width: selectedPath === folder.path ? 1 : 0
        border.color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.3)

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12 + level * 20
            anchors.rightMargin: 12
            spacing: 8

            // Expand/collapse button
            Rectangle {
                width: 20
                height: 20
                radius: 4
                color: expandMouseArea.containsMouse ? Theme.Theme.hover : "transparent"
                visible: folder.children && folder.children.length > 0

                Icon {
                    anchors.centerIn: parent
                    name: "chevron_right"
                    size: 12
                    color: Theme.Theme.textSecondary
                    rotation: expandedPaths.has(folder.path) ? 90 : 0
                }

                MouseArea {
                    id: expandMouseArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: treeItem.toggleExpand(folder.path)
                }
            }

            Item {
                width: 20
                visible: !folder.children || folder.children.length === 0
            }

            // Folder icon
            Icon {
                name: expandedPaths.has(folder.path) ? "folder_open" : "folder"
                size: 16
                color: Theme.Theme.primary
                filled: true
            }

            // Folder name
            Text {
                text: folder.name
                font.pixelSize: Theme.Theme.fontSizeSm
                font.weight: selectedPath === folder.path ? Font.Medium : Font.Normal
                color: selectedPath === folder.path ? Theme.Theme.primary : Theme.Theme.textSecondary
                elide: Text.ElideRight
                Layout.fillWidth: true
            }

            // Photo count badge
            Rectangle {
                width: badgeText.width + 12
                height: 20
                radius: 10
                color: selectedPath === folder.path ? Qt.rgba(1, 1, 1, 0.2) : Theme.Theme.element
                border.width: selectedPath === folder.path ? 0 : 1
                border.color: Theme.Theme.border
                visible: folder.photoCount > 0

                Text {
                    id: badgeText
                    anchors.centerIn: parent
                    text: folder.photoCount
                    font.pixelSize: 10
                    font.weight: Font.Bold
                    color: selectedPath === folder.path ? Theme.Theme.primary : Theme.Theme.textSecondary
                }
            }
        }

        MouseArea {
            id: folderMouseArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: treeItem.folderClicked(folder)
        }
    }

    // Children
    Column {
        width: parent.width
        visible: expandedPaths.has(folder.path) && folder.children && folder.children.length > 0
        spacing: 2

        Repeater {
            model: folder.children || []
            delegate: FolderTreeItem {
                width: treeItem.width
                folder: modelData
                level: treeItem.level + 1
                selectedPath: treeItem.selectedPath
                expandedPaths: treeItem.expandedPaths
                onFolderClicked: function(f) { treeItem.folderClicked(f) }
                onToggleExpand: function(path) { treeItem.toggleExpand(path) }
            }
        }
    }
}
