import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Item {
    id: root
    implicitHeight: 80
    implicitWidth: parent.width

    signal filterSelected(string filterId)

    property string activeFilter: "all"

    ColumnLayout {
        anchors.fill: parent
        spacing: 12

        Text {
            text: "快速筛选"
            font.pixelSize: Theme.Theme.fontSizeXs
            font.weight: Font.Medium
            color: Theme.Theme.textSecondary
            Layout.leftMargin: 4
        }

        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            orientation: ListView.Horizontal
            spacing: 12
            clip: true

            model: [
                { id: "all", label: "全部", icon: "grid_view" },
                { id: "fav", label: "收藏", icon: "favorite" },
                { id: "2025", label: "2025年", icon: "calendar" },
                { id: "raw", label: "RAW", icon: "camera" }
                // Add tag items dynamically in real app
            ]

            delegate: Rectangle {
                id: pill
                width: row.implicitWidth + 28
                height: 32
                radius: 10
                
                property bool isActive: root.activeFilter === modelData.id
                
                color: isActive ? Theme.Theme.primary : Theme.Theme.surface
                border.width: isActive ? 0 : 1
                border.color: Theme.Theme.border

                Behavior on color { ColorAnimation { duration: 150 } }

                RowLayout {
                    id: row
                    anchors.centerIn: parent
                    spacing: 6

                    Icon {
                        name: modelData.icon
                        size: 18
                        color: pill.isActive ? "white" : Theme.Theme.textSecondary
                        filled: true
                    }

                    Text {
                        text: modelData.label
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: pill.isActive ? "white" : Theme.Theme.textSecondary
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        root.activeFilter = modelData.id
                        root.filterSelected(modelData.id)
                    }
                }
            }
        }
    }
}
