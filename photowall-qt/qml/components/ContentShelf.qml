import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Item {
    id: root
    implicitHeight: 220
    implicitWidth: parent.width

    property string title: "Content Shelf"
    property string icon: "grid_view"
    property var photos: []
    
    signal photoClicked(var photo)

    ColumnLayout {
        anchors.fill: parent
        spacing: 16

        // Header
        RowLayout {
            spacing: 8
            Layout.leftMargin: 4
            Layout.fillWidth: true

            Icon {
                name: root.icon
                size: 20
                color: Theme.Theme.primary
                filled: true
            }

            Text {
                text: root.title
                font.pixelSize: Theme.Theme.fontSizeLg
                font.weight: Font.DemiBold
                font.family: Theme.Theme.fontSerif
                color: Theme.Theme.textPrimary
            }

            Item { Layout.fillWidth: true }

            Text {
                text: root.photos.length + " 张"
                font.pixelSize: Theme.Theme.fontSizeSm
                color: Theme.Theme.textSecondary
            }
        }

        // Horizontal List
        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: 160
            orientation: ListView.Horizontal
            spacing: 12
            clip: true
            
            // Mock data if empty
            model: root.photos.length > 0 ? root.photos : 1

            delegate: Rectangle {
                width: 160
                height: 160
                radius: Theme.Theme.radiusLarge
                color: Theme.Theme.surface
                border.color: Theme.Theme.border
                border.width: 1
                clip: true

                // In real app, use Image with source
                Rectangle {
                    anchors.fill: parent
                    anchors.margins: 1
                    radius: 7
                    color: Theme.Theme.element
                    
                    Icon {
                        anchors.centerIn: parent
                        name: "photo_library"
                        size: 32
                        color: Theme.Theme.textTertiary
                        opacity: 0.3
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    hoverEnabled: true
                    onEntered: parent.scale = 1.02
                    onExited: parent.scale = 1.0
                    onClicked: root.photoClicked(modelData)
                }

                Behavior on scale { NumberAnimation { duration: 150 } }
            }
        }
    }
}
