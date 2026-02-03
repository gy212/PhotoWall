import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"

Rectangle {
    id: root
    color: Theme.Theme.background

    // Mock data for trash (will be connected to C++ backend)
    property var photos: []
    property int totalCount: 0
    property bool loading: false
    property var selectedIds: new Set()
    property bool restoring: false
    property bool deleting: false
    property bool emptying: false

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
                    Layout.preferredHeight: 96
                    color: Theme.Theme.surface
                    border.width: 1
                    border.color: Theme.Theme.border

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 24
                        anchors.rightMargin: 24
                        anchors.topMargin: 16
                        anchors.bottomMargin: 16
                        spacing: 8

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 16

                            Icon {
                                name: "delete"
                                size: 28
                                color: Theme.Theme.textSecondary
                            }

                            ColumnLayout {
                                spacing: 2
                                Layout.fillWidth: true
                                Text {
                                    text: "最近删除"
                                    font.pixelSize: 28
                                    font.weight: Font.Black
                                    font.family: Theme.Theme.fontSerif
                                    color: Theme.Theme.textPrimary
                                }
                                Text {
                                    text: "项目将在 30 天后永久删除。"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: Theme.Theme.textSecondary
                                }
                            }
                        }

                        Item { Layout.fillHeight: true }
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
                            radius: Theme.Theme.radiusXXLarge
                            color: Theme.Theme.element
                            anchors.horizontalCenter: parent.horizontalCenter

                            Icon {
                                anchors.centerIn: parent
                                name: "delete_sweep"
                                size: 56
                                color: Qt.rgba(Theme.Theme.textSecondary.r, Theme.Theme.textSecondary.g, Theme.Theme.textSecondary.b, 0.5)
                            }
                        }

                        Text {
                            text: "回收站为空"
                            font.pixelSize: 26
                            font.weight: Font.Bold
                            font.family: Theme.Theme.fontSerif
                            color: Theme.Theme.textPrimary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Text {
                            text: "没有已删除的照片。\n您删除的项目将会临时显示在这里。"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Button {
                            anchors.horizontalCenter: parent.horizontalCenter
                            background: Rectangle {
                                implicitWidth: 160
                                implicitHeight: 44
                                radius: Theme.Theme.radiusLarge
                                color: parent.pressed ? Theme.Theme.primaryDark : Theme.Theme.primary
                            }
                            contentItem: RowLayout {
                                anchors.centerIn: parent
                                spacing: 8
                                Icon { name: "photo_library"; size: 18; color: "white" }
                                Text {
                                    text: "浏览照片"
                                    font.pixelSize: Theme.Theme.fontSizeSm
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

                        // Restore button
                        Button {
                            text: restoring ? "恢复中..." : "恢复"
                            Layout.preferredHeight: 36
                            enabled: !restoring

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.primaryDark : Theme.Theme.primary
                            }
                            contentItem: Text {
                                text: parent.text
                                font.pixelSize: Theme.Theme.fontSizeSm
                                color: "#ffffff"
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                leftPadding: 12
                                rightPadding: 12
                            }
                            onClicked: {
                                // TODO: Implement restore
                                restoring = true
                                Qt.callLater(() => {
                                    restoring = false
                                    clearSelection()
                                })
                            }
                        }

                        Rectangle {
                            width: 1
                            height: 24
                            color: Theme.Theme.border
                        }

                        // Permanent delete button
                        Button {
                            text: "彻底删除"
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: Theme.Theme.radiusMedium
                                color: parent.pressed ? Theme.Theme.dangerHover : Theme.Theme.danger
                            }
                            contentItem: Text {
                                text: parent.text
                                font.pixelSize: Theme.Theme.fontSizeSm
                                color: "#ffffff"
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                                leftPadding: 12
                                rightPadding: 12
                            }
                            onClicked: deleteDialog.open()
                        }

                        Button {
                            text: ""
                            Layout.preferredWidth: 36
                            Layout.preferredHeight: 36

                            background: Rectangle {
                                radius: 18
                                color: parent.pressed ? Theme.Theme.hover : "transparent"
                            }
                            contentItem: Icon {
                                anchors.centerIn: parent
                                name: "close"
                                size: 14
                                color: Theme.Theme.textSecondary
                            }
                            onClicked: clearSelection()
                        }
                    }
                }
            }
        }
    }

    // Permanent delete confirmation dialog
    Popup {
        id: deleteDialog
        anchors.centerIn: parent
        width: 400
        height: 200
        modal: true
        closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

        background: Rectangle {
            color: Theme.Theme.surface
            radius: Theme.Theme.radiusXLarge
            border.width: 1
            border.color: Theme.Theme.border
        }

        contentItem: ColumnLayout {
            spacing: Theme.Theme.spacingMd

            RowLayout {
                spacing: 12

                Rectangle {
                    width: 48
                    height: 48
                    radius: 24
                    color: Qt.rgba(Theme.Theme.danger.r, Theme.Theme.danger.g, Theme.Theme.danger.b, 0.2)

                    Icon {
                        anchors.centerIn: parent
                        name: "warning"
                        size: 22
                        color: Theme.Theme.danger
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4

                    Text {
                        text: "永久删除"
                        font.pixelSize: Theme.Theme.fontSizeLg
                        font.weight: Font.Bold
                        color: Theme.Theme.textPrimary
                    }
                    Text {
                        text: "确定要永久删除这 " + selectedIds.size + " 张照片吗？\n此操作无法撤消！"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        color: Theme.Theme.textSecondary
                        Layout.fillWidth: true
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Item { Layout.fillHeight: true }

            RowLayout {
                Layout.fillWidth: true
                spacing: Theme.Theme.spacingSm

                Button {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 40
                    text: "取消"
                    enabled: !deleting

                    background: Rectangle {
                        radius: Theme.Theme.radiusMedium
                        color: parent.pressed ? Theme.Theme.hover : Theme.Theme.element
                        border.width: 1
                        border.color: Theme.Theme.border
                    }
                    contentItem: Text {
                        text: parent.text
                        font.pixelSize: Theme.Theme.fontSizeMd
                        color: Theme.Theme.textSecondary
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    onClicked: deleteDialog.close()
                }

                Button {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 40
                    text: deleting ? "删除中..." : "永久删除"
                    enabled: !deleting

                    background: Rectangle {
                        radius: Theme.Theme.radiusMedium
                        color: parent.pressed ? Theme.Theme.dangerHover : Theme.Theme.danger
                    }
                    contentItem: Text {
                        text: parent.text
                        font.pixelSize: Theme.Theme.fontSizeMd
                        font.weight: Font.Medium
                        color: "#ffffff"
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    onClicked: {
                        // TODO: Implement permanent delete
                        deleting = true
                        Qt.callLater(() => {
                            deleting = false
                            deleteDialog.close()
                            clearSelection()
                        })
                    }
                }
            }
        }
    }

    // Empty trash confirmation dialog
    Popup {
        id: emptyTrashDialog
        anchors.centerIn: parent
        width: 400
        height: 200
        modal: true
        closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

        background: Rectangle {
            color: Theme.Theme.surface
            radius: Theme.Theme.radiusXLarge
            border.width: 1
            border.color: Theme.Theme.border
        }

        contentItem: ColumnLayout {
            spacing: Theme.Theme.spacingMd

            RowLayout {
                spacing: 12

                Rectangle {
                    width: 48
                    height: 48
                    radius: 24
                    color: Qt.rgba(Theme.Theme.danger.r, Theme.Theme.danger.g, Theme.Theme.danger.b, 0.2)

                        Icon {
                            anchors.centerIn: parent
                            name: "delete_forever"
                            size: 22
                            color: Theme.Theme.danger
                        }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4

                    Text {
                        text: "清空回收站"
                        font.pixelSize: Theme.Theme.fontSizeLg
                        font.weight: Font.Bold
                        color: Theme.Theme.textPrimary
                    }
                    Text {
                        text: "确定要永久删除回收站中的全部 " + totalCount + " 张照片吗？\n此操作无法撤消！"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        color: Theme.Theme.textSecondary
                        Layout.fillWidth: true
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Item { Layout.fillHeight: true }

            RowLayout {
                Layout.fillWidth: true
                spacing: Theme.Theme.spacingSm

                Button {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 40
                    text: "取消"
                    enabled: !emptying

                    background: Rectangle {
                        radius: Theme.Theme.radiusMedium
                        color: parent.pressed ? Theme.Theme.hover : Theme.Theme.element
                        border.width: 1
                        border.color: Theme.Theme.border
                    }
                    contentItem: Text {
                        text: parent.text
                        font.pixelSize: Theme.Theme.fontSizeMd
                        color: Theme.Theme.textSecondary
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    onClicked: emptyTrashDialog.close()
                }

                Button {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 40
                    text: emptying ? "清空中..." : "清空回收站"
                    enabled: !emptying

                    background: Rectangle {
                        radius: Theme.Theme.radiusMedium
                        color: parent.pressed ? Theme.Theme.dangerHover : Theme.Theme.danger
                    }
                    contentItem: Text {
                        text: parent.text
                        font.pixelSize: Theme.Theme.fontSizeMd
                        font.weight: Font.Medium
                        color: "#ffffff"
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    onClicked: {
                        // TODO: Implement empty trash
                        emptying = true
                        Qt.callLater(() => {
                            emptying = false
                            emptyTrashDialog.close()
                            photos = []
                            totalCount = 0
                        })
                    }
                }
            }
        }
    }
}
