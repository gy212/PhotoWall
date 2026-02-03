import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

Rectangle {
    id: root

    // Properties
    property string title: "所有照片"
    property int photoCount: 0
    property string viewMode: "grid"  // "grid" or "timeline"
    property string sortField: "dateTaken"  // "dateTaken", "dateAdded", "fileName", "fileSize", "rating"
    property string sortOrder: "desc"  // "asc" or "desc"

    // Signals
    signal viewModeChanged(string mode)
    signal sortChanged(string field, string order)

    // Appearance
    color: "transparent"
    implicitHeight: 56

    // Sort field options
    readonly property var sortFields: [
        { value: "dateTaken", label: "拍摄时间" },
        { value: "dateAdded", label: "添加时间" },
        { value: "fileName", label: "文件名" },
        { value: "fileSize", label: "文件大小" },
        { value: "rating", label: "评分" }
    ]

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: Theme.Theme.spacingMd
        anchors.rightMargin: Theme.Theme.spacingMd
        spacing: Theme.Theme.spacingMd

        // Title section
        RowLayout {
            spacing: Theme.Theme.spacingMd

            // Title
            Text {
                text: root.title
                font.pixelSize: Theme.Theme.fontSize2xl
                font.weight: Font.Bold
                font.family: "Georgia, serif"
                color: Theme.Theme.textPrimary
                Layout.alignment: Qt.AlignVCenter
            }

            // Count badge
            Rectangle {
                Layout.preferredHeight: 24
                Layout.preferredWidth: countText.implicitWidth + 24
                radius: 12
                color: Theme.Theme.element
                border.color: Theme.Theme.border
                border.width: 1

                Text {
                    id: countText
                    anchors.centerIn: parent
                    text: root.photoCount.toLocaleString()
                    font.pixelSize: Theme.Theme.fontSizeXs
                    font.bold: true
                    color: Theme.Theme.textSecondary
                }
            }
        }

        // Spacer
        Item { Layout.fillWidth: true }

        // View mode toggle
        Rectangle {
            Layout.preferredHeight: 40
            Layout.preferredWidth: viewModeRow.implicitWidth + 8
            radius: Theme.Theme.radiusLarge
            color: Theme.Theme.element
            border.color: Theme.Theme.border
            border.width: 1

            RowLayout {
                id: viewModeRow
                anchors.centerIn: parent
                spacing: 4

                // Grid view button
                Rectangle {
                    width: 32
                    height: 32
                    radius: Theme.Theme.radiusMedium
                    color: root.viewMode === "grid" ? Theme.Theme.surface : "transparent"

                    Behavior on color {
                        ColorAnimation { duration: Theme.Theme.durationFast }
                    }

                    Text {
                        anchors.centerIn: parent
                        text: "▦"
                        font.pixelSize: 16
                        color: root.viewMode === "grid" ? Theme.Theme.textPrimary : Theme.Theme.textTertiary
                    }

                    MouseArea {
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (root.viewMode !== "grid") {
                                root.viewMode = "grid"
                                root.viewModeChanged("grid")
                            }
                        }
                    }
                }

                // Timeline view button
                Rectangle {
                    width: 32
                    height: 32
                    radius: Theme.Theme.radiusMedium
                    color: root.viewMode === "timeline" ? Theme.Theme.surface : "transparent"

                    Behavior on color {
                        ColorAnimation { duration: Theme.Theme.durationFast }
                    }

                    Text {
                        anchors.centerIn: parent
                        text: "⏱"
                        font.pixelSize: 16
                        color: root.viewMode === "timeline" ? Theme.Theme.textPrimary : Theme.Theme.textTertiary
                    }

                    MouseArea {
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (root.viewMode !== "timeline") {
                                root.viewMode = "timeline"
                                root.viewModeChanged("timeline")
                            }
                        }
                    }
                }
            }
        }

        // Sort button
        Rectangle {
            id: sortButton
            Layout.preferredWidth: 40
            Layout.preferredHeight: 40
            radius: Theme.Theme.radiusLarge
            color: sortPopup.visible ? Theme.Theme.primary : Theme.Theme.element
            border.color: sortPopup.visible ? Theme.Theme.primary : Theme.Theme.border
            border.width: 1

            Behavior on color {
                ColorAnimation { duration: Theme.Theme.durationFast }
            }

            Text {
                anchors.centerIn: parent
                text: "▼"
                font.pixelSize: 14
                color: sortPopup.visible ? "white" : Theme.Theme.textSecondary
            }

            MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: sortPopup.visible ? sortPopup.close() : sortPopup.open()
            }

            // Sort dropdown popup
            Popup {
                id: sortPopup
                x: sortButton.width - width
                y: sortButton.height + 8
                width: 224
                padding: 8
                modal: true
                dim: false
                closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

                background: Rectangle {
                    color: Theme.Theme.surface
                    radius: Theme.Theme.radiusLarge
                    border.color: Theme.Theme.border
                    border.width: 1
                }

                enter: Transition {
                    ParallelAnimation {
                        NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.Theme.durationFast }
                        NumberAnimation { property: "y"; from: sortButton.height; to: sortButton.height + 8; duration: Theme.Theme.durationFast }
                    }
                }

                contentItem: ColumnLayout {
                    spacing: 0

                    // Sort field header
                    Text {
                        text: "排序方式"
                        font.pixelSize: Theme.Theme.fontSizeXs
                        font.bold: true
                        font.letterSpacing: 1
                        color: Theme.Theme.textTertiary
                        Layout.leftMargin: 12
                        Layout.topMargin: 8
                        Layout.bottomMargin: 8
                    }

                    // Sort field options
                    Repeater {
                        model: root.sortFields
                        delegate: Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 36
                            radius: Theme.Theme.radiusSmall
                            color: sortFieldMouse.containsMouse ? Theme.Theme.element : "transparent"

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 16
                                anchors.rightMargin: 16

                                Text {
                                    text: modelData.label
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    font.weight: root.sortField === modelData.value ? Font.Medium : Font.Normal
                                    color: root.sortField === modelData.value ? Theme.Theme.primary : Theme.Theme.textSecondary
                                    Layout.fillWidth: true
                                }

                                Text {
                                    visible: root.sortField === modelData.value
                                    text: "✓"
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    color: Theme.Theme.primary
                                }
                            }

                            MouseArea {
                                id: sortFieldMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    root.sortField = modelData.value
                                    root.sortChanged(root.sortField, root.sortOrder)
                                    sortPopup.close()
                                }
                            }
                        }
                    }

                    // Divider
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 1
                        Layout.topMargin: 8
                        Layout.bottomMargin: 8
                        Layout.leftMargin: 8
                        Layout.rightMargin: 8
                        color: Theme.Theme.border
                        opacity: 0.5
                    }

                    // Sort order header
                    Text {
                        text: "排序顺序"
                        font.pixelSize: Theme.Theme.fontSizeXs
                        font.bold: true
                        font.letterSpacing: 1
                        color: Theme.Theme.textTertiary
                        Layout.leftMargin: 12
                        Layout.bottomMargin: 8
                    }

                    // Descending option
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 36
                        radius: Theme.Theme.radiusSmall
                        color: descMouse.containsMouse ? Theme.Theme.element : "transparent"

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16

                            Text {
                                text: "降序（新→旧）"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: root.sortOrder === "desc" ? Font.Medium : Font.Normal
                                color: root.sortOrder === "desc" ? Theme.Theme.primary : Theme.Theme.textSecondary
                                Layout.fillWidth: true
                            }

                            Text {
                                visible: root.sortOrder === "desc"
                                text: "✓"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                color: Theme.Theme.primary
                            }
                        }

                        MouseArea {
                            id: descMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                root.sortOrder = "desc"
                                root.sortChanged(root.sortField, root.sortOrder)
                                sortPopup.close()
                            }
                        }
                    }

                    // Ascending option
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 36
                        radius: Theme.Theme.radiusSmall
                        color: ascMouse.containsMouse ? Theme.Theme.element : "transparent"

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 16
                            anchors.rightMargin: 16

                            Text {
                                text: "升序（旧→新）"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: root.sortOrder === "asc" ? Font.Medium : Font.Normal
                                color: root.sortOrder === "asc" ? Theme.Theme.primary : Theme.Theme.textSecondary
                                Layout.fillWidth: true
                            }

                            Text {
                                visible: root.sortOrder === "asc"
                                text: "✓"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                color: Theme.Theme.primary
                            }
                        }

                        MouseArea {
                            id: ascMouse
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                root.sortOrder = "asc"
                                root.sortChanged(root.sortField, root.sortOrder)
                                sortPopup.close()
                            }
                        }
                    }
                }
            }
        }
    }
}
