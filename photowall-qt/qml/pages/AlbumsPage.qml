import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"
import "../dialogs"

Rectangle {
    id: root
    color: Theme.Theme.background

    // Mock data for albums (will be connected to C++ backend)
    property var albums: [
        { albumId: 1, albumName: "2024 旅行", coverUrl: "", photoCount: 156, createdAt: "2024-01-15" },
        { albumId: 2, albumName: "家庭聚会", coverUrl: "", photoCount: 89, createdAt: "2024-02-20" },
        { albumId: 3, albumName: "美食记录", coverUrl: "", photoCount: 45, createdAt: "2024-03-10" },
        { albumId: 4, albumName: "工作项目", coverUrl: "", photoCount: 234, createdAt: "2024-04-05" },
        { albumId: 5, albumName: "宠物日常", coverUrl: "", photoCount: 67, createdAt: "2024-05-12" }
    ]
    property bool loading: false
    property bool managerOpen: false

    // Calculate total photos
    function getTotalPhotos() {
        var total = 0
        for (var i = 0; i < albums.length; i++) {
            total += albums[i].photoCount
        }
        return total
    }

    signal albumClicked(var album)
    signal albumContextMenu(var album, real x, real y)

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: Theme.Theme.spacingLg
        spacing: 0

        // Card container
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.Theme.surface
            radius: Theme.Theme.radiusXLarge
            border.width: 1
            border.color: Theme.Theme.border

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

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 24
                        anchors.rightMargin: 24

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 4

                            Text {
                                text: "相册"
                                font.pixelSize: Theme.Theme.fontSize2xl
                                font.weight: Font.Bold
                                color: Theme.Theme.textPrimary
                            }
                            Text {
                                text: albums.length + " 个相册 · " + getTotalPhotos() + " 张照片"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                color: Theme.Theme.textSecondary
                            }
                        }

                        Button {
                            Layout.preferredHeight: 40
                            
                            background: Rectangle {
                                radius: Theme.Theme.radiusLarge
                                color: parent.pressed ? Theme.Theme.primaryDark : Theme.Theme.primary
                            }
                            contentItem: RowLayout {
                                spacing: 8
                                anchors.centerIn: parent
                                
                                Icon {
                                    name: "add"
                                    size: 16
                                    color: "#ffffff"
                                    filled: true
                                }
                                
                                Text {
                                    text: "管理相册"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    font.weight: Font.Medium
                                    color: "#ffffff"
                                }
                            }
                            onClicked: managerOpen = true
                        }
                    }
                }

                // Content area
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: Qt.rgba(Theme.Theme.background.r, Theme.Theme.background.g, Theme.Theme.background.b, 0.5)

                    // Loading state
                    Column {
                        anchors.centerIn: parent
                        spacing: 12
                        visible: loading

                        BusyIndicator {
                            width: 32
                            height: 32
                            running: loading
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                        Text {
                            text: "加载中..."
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textTertiary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Empty state
                    Column {
                        anchors.centerIn: parent
                        spacing: Theme.Theme.spacingMd
                        visible: !loading && albums.length === 0

                        Rectangle {
                            width: 80
                            height: 80
                            radius: 24
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
                            text: "暂无相册"
                            font.pixelSize: Theme.Theme.fontSizeXl
                            font.weight: Font.Bold
                            color: Theme.Theme.textPrimary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Text {
                            text: "相册可以帮助您整理和分享照片。\n点击右上角按钮创建一个相册吧。"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Album grid
                    GridView {
                        id: albumGrid
                        anchors.fill: parent
                        anchors.margins: Theme.Theme.spacingLg
                        visible: !loading && albums.length > 0
                        clip: true

                        cellWidth: Math.max(200, (width - Theme.Theme.spacingMd * 4) / Math.floor(width / 220))
                        cellHeight: 200

                        model: albums

                        delegate: Item {
                            width: albumGrid.cellWidth
                            height: albumGrid.cellHeight

                            Rectangle {
                                id: albumCard
                                anchors.fill: parent
                                anchors.margins: Theme.Theme.spacingSm
                                radius: Theme.Theme.radiusXLarge
                                color: Theme.Theme.surface
                                border.width: 1
                                border.color: cardMouseArea.containsMouse ? Theme.Theme.primary : Theme.Theme.border
                                clip: true

                                Behavior on border.color { ColorAnimation { duration: Theme.Theme.durationFast } }

                                transform: Translate {
                                    y: cardMouseArea.containsMouse ? -4 : 0
                                    Behavior on y { NumberAnimation { duration: Theme.Theme.durationNormal; easing.type: Easing.OutQuad } }
                                }

                                // Cover image placeholder
                                Rectangle {
                                    id: coverArea
                                    anchors.top: parent.top
                                    anchors.left: parent.left
                                    anchors.right: parent.right
                                    height: parent.height * 0.55
                                    color: Theme.Theme.element
                                    radius: Theme.Theme.radiusXLarge

                                    // Mask bottom corners
                                    Rectangle {
                                        anchors.bottom: parent.bottom
                                        anchors.left: parent.left
                                        anchors.right: parent.right
                                        height: Theme.Theme.radiusXLarge
                                        color: Theme.Theme.element
                                    }

                                    // Placeholder icon
                                    Icon {
                                        anchors.centerIn: parent
                                        name: "photo_library"
                                        size: 32
                                        color: Theme.Theme.textSecondary
                                        opacity: 0.3
                                    }

                                    // Photo count badge
                                    Rectangle {
                                        anchors.top: parent.top
                                        anchors.right: parent.right
                                        anchors.margins: 8
                                        width: countText.width + 16
                                        height: 24
                                        radius: 12
                                        color: Qt.rgba(0, 0, 0, 0.6)

                                        Text {
                                            id: countText
                                            anchors.centerIn: parent
                                            text: modelData.photoCount + " 张"
                                            font.pixelSize: Theme.Theme.fontSizeXs
                                            font.weight: Font.Medium
                                            color: "#ffffff"
                                        }
                                    }
                                }

                                // Album info
                                ColumnLayout {
                                    anchors.bottom: parent.bottom
                                    anchors.left: parent.left
                                    anchors.right: parent.right
                                    anchors.margins: 16
                                    spacing: 4

                                    Text {
                                        text: modelData.albumName
                                        font.pixelSize: Theme.Theme.fontSizeMd
                                        font.weight: Font.Bold
                                        color: Theme.Theme.textPrimary
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }

                                    Text {
                                        text: modelData.createdAt
                                        font.pixelSize: Theme.Theme.fontSizeXs
                                        color: Theme.Theme.textTertiary
                                    }
                                }

                                MouseArea {
                                    id: cardMouseArea
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    acceptedButtons: Qt.LeftButton | Qt.RightButton
                                    onClicked: function(mouse) {
                                        if (mouse.button === Qt.RightButton) {
                                            root.albumContextMenu(modelData, mouse.x, mouse.y)
                                        } else {
                                            root.albumClicked(modelData)
                                        }
                                    }
                                }
                            }
                        }

                        ScrollBar.vertical: ScrollBar {
                            policy: ScrollBar.AsNeeded
                        }
                    }
                }
            }
        }
    }

    // Album Manager dialog
    AlbumManager {
        id: albumManagerDialog
        parent: Overlay.overlay
        albums: root.albums
        visible: managerOpen

        onAlbumCreated: function(name, description) {
            // TODO: Connect to backend
            console.log("Album created:", name, description)
        }
        onAlbumUpdated: function(albumId, name, description) {
            // TODO: Connect to backend
            console.log("Album updated:", albumId, name, description)
        }
        onAlbumDeleted: function(albumId) {
            // TODO: Connect to backend
            console.log("Album deleted:", albumId)
        }
        onClosed: managerOpen = false
    }
}
