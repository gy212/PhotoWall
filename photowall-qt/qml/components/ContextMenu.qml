import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

Popup {
    id: root

    // Properties
    property var menuItems: []  // List of {id, label, icon, disabled, divider, danger, callback}

    // Signals
    signal itemClicked(string itemId)
    signal menuClosed()

    // Popup settings
    modal: true
    dim: false
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    padding: 6

    // Viewport boundary detection
    function showAt(globalX, globalY) {
        // Calculate position with boundary detection
        let adjustedX = globalX
        let adjustedY = globalY

        // Get viewport dimensions
        const viewportWidth = parent ? parent.width : 800
        const viewportHeight = parent ? parent.height : 600

        // Estimate menu size (will be refined after opening)
        const estimatedWidth = 200
        const estimatedHeight = menuItems.length * 36 + 12

        // Adjust X if menu would overflow right edge
        if (globalX + estimatedWidth > viewportWidth) {
            adjustedX = viewportWidth - estimatedWidth - 8
        }

        // Adjust Y if menu would overflow bottom edge
        if (globalY + estimatedHeight > viewportHeight) {
            adjustedY = viewportHeight - estimatedHeight - 8
        }

        // Ensure minimum position
        adjustedX = Math.max(8, adjustedX)
        adjustedY = Math.max(8, adjustedY)

        x = adjustedX
        y = adjustedY
        open()
    }

    onClosed: menuClosed()

    // Background
    background: Rectangle {
        color: Theme.Theme.surface
        radius: Theme.Theme.radiusLarge
        border.color: Theme.Theme.border
        border.width: 1
    }

    // Enter animation
    enter: Transition {
        ParallelAnimation {
            NumberAnimation {
                property: "opacity"
                from: 0
                to: 1
                duration: Theme.Theme.durationFast
                easing.type: Easing.OutCubic
            }
            NumberAnimation {
                property: "scale"
                from: 0.95
                to: 1
                duration: Theme.Theme.durationFast
                easing.type: Easing.OutCubic
            }
        }
    }

    // Exit animation
    exit: Transition {
        NumberAnimation {
            property: "opacity"
            from: 1
            to: 0
            duration: 100
            easing.type: Easing.InCubic
        }
    }

    // Content
    contentItem: ColumnLayout {
        spacing: 0

        Repeater {
            model: root.menuItems

            delegate: Item {
                Layout.fillWidth: true
                Layout.preferredHeight: modelData.divider && index > 0 ? itemButton.height + dividerLine.height + 6 : itemButton.height

                // Divider line
                Rectangle {
                    id: dividerLine
                    visible: modelData.divider === true && index > 0
                    width: parent.width - 16
                    height: visible ? 1 : 0
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.top: parent.top
                    anchors.topMargin: 3
                    color: Theme.Theme.border
                }

                // Menu item button
                Rectangle {
                    id: itemButton
                    width: parent.width
                    height: 32
                    anchors.bottom: parent.bottom
                    color: itemMouseArea.containsMouse && !modelData.disabled
                           ? (modelData.danger ? Qt.rgba(239/255, 68/255, 68/255, 0.1) : Theme.Theme.element)
                           : "transparent"
                    radius: Theme.Theme.radiusSmall

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 12
                        anchors.rightMargin: 12
                        spacing: 12

                        // Icon placeholder
                        Item {
                            Layout.preferredWidth: 16
                            Layout.preferredHeight: 16
                            visible: modelData.icon !== undefined && modelData.icon !== ""

                            Text {
                                anchors.centerIn: parent
                                text: modelData.icon || ""
                                font.pixelSize: 14
                                color: modelData.disabled
                                       ? Theme.Theme.textTertiary
                                       : (modelData.danger ? Theme.Theme.danger : Theme.Theme.textSecondary)
                            }
                        }

                        // Label
                        Text {
                            Layout.fillWidth: true
                            text: modelData.label || ""
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: modelData.disabled
                                   ? Theme.Theme.textTertiary
                                   : (modelData.danger ? Theme.Theme.danger : Theme.Theme.textSecondary)
                            elide: Text.ElideRight
                        }
                    }

                    MouseArea {
                        id: itemMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: modelData.disabled ? Qt.ForbiddenCursor : Qt.PointingHandCursor

                        onClicked: {
                            if (!modelData.disabled) {
                                root.itemClicked(modelData.id)
                                if (modelData.callback) {
                                    modelData.callback()
                                }
                                root.close()
                            }
                        }
                    }
                }
            }
        }
    }
}
