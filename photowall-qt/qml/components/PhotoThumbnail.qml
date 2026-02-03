import QtQuick
import QtQuick.Layouts
import "../theme" as Theme

Rectangle {
    id: root

    // Required properties
    property int photoId: 0
    property string fileHash: ""
    property string filePath: ""

    // State properties
    property bool selected: false
    property bool isFavorite: false
    property int rating: 0

    // Display info
    property string fileName: ""
    property string dateTaken: ""
    property int fileSize: 0

    // Layout
    property string aspectCategory: "normal"  // "normal", "wide", "tall"

    // Signals
    signal clicked(int photoId, var mouse)
    signal doubleClicked(int photoId)
    signal rightClicked(int photoId, point pos)
    signal selectToggled(int photoId, bool selected)

    // Appearance
    color: Theme.Theme.surface
    radius: Theme.Theme.radiusLarge
    border.color: root.selected ? Theme.Theme.primary : Theme.Theme.border
    border.width: root.selected ? 2 : 1
    clip: true

    Behavior on border.color {
        ColorAnimation { duration: Theme.Theme.durationNormal }
    }

    // Selection ring effect
    Rectangle {
        anchors.fill: parent
        anchors.margins: -2
        radius: root.radius + 2
        color: "transparent"
        border.color: root.selected ? Theme.Theme.primary : "transparent"
        border.width: 2
        visible: root.selected
        z: -1
    }

    // Tiny blur placeholder (progressive loading stage 1)
    Image {
        id: tinyImage
        anchors.fill: parent
        anchors.margins: 1
        source: root.fileHash ? "image://thumbnail/" + root.fileHash
                                + (root.filePath ? "|" + encodeURIComponent(root.filePath) : "")
                                + "/tiny" : ""
        fillMode: root.aspectCategory === "normal" ? Image.PreserveAspectCrop : Image.PreserveAspectFit
        asynchronous: true
        visible: status === Image.Ready && !fullImage.ready
        opacity: visible ? 1 : 0

        // Blur effect simulation with scale
        transform: Scale {
            origin.x: tinyImage.width / 2
            origin.y: tinyImage.height / 2
            xScale: 1.05
            yScale: 1.05
        }

        Behavior on opacity {
            NumberAnimation { duration: 500 }
        }
    }

    // Full thumbnail image
    Image {
        id: fullImage
        anchors.fill: parent
        anchors.margins: 1
        source: root.fileHash ? "image://thumbnail/" + root.fileHash
                                + (root.filePath ? "|" + encodeURIComponent(root.filePath) : "")
                                + "/small" : ""
        fillMode: root.aspectCategory === "normal" ? Image.PreserveAspectCrop : Image.PreserveAspectFit
        asynchronous: true
        cache: true

        property bool ready: status === Image.Ready

        opacity: ready ? 1 : 0

        Behavior on opacity {
            NumberAnimation { duration: 500 }
        }
    }

    // Loading placeholder
    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        color: Theme.Theme.element
        visible: !fullImage.ready && tinyImage.status !== Image.Ready

        // Pulse animation
        SequentialAnimation on opacity {
            running: !fullImage.ready && tinyImage.status !== Image.Ready
            loops: Animation.Infinite
            NumberAnimation { from: 1; to: 0.5; duration: 800 }
            NumberAnimation { from: 0.5; to: 1; duration: 800 }
        }
    }

    // Error state
    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        color: Theme.Theme.element
        visible: fullImage.status === Image.Error

        Column {
            anchors.centerIn: parent
            spacing: 4

            Icon {
                anchors.horizontalCenter: parent.horizontalCenter
                name: "broken_image"
                size: 32
                color: Theme.Theme.textTertiary
                opacity: 0.5
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "无法加载"
                font.pixelSize: Theme.Theme.fontSizeXs
                font.weight: Font.Medium
                color: Theme.Theme.textTertiary
                opacity: 0.7
            }
        }
    }

    // Selection overlay
    Rectangle {
        anchors.fill: parent
        color: root.selected ? Qt.rgba(99/255, 102/255, 241/255, 0.05) : "transparent"

        Behavior on color {
            ColorAnimation { duration: Theme.Theme.durationNormal }
        }
    }

    // Selection checkbox (top-left)
    Rectangle {
        id: checkbox
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.margins: 8
        width: 20
        height: 20
        radius: 10
        color: root.selected ? Theme.Theme.primary : Qt.rgba(255, 255, 255, 0.9)
        border.color: root.selected ? Theme.Theme.primary : Theme.Theme.border
        border.width: 1
        z: 10

        opacity: root.selected || mouseArea.containsMouse ? 1 : 0
        scale: root.selected || mouseArea.containsMouse ? 1 : 0.9

        Behavior on opacity {
            NumberAnimation { duration: Theme.Theme.durationNormal }
        }
        Behavior on scale {
            NumberAnimation { duration: Theme.Theme.durationNormal }
        }

        Icon {
            anchors.centerIn: parent
            name: "check"
            size: 14
            color: root.selected ? "white" : Qt.rgba(99/255, 102/255, 241/255, 0.3)
            visible: root.selected || checkboxMouseArea.containsMouse
            filled: true
        }

        MouseArea {
            id: checkboxMouseArea
            anchors.fill: parent
            anchors.margins: -4
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: function(mouse) {
                mouse.accepted = true
                root.selectToggled(root.photoId, !root.selected)
            }
        }
    }

    // Favorite badge (top-right)
    Rectangle {
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: 8
        width: 24
        height: 24
        radius: 12
        color: Qt.rgba(255, 255, 255, 0.1)
        visible: root.isFavorite
        z: 10

        Icon {
            anchors.centerIn: parent
            name: "favorite"
            size: 14
            color: "white"
            filled: true
        }
    }

    // Bottom info panel (on hover)
    Rectangle {
        id: infoPanel
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 56
        z: 10

        opacity: mouseArea.containsMouse ? 1 : 0

        Behavior on opacity {
            NumberAnimation { duration: Theme.Theme.durationNormal }
        }

        // Gradient background
        gradient: Gradient {
            GradientStop { position: 0.0; color: "transparent" }
            GradientStop { position: 0.3; color: Qt.rgba(0, 0, 0, 0.4) }
            GradientStop { position: 1.0; color: Qt.rgba(0, 0, 0, 0.8) }
        }

        Column {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 12
            spacing: 2

            // File name
            Text {
                width: parent.width
                text: root.fileName
                font.pixelSize: Theme.Theme.fontSizeXs
                font.weight: Font.Medium
                color: "white"
                elide: Text.ElideRight
            }

            // Metadata row
            Text {
                width: parent.width
                text: formatMetadata()
                font.pixelSize: Theme.Theme.fontSizeXs
                color: Qt.rgba(255, 255, 255, 0.7)
                elide: Text.ElideRight
            }
        }
    }

    // Mouse interaction
    MouseArea {
        id: mouseArea
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.LeftButton | Qt.RightButton
        cursorShape: Qt.PointingHandCursor

        onClicked: function(mouse) {
            if (mouse.button === Qt.RightButton) {
                root.rightClicked(root.photoId, Qt.point(mouse.x, mouse.y))
            } else {
                root.clicked(root.photoId, mouse)
            }
        }

        onDoubleClicked: function(mouse) {
            if (mouse.button === Qt.LeftButton) {
                root.doubleClicked(root.photoId)
            }
        }
    }

    // Hover border effect
    Rectangle {
        anchors.fill: parent
        radius: root.radius
        color: "transparent"
        border.color: !root.selected && mouseArea.containsMouse
                      ? Qt.rgba(99/255, 102/255, 241/255, 0.5)
                      : "transparent"
        border.width: 1

        Behavior on border.color {
            ColorAnimation { duration: Theme.Theme.durationNormal }
        }
    }

    // Helper function to format metadata
    function formatMetadata() {
        let parts = []

        // Date
        if (root.dateTaken) {
            let date = new Date(root.dateTaken)
            parts.push(date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }))
        }

        // File size
        if (root.fileSize > 0) {
            if (root.fileSize < 1024 * 1024) {
                parts.push(Math.round(root.fileSize / 1024) + " KB")
            } else {
                parts.push((root.fileSize / 1024 / 1024).toFixed(1) + " MB")
            }
        }

        return parts.join(" · ")
    }
}
