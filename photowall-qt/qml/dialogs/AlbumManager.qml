import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

/**
 * AlbumManager - Album management dialog
 *
 * Create, edit, and delete albums with descriptions
 */
Popup {
    id: root

    // Properties
    property var albums: []  // [{albumId, albumName, description, photoCount}]
    property bool loading: false

    // Internal state
    property int editingAlbumId: -1
    property string editName: ""
    property string editDescription: ""
    property string newAlbumName: ""
    property string newAlbumDescription: ""

    // Signals
    signal albumCreated(string name, string description)
    signal albumUpdated(int albumId, string name, string description)
    signal albumDeleted(int albumId)
    signal dialogClosed()

    // Popup settings
    anchors.centerIn: parent
    width: Math.min(600, parent.width - 64)
    height: Math.min(550, parent.height - 64)
    modal: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    padding: 0

    onClosed: {
        editingAlbumId = -1
        newAlbumName = ""
        newAlbumDescription = ""
        root.dialogClosed()
    }

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

    contentItem: ColumnLayout {
        spacing: 0

        // Header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: "transparent"

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 24

                Text {
                    text: "相册管理"
                    font.pixelSize: Theme.Theme.fontSizeXl
                    font.weight: Font.Bold
                    color: Theme.Theme.textPrimary
                    Layout.fillWidth: true
                }

                Rectangle {
                    width: 32
                    height: 32
                    radius: 16
                    color: closeMouseArea.containsMouse ? Theme.Theme.hover : "transparent"

                    Text {
                        anchors.centerIn: parent
                        text: "✕"
                        font.pixelSize: 16
                        color: Theme.Theme.textSecondary
                    }

                    MouseArea {
                        id: closeMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.close()
                    }
                }
            }

            // Bottom border
            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.Theme.border
            }
        }

        // Content
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            ColumnLayout {
                width: parent.width
                spacing: Theme.Theme.spacingLg

                // Padding container
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: contentColumn.height + 48

                    ColumnLayout {
                        id: contentColumn
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.top: parent.top
                        anchors.margins: 24
                        spacing: Theme.Theme.spacingLg

                        // Create new album section
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: Theme.Theme.spacingMd

                            Text {
                                text: "创建新相册"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.DemiBold
                                color: Theme.Theme.textSecondary
                            }

                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: Theme.Theme.spacingSm

                                // Name input
                                TextField {
                                    id: newNameInput
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 40
                                    placeholderText: "相册名称"
                                    text: root.newAlbumName
                                    onTextChanged: root.newAlbumName = text

                                    background: Rectangle {
                                        radius: Theme.Theme.radiusLarge
                                        color: Theme.Theme.element
                                        border.width: 1
                                        border.color: newNameInput.activeFocus ? Theme.Theme.primary : Theme.Theme.border
                                    }

                                    color: Theme.Theme.textPrimary
                                    placeholderTextColor: Theme.Theme.textTertiary
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    leftPadding: 12
                                    rightPadding: 12

                                    Keys.onReturnPressed: {
                                        if (newAlbumName.trim()) {
                                            root.albumCreated(newAlbumName.trim(), newAlbumDescription.trim())
                                            newAlbumName = ""
                                            newAlbumDescription = ""
                                        }
                                    }
                                }

                                // Description input
                                TextArea {
                                    id: newDescInput
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 60
                                    placeholderText: "描述（可选）"
                                    text: root.newAlbumDescription
                                    onTextChanged: root.newAlbumDescription = text
                                    wrapMode: TextArea.Wrap

                                    background: Rectangle {
                                        radius: Theme.Theme.radiusLarge
                                        color: Theme.Theme.element
                                        border.width: 1
                                        border.color: newDescInput.activeFocus ? Theme.Theme.primary : Theme.Theme.border
                                    }

                                    color: Theme.Theme.textPrimary
                                    placeholderTextColor: Theme.Theme.textTertiary
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    leftPadding: 12
                                    rightPadding: 12
                                    topPadding: 10
                                    bottomPadding: 10
                                }

                                // Create button
                                Button {
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 40
                                    enabled: newAlbumName.trim().length > 0

                                    background: Rectangle {
                                        radius: Theme.Theme.radiusLarge
                                        color: parent.enabled
                                            ? (createBtnMouse.containsMouse ? Theme.Theme.primaryDark : Theme.Theme.primary)
                                            : Theme.Theme.element
                                        opacity: parent.enabled ? 1 : 0.5
                                    }

                                    contentItem: Text {
                                        text: "创建相册"
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        font.weight: Font.Medium
                                        color: parent.enabled ? "#ffffff" : Theme.Theme.textTertiary
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                    }

                                    MouseArea {
                                        id: createBtnMouse
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: parent.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                                        onClicked: {
                                            if (newAlbumName.trim()) {
                                                root.albumCreated(newAlbumName.trim(), newAlbumDescription.trim())
                                                newAlbumName = ""
                                                newAlbumDescription = ""
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Album list section
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: Theme.Theme.spacingMd

                            Text {
                                text: "所有相册 (" + albums.length + ")"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.DemiBold
                                color: Theme.Theme.textSecondary
                            }

                            // Loading state
                            Text {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 60
                                visible: loading
                                text: "加载中..."
                                font.pixelSize: Theme.Theme.fontSizeMd
                                color: Theme.Theme.textTertiary
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }

                            // Empty state
                            Text {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 60
                                visible: !loading && albums.length === 0
                                text: "暂无相册"
                                font.pixelSize: Theme.Theme.fontSizeMd
                                color: Theme.Theme.textTertiary
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }

                            // Album list
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: Theme.Theme.spacingSm
                                visible: !loading && albums.length > 0

                                Repeater {
                                    model: root.albums

                                    delegate: AlbumListItem {
                                        Layout.fillWidth: true
                                        albumData: modelData
                                        isEditing: root.editingAlbumId === modelData.albumId
                                        editNameValue: root.editName
                                        editDescValue: root.editDescription

                                        onStartEdit: {
                                            root.editingAlbumId = modelData.albumId
                                            root.editName = modelData.albumName
                                            root.editDescription = modelData.description || ""
                                        }
                                        onCancelEdit: {
                                            root.editingAlbumId = -1
                                        }
                                        onSaveEdit: function(name, desc) {
                                            root.albumUpdated(modelData.albumId, name, desc)
                                            root.editingAlbumId = -1
                                        }
                                        onDeleteAlbum: {
                                            root.albumDeleted(modelData.albumId)
                                        }
                                        onEditNameChanged: function(name) {
                                            root.editName = name
                                        }
                                        onEditDescChanged: function(desc) {
                                            root.editDescription = desc
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Footer
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: "transparent"

            // Top border
            Rectangle {
                width: parent.width
                height: 1
                color: Theme.Theme.border
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 24

                Item { Layout.fillWidth: true }

                Button {
                    Layout.preferredHeight: 36

                    background: Rectangle {
                        radius: Theme.Theme.radiusLarge
                        color: closeBtnMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.element
                    }

                    contentItem: Text {
                        text: "关闭"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: Theme.Theme.textSecondary
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                        leftPadding: 16
                        rightPadding: 16
                    }

                    MouseArea {
                        id: closeBtnMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.close()
                    }
                }
            }
        }
    }

    // Album list item component
    component AlbumListItem: Rectangle {
    id: albumItem

    property var albumData
    property bool isEditing: false
    property string editNameValue: ""
    property string editDescValue: ""

    signal startEdit()
    signal cancelEdit()
    signal saveEdit(string name, string description)
    signal deleteAlbum()
    signal editNameChanged(string name)
    signal editDescChanged(string desc)

    height: isEditing ? 160 : (albumData.description ? 72 : 52)
    radius: Theme.Theme.radiusLarge
    color: Theme.Theme.surface
    border.width: 1
    border.color: Theme.Theme.border

    Behavior on height { NumberAnimation { duration: Theme.Theme.durationFast } }

    // Display mode
    RowLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 12
        visible: !isEditing

        // Album info
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4

            Text {
                Layout.fillWidth: true
                text: albumData.albumName
                font.pixelSize: Theme.Theme.fontSizeMd
                font.weight: Font.Medium
                color: Theme.Theme.textPrimary
                elide: Text.ElideRight
            }

            Text {
                Layout.fillWidth: true
                visible: albumData.description && albumData.description.length > 0
                text: albumData.description || ""
                font.pixelSize: Theme.Theme.fontSizeSm
                color: Theme.Theme.textSecondary
                elide: Text.ElideRight
            }

            Text {
                text: albumData.photoCount + " 张照片"
                font.pixelSize: Theme.Theme.fontSizeXs
                color: Theme.Theme.textTertiary
            }
        }

        // Edit button
        Rectangle {
            width: 32
            height: 32
            radius: 8
            color: editBtnMouse.containsMouse ? Qt.rgba(59/255, 130/255, 246/255, 0.1) : "transparent"

            Text {
                anchors.centerIn: parent
                text: "✎"
                font.pixelSize: 16
                color: "#3B82F6"
            }

            MouseArea {
                id: editBtnMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: albumItem.startEdit()
            }
        }

        // Delete button
        Rectangle {
            width: 32
            height: 32
            radius: 8
            color: deleteBtnMouse.containsMouse ? Qt.rgba(239/255, 68/255, 68/255, 0.1) : "transparent"

            Text {
                anchors.centerIn: parent
                text: "🗑"
                font.pixelSize: 14
            }

            MouseArea {
                id: deleteBtnMouse
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onClicked: albumItem.deleteAlbum()
            }
        }
    }

    // Edit mode
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8
        visible: isEditing

        TextField {
            id: editNameField
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            text: editNameValue
            onTextChanged: albumItem.editNameChanged(text)

            background: Rectangle {
                radius: Theme.Theme.radiusMedium
                color: Theme.Theme.element
                border.width: 1
                border.color: editNameField.activeFocus ? Theme.Theme.primary : Theme.Theme.border
            }

            color: Theme.Theme.textPrimary
            font.pixelSize: Theme.Theme.fontSizeSm
            leftPadding: 10
            rightPadding: 10
        }

        TextArea {
            id: editDescField
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            text: editDescValue
            onTextChanged: albumItem.editDescChanged(text)
            placeholderText: "描述（可选）"
            wrapMode: TextArea.Wrap

            background: Rectangle {
                radius: Theme.Theme.radiusMedium
                color: Theme.Theme.element
                border.width: 1
                border.color: editDescField.activeFocus ? Theme.Theme.primary : Theme.Theme.border
            }

            color: Theme.Theme.textPrimary
            placeholderTextColor: Theme.Theme.textTertiary
            font.pixelSize: Theme.Theme.fontSizeSm
            leftPadding: 10
            rightPadding: 10
            topPadding: 8
            bottomPadding: 8
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Item { Layout.fillWidth: true }

            Button {
                Layout.preferredHeight: 32

                background: Rectangle {
                    radius: Theme.Theme.radiusMedium
                    color: saveBtnMouse.containsMouse ? "#16A34A" : "#22C55E"
                }

                contentItem: Text {
                    text: "保存"
                    font.pixelSize: Theme.Theme.fontSizeXs
                    font.weight: Font.Medium
                    color: "#ffffff"
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    leftPadding: 12
                    rightPadding: 12
                }

                MouseArea {
                    id: saveBtnMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                        if (editNameValue.trim()) {
                            albumItem.saveEdit(editNameValue.trim(), editDescValue.trim())
                        }
                    }
                }
            }

            Button {
                Layout.preferredHeight: 32

                background: Rectangle {
                    radius: Theme.Theme.radiusMedium
                    color: cancelEditMouse.containsMouse ? Theme.Theme.hover : Theme.Theme.element
                }

                contentItem: Text {
                    text: "取消"
                    font.pixelSize: Theme.Theme.fontSizeXs
                    font.weight: Font.Medium
                    color: Theme.Theme.textSecondary
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    leftPadding: 12
                    rightPadding: 12
                }

                MouseArea {
                    id: cancelEditMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: albumItem.cancelEdit()
                }
            }
        }
    }
    }
}
