import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

/**
 * ConfirmDialog - Generic confirmation dialog
 *
 * Supports normal and danger modes with customizable text
 */
Popup {
    id: root

    // Properties
    property string title: ""
    property string message: ""
    property string confirmText: "确认"
    property string cancelText: "取消"
    property bool danger: false

    // Signals
    signal confirmed()
    signal cancelled()

    // Popup settings
    anchors.centerIn: parent
    width: Math.min(400, parent.width - 32)
    modal: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    padding: 24

    onClosed: cancelled()

    // Background overlay
    Overlay.modal: Rectangle {
        color: Qt.rgba(0, 0, 0, 0.5)

        Behavior on opacity { NumberAnimation { duration: Theme.Theme.durationFast } }
    }

    background: Rectangle {
        color: Theme.Theme.surface
        radius: Theme.Theme.radiusXLarge
        border.width: 1
        border.color: Theme.Theme.border

        layer.enabled: true
        layer.effect: Item {
            // Shadow effect placeholder
        }
    }

    enter: Transition {
        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.Theme.durationFast }
        NumberAnimation { property: "scale"; from: 0.9; to: 1; duration: Theme.Theme.durationFast; easing.type: Easing.OutQuad }
    }

    exit: Transition {
        NumberAnimation { property: "opacity"; from: 1; to: 0; duration: Theme.Theme.durationFast }
    }

    contentItem: ColumnLayout {
        spacing: Theme.Theme.spacingMd

        // Icon
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 48
            height: 48
            radius: 24
            color: danger ? Qt.rgba(239/255, 68/255, 68/255, 0.1) : Qt.rgba(99/255, 102/255, 241/255, 0.1)

            Text {
                anchors.centerIn: parent
                text: danger ? "⚠" : "?"
                font.pixelSize: 24
                color: danger ? Theme.Theme.danger : Theme.Theme.primary
            }
        }

        // Title
        Text {
            Layout.fillWidth: true
            text: root.title
            font.pixelSize: Theme.Theme.fontSizeLg
            font.weight: Font.Bold
            color: Theme.Theme.textPrimary
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
        }

        // Message
        Text {
            Layout.fillWidth: true
            text: root.message
            font.pixelSize: Theme.Theme.fontSizeSm
            color: Theme.Theme.textSecondary
            horizontalAlignment: Text.AlignHCenter
            wrapMode: Text.Wrap
        }

        // Spacer
        Item { Layout.preferredHeight: Theme.Theme.spacingSm }

        // Buttons
        RowLayout {
            Layout.fillWidth: true
            spacing: Theme.Theme.spacingMd

            // Cancel button
            Button {
                Layout.fillWidth: true
                Layout.preferredHeight: 40
                text: root.cancelText

                background: Rectangle {
                    radius: Theme.Theme.radiusLarge
                    color: cancelMouseArea.containsMouse ? Theme.Theme.hover : Theme.Theme.element
                }

                contentItem: Text {
                    text: parent.text
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.weight: Font.Medium
                    color: Theme.Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }

                MouseArea {
                    id: cancelMouseArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        root.cancelled()
                        root.close()
                    }
                }
            }

            // Confirm button
            Button {
                Layout.fillWidth: true
                Layout.preferredHeight: 40
                text: root.confirmText

                background: Rectangle {
                    radius: Theme.Theme.radiusLarge
                    color: {
                        if (confirmMouseArea.pressed) {
                            return danger ? Theme.Theme.dangerHover : Theme.Theme.primaryDark
                        }
                        if (confirmMouseArea.containsMouse) {
                            return danger ? Theme.Theme.dangerHover : Theme.Theme.primaryDark
                        }
                        return danger ? Theme.Theme.danger : Theme.Theme.primary
                    }
                }

                contentItem: Text {
                    text: parent.text
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.weight: Font.Medium
                    color: "#ffffff"
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }

                MouseArea {
                    id: confirmMouseArea
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        root.confirmed()
                        root.close()
                    }
                }
            }
        }
    }
}
