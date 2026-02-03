import QtQuick
import QtQuick.Layouts
import "../theme" as Theme

RowLayout {
    id: root

    // Properties
    property bool maximized: false

    // Signals
    signal minimizeClicked()
    signal maximizeClicked()
    signal closeClicked()

    spacing: 4
    
    // Left Separator to match Web
    Rectangle {
        Layout.preferredWidth: 1
        Layout.preferredHeight: 20
        Layout.leftMargin: 8
        Layout.rightMargin: 12
        color: Theme.Theme.border
        opacity: 0.5
    }

    // Minimize button
    Rectangle {
        id: minBtn
        Layout.preferredWidth: 32
        Layout.preferredHeight: 32
        radius: 6
        color: minimizeMouseArea.containsMouse ? Theme.Theme.element : "transparent"

        Icon {
            anchors.centerIn: parent
            name: "remove"
            size: 12
            color: minimizeMouseArea.containsMouse ? Theme.Theme.primary : Theme.Theme.textSecondary
        }

        MouseArea {
            id: minimizeMouseArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.minimizeClicked()
        }
    }

    // Maximize/Restore button
    Rectangle {
        id: maxBtn
        Layout.preferredWidth: 32
        Layout.preferredHeight: 32
        radius: 6
        color: maximizeMouseArea.containsMouse ? Theme.Theme.element : "transparent"

        Icon {
            anchors.centerIn: parent
            name: root.maximized ? "filter_none" : "crop_square"
            size: 12
            color: maximizeMouseArea.containsMouse ? Theme.Theme.primary : Theme.Theme.textSecondary
        }

        MouseArea {
            id: maximizeMouseArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.maximizeClicked()
        }
    }

    // Close button
    Rectangle {
        id: closeBtn
        Layout.preferredWidth: 32
        Layout.preferredHeight: 32
        radius: 6
        color: closeMouseArea.containsMouse ? Qt.rgba(239/255, 68/255, 68/255, 0.1) : "transparent"

        Icon {
            anchors.centerIn: parent
            name: "close"
            size: 12
            color: closeMouseArea.containsMouse ? "#EF4444" : Theme.Theme.textSecondary
        }

        MouseArea {
            id: closeMouseArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: root.closeClicked()
        }
    }
}
