import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

/**
 * ScanProgressDialog - Scan/Index progress dialog
 *
 * Shows progress for file scanning and photo indexing operations
 */
Popup {
    id: root

    // Properties
    property bool isScanning: false
    property bool isIndexing: false
    property var scanProgress: null    // {currentDir, scannedCount, foundCount}
    property var indexProgress: null   // {processed, total, currentFile}

    // Signals
    signal cancelRequested()

    // Popup settings
    anchors.centerIn: parent
    width: Math.min(450, parent.width - 32)
    modal: true
    closePolicy: Popup.NoAutoClose  // Cannot close by clicking outside
    padding: 24

    // Background overlay
    Overlay.modal: Rectangle {
        color: Qt.rgba(0, 0, 0, 0.5)
    }

    background: Rectangle {
        color: Theme.Theme.surface
        radius: Theme.Theme.radiusXLarge
        border.width: 1
        border.color: Theme.Theme.border
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

        // Title
        Text {
            Layout.fillWidth: true
            text: {
                if (isScanning) return "正在扫描文件..."
                if (isIndexing) return "正在索引照片..."
                return "处理中..."
            }
            font.pixelSize: Theme.Theme.fontSizeXl
            font.weight: Font.Bold
            color: Theme.Theme.textPrimary
        }

        // Scan progress section
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.Theme.spacingSm
            visible: isScanning && scanProgress !== null

            // Current directory label
            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "当前目录"
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                }

                Item { Layout.fillWidth: true }

                Text {
                    text: scanProgress ? scanProgress.scannedCount + " 个文件" : ""
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.family: "Consolas"
                    color: Theme.Theme.textPrimary
                }
            }

            // Current directory path
            Text {
                Layout.fillWidth: true
                text: scanProgress ? scanProgress.currentDir : ""
                font.pixelSize: Theme.Theme.fontSizeXs
                color: Theme.Theme.textTertiary
                elide: Text.ElideMiddle
            }

            // Found count
            Text {
                Layout.topMargin: Theme.Theme.spacingSm
                text: scanProgress ? "找到 " + scanProgress.foundCount + " 张照片" : ""
                font.pixelSize: Theme.Theme.fontSizeSm
                font.weight: Font.Medium
                color: Theme.Theme.textPrimary
            }
        }

        // Index progress section
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.Theme.spacingSm
            visible: isIndexing && indexProgress !== null

            // Progress label
            RowLayout {
                Layout.fillWidth: true

                Text {
                    text: "处理进度"
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                }

                Item { Layout.fillWidth: true }

                Text {
                    text: indexProgress ? indexProgress.processed + " / " + indexProgress.total : ""
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.family: "Consolas"
                    color: Theme.Theme.textPrimary
                }
            }

            // Progress bar
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 8
                radius: 4
                color: Theme.Theme.element

                Rectangle {
                    width: {
                        if (!indexProgress || indexProgress.total === 0) return 0
                        return parent.width * (indexProgress.processed / indexProgress.total)
                    }
                    height: parent.height
                    radius: 4
                    color: Theme.Theme.primary

                    Behavior on width {
                        NumberAnimation { duration: Theme.Theme.durationNormal }
                    }
                }
            }

            // Current file
            Text {
                Layout.fillWidth: true
                text: indexProgress ? indexProgress.currentFile : ""
                font.pixelSize: Theme.Theme.fontSizeXs
                color: Theme.Theme.textTertiary
                elide: Text.ElideMiddle
            }
        }

        // Loading indicator
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            Layout.topMargin: Theme.Theme.spacingSm

            BusyIndicator {
                anchors.centerIn: parent
                width: 32
                height: 32
                running: root.visible
            }
        }

        // Cancel button
        RowLayout {
            Layout.fillWidth: true
            Layout.topMargin: Theme.Theme.spacingSm

            Item { Layout.fillWidth: true }

            Button {
                Layout.preferredHeight: 36
                text: "取消"

                background: Rectangle {
                    radius: Theme.Theme.radiusLarge
                    color: cancelBtnMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.element
                }

                contentItem: Text {
                    text: parent.text
                    font.pixelSize: Theme.Theme.fontSizeSm
                    font.weight: Font.Medium
                    color: Theme.Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    leftPadding: 16
                    rightPadding: 16
                }

                MouseArea {
                    id: cancelBtnMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.cancelRequested()
                }
            }
        }
    }
}
