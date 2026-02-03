import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

/**
 * PhotoViewer - Full-screen photo viewer
 *
 * Features: zoom/pan, navigation, toolbar, rating, info panel, slideshow
 */
Popup {
    id: root

    // Properties
    property var photo: null           // Current photo object
    property var photos: []            // Photo list for navigation
    property int currentIndex: 0       // Current index in photos array

    // Internal state
    property real zoomScale: 1.0
    property real posX: 0
    property real posY: 0
    property bool showInfo: false
    property bool isPlaying: false
    property bool isDragging: false
    property point dragStart: Qt.point(0, 0)

    // Signals
    signal dialogClosed()
    signal photoSwitched(var photo)
    signal photoUpdated(var photo)

    // Computed properties
    readonly property bool hasPrev: currentIndex > 0
    readonly property bool hasNext: currentIndex < photos.length - 1
    readonly property var currentPhoto: photos.length > 0 && currentIndex >= 0 && currentIndex < photos.length
        ? photos[currentIndex] : photo

    // Popup settings - full screen
    parent: Overlay.overlay
    anchors.centerIn: parent
    width: parent ? parent.width : 0
    height: parent ? parent.height : 0
    modal: true
    closePolicy: Popup.CloseOnEscape
    padding: 0

    // Background
    background: Rectangle {
        color: Theme.Theme.background
    }

    // Reset state when photo changes
    onCurrentPhotoChanged: {
        zoomScale = 1.0
        posX = 0
        posY = 0
    }

    onClosed: {
        isPlaying = false
        root.dialogClosed()
    }

    // Navigation functions
    function goPrev() {
        if (hasPrev) {
            currentIndex--
            photoSwitched(currentPhoto)
        }
    }

    function goNext() {
        if (hasNext) {
            currentIndex++
            photoSwitched(currentPhoto)
        }
    }

    function zoomIn() {
        zoomScale = Math.min(zoomScale + 0.25, 3)
        if (zoomScale === 1) { posX = 0; posY = 0 }
    }

    function zoomOut() {
        zoomScale = Math.max(zoomScale - 0.25, 0.5)
        if (zoomScale === 1) { posX = 0; posY = 0 }
    }

    function resetZoom() {
        zoomScale = 1
        posX = 0
        posY = 0
    }

    function toggleSlideshow() {
        isPlaying = !isPlaying
    }

    // Slideshow timer
    Timer {
        id: slideshowTimer
        interval: 3000
        repeat: true
        running: isPlaying && hasNext
        onTriggered: goNext()
    }

    contentItem: Item {
        focus: true

        // Keyboard shortcuts
        Keys.onPressed: function(event) {
            switch (event.key) {
                case Qt.Key_Escape:
                    root.close()
                    event.accepted = true
                    break
                case Qt.Key_Left:
                    goPrev()
                    event.accepted = true
                    break
                case Qt.Key_Right:
                    goNext()
                    event.accepted = true
                    break
                case Qt.Key_Space:
                    toggleSlideshow()
                    event.accepted = true
                    break
                case Qt.Key_I:
                    showInfo = !showInfo
                    event.accepted = true
                    break
                case Qt.Key_Plus:
                case Qt.Key_Equal:
                    zoomIn()
                    event.accepted = true
                    break
                case Qt.Key_Minus:
                    zoomOut()
                    event.accepted = true
                    break
                case Qt.Key_0:
                    resetZoom()
                    event.accepted = true
                    break
            }
        }

        // Image area with pan/zoom
        MouseArea {
            id: imageArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: zoomScale > 1 ? (isDragging ? Qt.ClosedHandCursor : Qt.OpenHandCursor) : Qt.ArrowCursor

            onClicked: root.close()

            onPressed: function(mouse) {
                if (zoomScale > 1) {
                    isDragging = true
                    dragStart = Qt.point(mouse.x - posX, mouse.y - posY)
                }
            }

            onPositionChanged: function(mouse) {
                if (isDragging) {
                    posX = mouse.x - dragStart.x
                    posY = mouse.y - dragStart.y
                }
            }

            onReleased: {
                isDragging = false
            }

            onWheel: function(wheel) {
                if (wheel.angleDelta.y > 0) {
                    zoomIn()
                } else {
                    zoomOut()
                }
            }

            // Photo image
            Image {
                id: photoImage
                anchors.centerIn: parent
                width: Math.min(sourceSize.width, parent.width - 100)
                height: Math.min(sourceSize.height, parent.height - 160)
                fillMode: Image.PreserveAspectFit
                source: currentPhoto ? "file:///" + currentPhoto.filePath : ""
                asynchronous: true
                cache: true

                transform: [
                    Scale {
                        origin.x: photoImage.width / 2
                        origin.y: photoImage.height / 2
                        xScale: zoomScale
                        yScale: zoomScale
                    },
                    Translate {
                        x: posX
                        y: posY
                    }
                ]

                Behavior on x { NumberAnimation { duration: isDragging ? 0 : Theme.Theme.durationFast } }
                Behavior on y { NumberAnimation { duration: isDragging ? 0 : Theme.Theme.durationFast } }

                // Loading indicator
                BusyIndicator {
                    anchors.centerIn: parent
                    running: photoImage.status === Image.Loading
                    visible: running
                }

                // Error state
                Rectangle {
                    anchors.centerIn: parent
                    width: 200
                    height: 100
                    radius: Theme.Theme.radiusLarge
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border
                    visible: photoImage.status === Image.Error

                    Column {
                        anchors.centerIn: parent
                        spacing: 8

                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "⚠"
                            font.pixelSize: 32
                            color: Theme.Theme.danger
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "图片加载失败"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                        }
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: function(mouse) { mouse.accepted = false }
                    onPressed: function(mouse) { mouse.accepted = false }
                }
            }
        }

        // Back button (top-left)
        Rectangle {
            anchors.top: parent.top
            anchors.left: parent.left
            anchors.margins: 16
            width: 48
            height: 48
            radius: 24
            color: backBtnMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.surface
            opacity: 0.9
            z: 10

            Text {
                anchors.centerIn: parent
                text: "←"
                font.pixelSize: 24
                color: Theme.Theme.textPrimary
            }

            MouseArea {
                id: backBtnMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: root.close()
            }
        }

        // Top toolbar (centered)
        Rectangle {
            anchors.top: parent.top
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.topMargin: 16
            height: 48
            width: toolbarRow.width + 16
            radius: 24
            color: Theme.Theme.surface
            opacity: 0.95
            z: 10

            RowLayout {
                id: toolbarRow
                anchors.centerIn: parent
                spacing: 4

                // Counter
                Text {
                    text: (currentIndex + 1) + " / " + (photos.length || 1)
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.weight: Font.Medium
                    color: Theme.Theme.textSecondary
                    Layout.rightMargin: 8
                }

                // Separator
                Rectangle { width: 1; height: 20; color: Theme.Theme.border }

                // Zoom out
                ToolbarButton {
                    icon: "−"
                    tooltip: "缩小"
                    onClicked: zoomOut()
                }

                // Zoom level
                Text {
                    text: Math.round(zoomScale * 100) + "%"
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.weight: Font.DemiBold
                    color: Theme.Theme.textPrimary
                    Layout.preferredWidth: 50
                    horizontalAlignment: Text.AlignHCenter
                }

                // Zoom in
                ToolbarButton {
                    icon: "+"
                    tooltip: "放大"
                    onClicked: zoomIn()
                }

                // Separator
                Rectangle { width: 1; height: 20; color: Theme.Theme.border; Layout.leftMargin: 4; Layout.rightMargin: 4 }

                // Reset zoom
                ToolbarButton {
                    icon: "⊙"
                    tooltip: "重置视图"
                    onClicked: resetZoom()
                }

                // Slideshow
                ToolbarButton {
                    icon: isPlaying ? "■" : "▶"
                    tooltip: "幻灯片播放"
                    highlighted: isPlaying
                    enabled: hasNext
                    onClicked: toggleSlideshow()
                }

                // Favorite
                ToolbarButton {
                    icon: currentPhoto && currentPhoto.isFavorite ? "❤" : "♡"
                    tooltip: "收藏"
                    highlighted: currentPhoto && currentPhoto.isFavorite
                    onClicked: {
                        if (currentPhoto) {
                            var updated = Object.assign({}, currentPhoto)
                            updated.isFavorite = !updated.isFavorite
                            root.photoUpdated(updated)
                        }
                    }
                }

                // Info panel toggle
                ToolbarButton {
                    icon: "ℹ"
                    tooltip: "信息"
                    highlighted: showInfo
                    onClicked: showInfo = !showInfo
                }
            }
        }

        // Navigation buttons
        Rectangle {
            anchors.left: parent.left
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: 24
            width: 48
            height: 48
            radius: 24
            color: prevBtnMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.surface
            visible: hasPrev
            z: 10

            Text {
                anchors.centerIn: parent
                text: "‹"
                font.pixelSize: 32
                color: Theme.Theme.textPrimary
            }

            MouseArea {
                id: prevBtnMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: goPrev()
            }
        }

        Rectangle {
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.rightMargin: showInfo ? 344 : 24
            width: 48
            height: 48
            radius: 24
            color: nextBtnMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.surface
            visible: hasNext
            z: 10

            Behavior on anchors.rightMargin { NumberAnimation { duration: Theme.Theme.durationNormal } }

            Text {
                anchors.centerIn: parent
                text: "›"
                font.pixelSize: 32
                color: Theme.Theme.textPrimary
            }

            MouseArea {
                id: nextBtnMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: goNext()
            }
        }

        // Bottom rating bar
        Rectangle {
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottomMargin: 32
            height: 56
            width: ratingRow.width + 48
            radius: 28
            color: Theme.Theme.surface
            opacity: 0.95
            z: 10

            RowLayout {
                id: ratingRow
                anchors.centerIn: parent
                spacing: 8

                Repeater {
                    model: 5

                    Rectangle {
                        width: 36
                        height: 36
                        radius: 18
                        color: starMouse.containsMouse ? Theme.Theme.hover : "transparent"

                        Text {
                            anchors.centerIn: parent
                            text: "★"
                            font.pixelSize: 24
                            color: (index + 1) <= (currentPhoto ? currentPhoto.rating : 0)
                                ? "#FBBF24"
                                : Theme.Theme.textTertiary
                            opacity: (index + 1) <= (currentPhoto ? currentPhoto.rating : 0) ? 1 : 0.3
                        }

                        MouseArea {
                            id: starMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (currentPhoto) {
                                    var updated = Object.assign({}, currentPhoto)
                                    // Click same star to clear rating
                                    updated.rating = (currentPhoto.rating === index + 1) ? 0 : index + 1
                                    root.photoUpdated(updated)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Info panel (right side)
        Rectangle {
            id: infoPanel
            anchors.top: parent.top
            anchors.bottom: parent.bottom
            anchors.right: parent.right
            anchors.topMargin: 80
            anchors.bottomMargin: 100
            anchors.rightMargin: 16
            width: 320
            radius: Theme.Theme.radiusXLarge
            color: Theme.Theme.surface
            opacity: 0.95
            visible: showInfo
            z: 10

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 20
                spacing: Theme.Theme.spacingMd

                // Header
                RowLayout {
                    Layout.fillWidth: true

                    Text {
                        text: "照片信息"
                        font.pixelSize: Theme.Theme.fontSizeLg
                        font.weight: Font.Bold
                        color: Theme.Theme.textPrimary
                        Layout.fillWidth: true
                    }

                    Rectangle {
                        width: 28
                        height: 28
                        radius: 14
                        color: closeInfoMouse.containsMouse ? Theme.Theme.hover : "transparent"

                        Text {
                            anchors.centerIn: parent
                            text: "✕"
                            font.pixelSize: 14
                            color: Theme.Theme.textSecondary
                        }

                        MouseArea {
                            id: closeInfoMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: showInfo = false
                        }
                    }
                }

                // Scrollable content
                ScrollView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true

                    ColumnLayout {
                        width: parent.width
                        spacing: Theme.Theme.spacingLg

                        // Basic info section
                        InfoSection {
                            title: "基本信息"
                            Layout.fillWidth: true

                            InfoRow { label: "文件名"; value: currentPhoto ? currentPhoto.fileName : "" }
                            InfoRow { label: "格式"; value: currentPhoto ? (currentPhoto.format || "未知") : "" }
                            InfoRow {
                                label: "尺寸"
                                value: currentPhoto && currentPhoto.width && currentPhoto.height
                                    ? currentPhoto.width + " × " + currentPhoto.height : "未知"
                            }
                            InfoRow {
                                label: "大小"
                                value: currentPhoto ? formatFileSize(currentPhoto.fileSize) : ""
                            }
                        }

                        // Date section
                        InfoSection {
                            title: "日期"
                            Layout.fillWidth: true

                            InfoRow {
                                label: "拍摄时间"
                                value: currentPhoto && currentPhoto.dateTaken
                                    ? formatDate(currentPhoto.dateTaken) : "未知"
                                visible: currentPhoto && currentPhoto.dateTaken
                            }
                            InfoRow {
                                label: "添加时间"
                                value: currentPhoto ? formatDate(currentPhoto.dateAdded) : ""
                            }
                        }

                        // Camera section
                        InfoSection {
                            title: "相机"
                            Layout.fillWidth: true
                            visible: currentPhoto && (currentPhoto.cameraModel || currentPhoto.lensModel)

                            InfoRow {
                                label: "相机"
                                value: currentPhoto ? (currentPhoto.cameraModel || "") : ""
                                visible: currentPhoto && currentPhoto.cameraModel
                            }
                            InfoRow {
                                label: "镜头"
                                value: currentPhoto ? (currentPhoto.lensModel || "") : ""
                                visible: currentPhoto && currentPhoto.lensModel
                            }
                        }

                        // EXIF section
                        InfoSection {
                            title: "拍摄参数"
                            Layout.fillWidth: true
                            visible: currentPhoto && (currentPhoto.focalLength || currentPhoto.aperture || currentPhoto.iso || currentPhoto.shutterSpeed)

                            GridLayout {
                                columns: 2
                                rowSpacing: 8
                                columnSpacing: 8
                                Layout.fillWidth: true

                                ExifBox {
                                    label: "焦距"
                                    value: currentPhoto && currentPhoto.focalLength ? currentPhoto.focalLength + "mm" : ""
                                    visible: currentPhoto && currentPhoto.focalLength
                                }
                                ExifBox {
                                    label: "光圈"
                                    value: currentPhoto && currentPhoto.aperture ? "f/" + currentPhoto.aperture : ""
                                    visible: currentPhoto && currentPhoto.aperture
                                }
                                ExifBox {
                                    label: "快门"
                                    value: currentPhoto ? (currentPhoto.shutterSpeed || "") : ""
                                    visible: currentPhoto && currentPhoto.shutterSpeed
                                }
                                ExifBox {
                                    label: "ISO"
                                    value: currentPhoto && currentPhoto.iso ? currentPhoto.iso.toString() : ""
                                    visible: currentPhoto && currentPhoto.iso
                                }
                            }
                        }

                        // File path section
                        InfoSection {
                            title: "文件路径"
                            Layout.fillWidth: true

                            Text {
                                Layout.fillWidth: true
                                text: currentPhoto ? currentPhoto.filePath : ""
                                font.pixelSize: Theme.Theme.fontSizeXs
                                color: Theme.Theme.textSecondary
                                wrapMode: Text.WrapAnywhere
                            }
                        }
                    }
                }
            }
        }
    }

    // Helper functions
    function formatFileSize(bytes) {
        if (!bytes) return "未知"
        if (bytes < 1024) return bytes + " B"
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
        return (bytes / (1024 * 1024)).toFixed(1) + " MB"
    }

    function formatDate(dateStr) {
        if (!dateStr) return ""
        var d = new Date(dateStr)
        return Qt.formatDateTime(d, "yyyy-MM-dd hh:mm")
    }

    // Toolbar button component
    component ToolbarButton: Rectangle {
    property string icon: ""
    property string tooltip: ""
    property bool highlighted: false
    property bool enabled: true

    signal clicked()

    width: 36
    height: 36
    radius: 18
    color: {
        if (!enabled) return "transparent"
        if (highlighted) return Qt.rgba(99/255, 102/255, 241/255, 0.1)
        if (btnMouse.containsMouse) return Theme.Theme.hover
        return "transparent"
    }
    opacity: enabled ? 1 : 0.5

    Text {
        anchors.centerIn: parent
        text: icon
        font.pixelSize: 18
        color: highlighted ? Theme.Theme.primary : Theme.Theme.textPrimary
    }

    MouseArea {
        id: btnMouse
        anchors.fill: parent
        hoverEnabled: parent.enabled
        cursorShape: parent.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: if (parent.enabled) parent.clicked()
    }

    ToolTip.visible: btnMouse.containsMouse && tooltip
    ToolTip.text: tooltip
    ToolTip.delay: 500
    }

    // Info section component
    component InfoSection: ColumnLayout {
    property string title: ""

    spacing: Theme.Theme.spacingSm

    Text {
        text: title
        font.pixelSize: Theme.Theme.fontSizeSm
        font.weight: Font.Medium
        color: Theme.Theme.textPrimary
        Layout.fillWidth: true

        Rectangle {
            anchors.bottom: parent.bottom
            anchors.left: parent.left
            anchors.right: parent.right
            height: 1
            color: Theme.Theme.border
            opacity: 0.5
        }
    }
    }

    // Info row component
    component InfoRow: RowLayout {
    property string label: ""
    property string value: ""

    Layout.fillWidth: true
    spacing: 8

    Text {
        text: label
        font.pixelSize: Theme.Theme.fontSizeSm
        color: Theme.Theme.textSecondary
    }

    Item { Layout.fillWidth: true }

    Text {
        text: value
        font.pixelSize: Theme.Theme.fontSizeSm
        font.weight: Font.Medium
        color: Theme.Theme.textPrimary
        Layout.maximumWidth: 160
        elide: Text.ElideRight
        horizontalAlignment: Text.AlignRight
    }
    }

    // EXIF box component
    component ExifBox: Rectangle {
    property string label: ""
    property string value: ""

    Layout.fillWidth: true
    Layout.preferredHeight: 56
    radius: Theme.Theme.radiusMedium
    color: Theme.Theme.background

    Column {
        anchors.centerIn: parent
        spacing: 4

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: label
            font.pixelSize: Theme.Theme.fontSizeXs
            color: Theme.Theme.textSecondary
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: value
            font.pixelSize: Theme.Theme.fontSizeMd
            font.weight: Font.Bold
            color: Theme.Theme.textPrimary
        }
    }
    }
}
