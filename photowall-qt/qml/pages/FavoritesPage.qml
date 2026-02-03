import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Rectangle {
    id: root
    color: Theme.Theme.background

    // Mock data for favorites (will be connected to C++ backend)
    property var photos: []
    property int totalCount: 0
    property bool loading: false
    property var selectedIds: new Set()
    property bool unfavoriting: false

    signal navigateToHome()

    // Selection helpers
    function isSelected(photoId) {
        return selectedIds.has(photoId)
    }

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

    function selectAll() {
        var newSet = new Set()
        for (var i = 0; i < photos.length; i++) {
            newSet.add(photos[i].photoId)
        }
        selectedIds = newSet
    }

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
            clip: true

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Header
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 88
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 24
                        anchors.rightMargin: 24
                        spacing: 16

                        // Heart icon
                        Rectangle {
                            width: 48
                            height: 48
                            radius: 12
                            color: "#FEE2E2"

                            Icon {
                                anchors.centerIn: parent
                                name: "favorite"
                                size: 24
                                color: "#EF4444"
                                filled: true
                            }
                        }

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 4

                            Text {
                                text: "收藏"
                                font.pixelSize: 32
                                font.weight: Font.Black
                                color: Theme.Theme.textPrimary
                            }
                            Text {
                                text: totalCount + " 张照片"
                                font.pixelSize: Theme.Theme.fontSizeMd
                                color: Theme.Theme.textSecondary
                            }
                        }
                    }
                }

                // Content area
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: Theme.Theme.background

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
                        spacing: Theme.Theme.spacingLg
                        visible: !loading && photos.length === 0

                        Rectangle {
                            width: 128
                            height: 128
                            radius: 24
                            color: "#FEE2E2"
                            anchors.horizontalCenter: parent.horizontalCenter

                            Icon {
                                anchors.centerIn: parent
                                name: "favorite"
                                size: 64
                                color: "#EF4444"
                                filled: true
                            }
                        }

                        Text {
                            text: "暂无收藏"
                            font.pixelSize: 28
                            font.weight: Font.Bold
                            color: Theme.Theme.textPrimary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Text {
                            text: "您还没有收藏任何照片。\n点击任何照片上的爱心图标即可添加到此处。"
                            font.pixelSize: Theme.Theme.fontSizeMd
                            color: Theme.Theme.textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Button {
                            anchors.horizontalCenter: parent.horizontalCenter
                            
                            background: Rectangle {
                                implicitWidth: 160
                                implicitHeight: 48
                                radius: Theme.Theme.radiusLarge
                                color: parent.pressed ? Theme.Theme.primaryDark : Theme.Theme.primary
                            }
                            contentItem: RowLayout {
                                spacing: 8
                                anchors.centerIn: parent
                                Icon { name: "photo_library"; size: 20; color: "#ffffff"; filled: true }
                                Text {
                                    text: "浏览照片"
                                    font.pixelSize: Theme.Theme.fontSizeMd
                                    font.weight: Font.Medium
                                    color: "#ffffff"
                                }
                            }
                            onClicked: root.navigateToHome()
                        }
                    }

                    // Photo grid (using PhotoGrid component)
                    PhotoGrid {
                        id: photoGrid
                        anchors.fill: parent
                        visible: !loading && photos.length > 0
                        photos: root.photos
                        selectedIds: root.selectedIds
                        thumbnailSize: 200
                        gap: 16
                        groupByDate: false

                        onPhotoClicked: function(photo, mouse) {
                            if (mouse.modifiers & Qt.ControlModifier) {
                                root.toggleSelection(photo.photoId)
                            } else if (mouse.modifiers & Qt.ShiftModifier) {
                                // Range selection - simplified
                                root.toggleSelection(photo.photoId)
                            } else {
                                root.clearSelection()
                                root.toggleSelection(photo.photoId)
                            }
                        }

                        onPhotoDoubleClicked: function(photo) {
                            console.log("Open viewer for:", photo.photoId)
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
                            enabled: !unfavoriting

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.dangerHover : Theme.Theme.danger
                            }
                            contentItem: RowLayout {
                                spacing: 6
                                anchors.centerIn: parent
                                Icon { name: "heart_minus"; size: 14; color: "#ffffff"; filled: true }
                                Text {
                                    text: unfavoriting ? "处理中..." : "取消收藏"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: "#ffffff"
                                }
                            }
                            onClicked: {
                                // TODO: Implement unfavorite
                                unfavoriting = true
                                Qt.callLater(() => {
                                    unfavoriting = false
                                    clearSelection()
                                })
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
