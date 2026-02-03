import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme
import "../components"
import "../dialogs"

Rectangle {
    id: root
    color: Theme.Theme.background

    // Mock data for tags (will be connected to C++ backend)
    property var tags: [
        { tagId: 1, tagName: "风景", color: "#22C55E", photoCount: 156 },
        { tagId: 2, tagName: "人像", color: "#6366F1", photoCount: 89 },
        { tagId: 3, tagName: "美食", color: "#F59E0B", photoCount: 45 },
        { tagId: 4, tagName: "旅行", color: "#EC4899", photoCount: 234 },
        { tagId: 5, tagName: "家庭", color: "#8B5CF6", photoCount: 67 },
        { tagId: 6, tagName: "宠物", color: "#14B8A6", photoCount: 28 }
    ]
    property bool loading: false
    property bool managerOpen: false

    // Calculate total photos
    function getTotalPhotos() {
        var total = 0
        for (var i = 0; i < tags.length; i++) {
            total += tags[i].photoCount
        }
        return total
    }

    signal tagClicked(var tag)

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
                                text: "标签"
                                font.pixelSize: Theme.Theme.fontSize2xl
                                font.weight: Font.Bold
                                color: Theme.Theme.textPrimary
                            }
                            Text {
                                text: tags.length + " 个标签 · " + getTotalPhotos() + " 张照片"
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
                                Icon { name: "settings"; size: 16; color: "#ffffff"; filled: true }
                                Text {
                                    text: "管理标签"
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
                        visible: !loading && tags.length === 0

                        Rectangle {
                            width: 80
                            height: 80
                            radius: 24
                            color: Theme.Theme.element
                            anchors.horizontalCenter: parent.horizontalCenter

                            Icon {
                                anchors.centerIn: parent
                                name: "label"
                                size: 36
                                color: Theme.Theme.textSecondary
                                opacity: 0.5
                            }
                        }

                        Text {
                            text: "暂无标签"
                            font.pixelSize: Theme.Theme.fontSizeXl
                            font.weight: Font.Bold
                            color: Theme.Theme.textPrimary
                            anchors.horizontalCenter: parent.horizontalCenter
                        }

                        Text {
                            text: "标签可以帮助您更好地组织照片。\n点击右上角按钮创建一个标签吧。"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                            horizontalAlignment: Text.AlignHCenter
                            anchors.horizontalCenter: parent.horizontalCenter
                        }
                    }

                    // Tag grid
                    GridView {
                        id: tagGrid
                        anchors.fill: parent
                        anchors.margins: Theme.Theme.spacingLg
                        visible: !loading && tags.length > 0
                        clip: true

                        cellWidth: Math.max(180, (width - Theme.Theme.spacingMd * 5) / Math.floor(width / 200))
                        cellHeight: 140

                        model: tags

                        delegate: Item {
                            width: tagGrid.cellWidth
                            height: tagGrid.cellHeight

                            Rectangle {
                                id: tagCard
                                anchors.fill: parent
                                anchors.margins: Theme.Theme.spacingSm
                                radius: Theme.Theme.radiusXLarge
                                color: Theme.Theme.surface
                                border.width: 1
                                border.color: cardMouseArea.containsMouse ? Theme.Theme.primary : Theme.Theme.border

                                Behavior on border.color { ColorAnimation { duration: Theme.Theme.durationFast } }
                                Behavior on y { NumberAnimation { duration: Theme.Theme.durationNormal; easing.type: Easing.OutQuad } }

                                transform: Translate {
                                    y: cardMouseArea.containsMouse ? -4 : 0
                                    Behavior on y { NumberAnimation { duration: Theme.Theme.durationNormal; easing.type: Easing.OutQuad } }
                                }

                                // Background icon
                                Icon {
                                    anchors.top: parent.top
                                    anchors.right: parent.right
                                    anchors.margins: 12
                                    name: "label"
                                    size: 48
                                    color: Theme.Theme.textSecondary
                                    opacity: cardMouseArea.containsMouse ? 0.15 : 0.08

                                    Behavior on opacity { NumberAnimation { duration: Theme.Theme.durationFast } }
                                }

                                ColumnLayout {
                                    anchors.fill: parent
                                    anchors.margins: 20
                                    spacing: Theme.Theme.spacingSm

                                    // Tag color badge
                                    Rectangle {
                                        width: 40
                                        height: 40
                                        radius: Theme.Theme.radiusLarge
                                        color: modelData.color || Theme.Theme.primary

                                        scale: cardMouseArea.containsMouse ? 1.1 : 1.0
                                        Behavior on scale { NumberAnimation { duration: Theme.Theme.durationFast } }

                                        Text {
                                            anchors.centerIn: parent
                                            text: modelData.tagName.charAt(0).toUpperCase()
                                            font.pixelSize: Theme.Theme.fontSizeLg
                                            font.weight: Font.Bold
                                            color: "#ffffff"
                                        }
                                    }

                                    Item { Layout.fillHeight: true }

                                    // Tag name
                                    Text {
                                        text: modelData.tagName
                                        font.pixelSize: Theme.Theme.fontSizeLg
                                        font.weight: Font.Bold
                                        color: Theme.Theme.textPrimary
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }

                                    // Photo count
                                    RowLayout {
                                        spacing: 6

                                        Icon {
                                            name: "photo_library"
                                            size: 14
                                            color: Theme.Theme.textTertiary
                                            filled: true
                                        }
                                        Text {
                                            text: modelData.photoCount + " 张照片"
                                            font.pixelSize: Theme.Theme.fontSizeXs
                                            font.weight: Font.Medium
                                            color: Theme.Theme.textTertiary
                                        }
                                    }
                                }

                                MouseArea {
                                    id: cardMouseArea
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: root.tagClicked(modelData)
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

    // Tag Manager dialog
    TagManager {
        id: tagManagerDialog
        parent: Overlay.overlay
        tags: root.tags
        visible: managerOpen

        onTagCreated: function(name, color) {
            // TODO: Connect to backend
            console.log("Tag created:", name, color)
        }
        onTagUpdated: function(tagId, name, color) {
            // TODO: Connect to backend
            console.log("Tag updated:", tagId, name, color)
        }
        onTagDeleted: function(tagId) {
            // TODO: Connect to backend
            console.log("Tag deleted:", tagId)
        }
        onClosed: managerOpen = false
    }
}
