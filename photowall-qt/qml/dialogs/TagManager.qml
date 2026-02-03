import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../theme" as Theme

/**
 * TagManager - Tag management dialog
 *
 * Create, edit, and delete tags with color selection
 */
Popup {
    id: root

    // Properties
    property var tags: []  // [{tagId, tagName, color, photoCount}]
    property bool loading: false

    // Color presets
    readonly property var colorPresets: [
        "#EF4444", "#F97316", "#EAB308", "#22C55E",
        "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899"
    ]

    // Internal state
    property int editingTagId: -1
    property string editName: ""
    property string editColor: ""
    property string newTagName: ""
    property string newTagColor: colorPresets[0]

    // Signals
    signal tagCreated(string name, string color)
    signal tagUpdated(int tagId, string name, string color)
    signal tagDeleted(int tagId)
    signal dialogClosed()

    // Popup settings
    anchors.centerIn: parent
    width: Math.min(600, parent.width - 64)
    height: Math.min(500, parent.height - 64)
    modal: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    padding: 0

    onClosed: {
        editingTagId = -1
        newTagName = ""
        newTagColor = colorPresets[0]
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
                    text: "标签管理"
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

                        // Create new tag section
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: Theme.Theme.spacingMd

                            Text {
                                text: "创建新标签"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.DemiBold
                                color: Theme.Theme.textSecondary
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: Theme.Theme.spacingSm

                                // Name input
                                TextField {
                                    id: newNameInput
                                    Layout.fillWidth: true
                                    Layout.preferredHeight: 40
                                    placeholderText: "标签名称"
                                    text: root.newTagName
                                    onTextChanged: root.newTagName = text

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
                                        if (newTagName.trim()) {
                                            root.tagCreated(newTagName.trim(), newTagColor)
                                            newTagName = ""
                                        }
                                    }
                                }

                                // Color picker button
                                Rectangle {
                                    width: 40
                                    height: 40
                                    radius: Theme.Theme.radiusLarge
                                    color: root.newTagColor
                                    border.width: 2
                                    border.color: colorPickerMouse.containsMouse ? "#ffffff" : "transparent"

                                    MouseArea {
                                        id: colorPickerMouse
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: newColorPopup.open()
                                    }

                                    // Color picker popup
                                    Popup {
                                        id: newColorPopup
                                        x: -120
                                        y: parent.height + 4
                                        width: 200
                                        padding: 8

                                        background: Rectangle {
                                            color: Theme.Theme.surface
                                            radius: Theme.Theme.radiusMedium
                                            border.width: 1
                                            border.color: Theme.Theme.border
                                        }

                                        GridLayout {
                                            columns: 4
                                            rowSpacing: 4
                                            columnSpacing: 4

                                            Repeater {
                                                model: root.colorPresets

                                                Rectangle {
                                                    width: 40
                                                    height: 40
                                                    radius: 8
                                                    color: modelData
                                                    border.width: root.newTagColor === modelData ? 3 : 0
                                                    border.color: "#ffffff"

                                                    MouseArea {
                                                        anchors.fill: parent
                                                        cursorShape: Qt.PointingHandCursor
                                                        onClicked: {
                                                            root.newTagColor = modelData
                                                            newColorPopup.close()
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // Create button
                                Button {
                                    Layout.preferredHeight: 40
                                    enabled: newTagName.trim().length > 0

                                    background: Rectangle {
                                        radius: Theme.Theme.radiusLarge
                                        color: parent.enabled
                                            ? (createBtnMouse.containsMouse ? Theme.Theme.primaryDark : Theme.Theme.primary)
                                            : Theme.Theme.element
                                        opacity: parent.enabled ? 1 : 0.5
                                    }

                                    contentItem: Text {
                                        text: "创建"
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        font.weight: Font.Medium
                                        color: parent.enabled ? "#ffffff" : Theme.Theme.textTertiary
                                        horizontalAlignment: Text.AlignHCenter
                                        verticalAlignment: Text.AlignVCenter
                                        leftPadding: 16
                                        rightPadding: 16
                                    }

                                    MouseArea {
                                        id: createBtnMouse
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: parent.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                                        onClicked: {
                                            if (newTagName.trim()) {
                                                root.tagCreated(newTagName.trim(), newTagColor)
                                                newTagName = ""
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Tag list section
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: Theme.Theme.spacingMd

                            Text {
                                text: "所有标签 (" + tags.length + ")"
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
                                visible: !loading && tags.length === 0
                                text: "暂无标签"
                                font.pixelSize: Theme.Theme.fontSizeMd
                                color: Theme.Theme.textTertiary
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }

                            // Tag list
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: Theme.Theme.spacingSm
                                visible: !loading && tags.length > 0

                                Repeater {
                                    model: root.tags

                                    delegate: TagListItem {
                                        Layout.fillWidth: true
                                        tagData: modelData
                                        isEditing: root.editingTagId === modelData.tagId
                                        editNameValue: root.editName
                                        editColorValue: root.editColor
                                        colorPresets: root.colorPresets

                                        onStartEdit: {
                                            root.editingTagId = modelData.tagId
                                            root.editName = modelData.tagName
                                            root.editColor = modelData.color || root.colorPresets[0]
                                        }
                                        onCancelEdit: {
                                            root.editingTagId = -1
                                        }
                                        onSaveEdit: function(name, color) {
                                            root.tagUpdated(modelData.tagId, name, color)
                                            root.editingTagId = -1
                                        }
                                        onDeleteTag: {
                                            root.tagDeleted(modelData.tagId)
                                        }
                                        onEditNameChanged: function(name) {
                                            root.editName = name
                                        }
                                        onEditColorChanged: function(color) {
                                            root.editColor = color
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

    // Tag list item component
    component TagListItem: Rectangle {
    id: tagItem

    property var tagData
    property bool isEditing: false
    property string editNameValue: ""
    property string editColorValue: ""
    property var colorPresets: []

    signal startEdit()
    signal cancelEdit()
    signal saveEdit(string name, string color)
    signal deleteTag()
    signal editNameChanged(string name)
    signal editColorChanged(string color)

    height: isEditing ? 100 : 52
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

        // Color indicator
        Rectangle {
            width: 16
            height: 16
            radius: 8
            color: tagData.color || "#6366F1"
        }

        // Tag name
        Text {
            Layout.fillWidth: true
            text: tagData.tagName
            font.pixelSize: Theme.Theme.fontSizeMd
            font.weight: Font.Medium
            color: Theme.Theme.textPrimary
            elide: Text.ElideRight
        }

        // Photo count
        Text {
            text: tagData.photoCount + " 张照片"
            font.pixelSize: Theme.Theme.fontSizeSm
            color: Theme.Theme.textTertiary
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
                onClicked: tagItem.startEdit()
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
                onClicked: tagItem.deleteTag()
            }
        }
    }

    // Edit mode
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8
        visible: isEditing

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            TextField {
                id: editNameField
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                text: editNameValue
                onTextChanged: tagItem.editNameChanged(text)

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

                Keys.onReturnPressed: {
                    if (editNameValue.trim()) {
                        tagItem.saveEdit(editNameValue.trim(), editColorValue)
                    }
                }
            }

            // Edit color picker
            Rectangle {
                width: 36
                height: 36
                radius: Theme.Theme.radiusMedium
                color: editColorValue
                border.width: 2
                border.color: editColorMouse.containsMouse ? "#ffffff" : "transparent"

                MouseArea {
                    id: editColorMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: editColorPopup.open()
                }

                Popup {
                    id: editColorPopup
                    x: -120
                    y: parent.height + 4
                    width: 200
                    padding: 8

                    background: Rectangle {
                        color: Theme.Theme.surface
                        radius: Theme.Theme.radiusMedium
                        border.width: 1
                        border.color: Theme.Theme.border
                    }

                    GridLayout {
                        columns: 4
                        rowSpacing: 4
                        columnSpacing: 4

                        Repeater {
                            model: tagItem.colorPresets

                            Rectangle {
                                width: 40
                                height: 40
                                radius: 8
                                color: modelData
                                border.width: editColorValue === modelData ? 3 : 0
                                border.color: "#ffffff"

                                MouseArea {
                                    anchors.fill: parent
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: {
                                        tagItem.editColorChanged(modelData)
                                        editColorPopup.close()
                                    }
                                }
                            }
                        }
                    }
                }
            }
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
                            tagItem.saveEdit(editNameValue.trim(), editColorValue)
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
                    onClicked: tagItem.cancelEdit()
                }
            }
        }
    }
    }
}
