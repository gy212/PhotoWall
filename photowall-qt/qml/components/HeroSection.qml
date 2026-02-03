import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt5Compat.GraphicalEffects
import "../theme" as Theme
import "../components"

Item {
    id: root
    implicitHeight: 300
    implicitWidth: parent.width

    signal photoClicked(var photo)

    // Mock Data
    property var featuredPhoto: null
    property var recentPhoto: null

    RowLayout {
        anchors.fill: parent
        spacing: 24

        // Left: Featured Card (col-span-8)
        Rectangle {
            id: leftCard
            Layout.fillHeight: true
            Layout.fillWidth: true
            Layout.preferredWidth: 2
            radius: Theme.Theme.radiusXXLarge
            color: Theme.Theme.surface
            clip: true
            
            layer.enabled: true
            layer.effect: DropShadow {
                transparentBorder: true
                horizontalOffset: 0
                verticalOffset: 6
                radius: 18
                samples: 25
                color: Qt.rgba(0, 0, 0, 0.12)
            }

            LinearGradient {
                anchors.fill: parent
                start: Qt.point(0, 0)
                end: Qt.point(parent.width, parent.height)
                gradient: Gradient {
                    GradientStop { position: 0.0; color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.1) }
                    GradientStop { position: 1.0; color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.05) }
                }
            }

            // Content
            ColumnLayout {
                anchors.centerIn: parent
                width: parent.width - 64
                spacing: 8

                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 80
                    height: 80
                    radius: Theme.Theme.radiusXXLarge
                    color: Theme.Theme.element
                    border.width: 1
                    border.color: Theme.Theme.border

                    Icon {
                        anchors.centerIn: parent
                        name: "photo_library"
                        size: 36
                        color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.4)
                    }
                }

                Text {
                    text: "每日精选"
                    font.pixelSize: 22
                    font.weight: Font.Bold
                    font.family: Theme.Theme.fontSerif
                    color: Theme.Theme.primary
                    horizontalAlignment: Text.AlignHCenter
                    Layout.fillWidth: true
                }

                Text {
                    text: "收藏您喜欢的照片后，这里将展示您的精选作品，为您开启美好的一天。"
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                }
            }
            
            MouseArea { id: maLeft; anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.photoClicked(root.featuredPhoto) }
        }

        // Right: Recent Card (col-span-4)
        Rectangle {
            id: rightCard
            Layout.fillHeight: true
            Layout.fillWidth: true
            Layout.preferredWidth: 1
            radius: Theme.Theme.radiusXXLarge
            color: Theme.Theme.surface
            clip: true
            border.color: Theme.Theme.border
            border.width: 1
            
            layer.enabled: true
            layer.effect: DropShadow {
                transparentBorder: true; horizontalOffset: 0; verticalOffset: 4; radius: 12; samples: 17; color: Theme.Theme.shadowColor; opacity: Theme.Theme.shadowOpacity
            }

            Rectangle {
                anchors.fill: parent
                color: Theme.Theme.surface
            }
            
            ColumnLayout {
                anchors.centerIn: parent
                width: parent.width - 48
                spacing: 8

                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 64
                    height: 64
                    radius: Theme.Theme.radiusXXLarge
                    color: Theme.Theme.element
                    border.width: 1
                    border.color: Theme.Theme.border

                    Icon {
                        anchors.centerIn: parent
                        name: "schedule"
                        size: 28
                        color: Theme.Theme.primary
                    }
                }

                Text {
                    text: "最近编辑"
                    font.pixelSize: 20
                    font.weight: Font.Bold
                    font.family: Theme.Theme.fontSerif
                    color: Theme.Theme.primary
                    horizontalAlignment: Text.AlignHCenter
                    Layout.fillWidth: true
                }
                
                Text {
                    text: "收藏或评分照片后，这里将显示您最近编辑的照片"
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    Layout.fillWidth: true
                    wrapMode: Text.WordWrap
                }
            }

            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: root.photoClicked(root.recentPhoto) }
        }
    }
}
