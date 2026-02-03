import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt5Compat.GraphicalEffects
import "../theme" as Theme
import "../components"

Popup {
    id: root

    // Properties
    property var tags: []  // List of {tagId, tagName, color}

    // Signals
    signal searchRequested(var filters)
    signal panelClosed()

    // Internal state
    property string query: ""
    property string dateFrom: ""
    property string dateTo: ""
    property var selectedTagIds: []
    property int minRating: 0
    property bool favoritesOnly: false

    // Popup settings
    anchors.centerIn: parent
    width: parent ? Math.min(640, parent.width - 80) : 640
    height: parent ? Math.min(420, parent.height - 160) : 420
    modal: true
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside
    padding: 0

    onClosed: root.panelClosed()

    // Keyboard shortcuts
    Shortcut {
        sequence: "Escape"
        enabled: root.visible
        onActivated: root.close()
    }

    Shortcut {
        sequence: "Ctrl+Return"
        enabled: root.visible
        onActivated: performSearch()
    }

    function performSearch() {
        let filters = {}
        if (query.trim()) filters.query = query.trim()
        if (dateFrom) filters.dateFrom = dateFrom
        if (dateTo) filters.dateTo = dateTo
        if (selectedTagIds.length > 0) filters.tagIds = selectedTagIds
        if (minRating > 0) filters.minRating = minRating
        if (favoritesOnly) filters.favoritesOnly = true
        root.searchRequested(filters)
        root.close()
    }

    function clearFilters() {
        query = ""
        dateFrom = ""
        dateTo = ""
        selectedTagIds = []
        minRating = 0
        favoritesOnly = false
    }

    function toggleTag(tagId) {
        let idx = selectedTagIds.indexOf(tagId)
        if (idx >= 0) {
            selectedTagIds.splice(idx, 1)
        } else {
            selectedTagIds.push(tagId)
        }
        selectedTagIds = selectedTagIds.slice()  // Trigger binding update
    }

    readonly property bool hasFilters: query !== "" || dateFrom !== "" || dateTo !== "" ||
                                        selectedTagIds.length > 0 || minRating > 0 || favoritesOnly

    // Background overlay
    Overlay.modal: Rectangle {
        color: Qt.rgba(0, 0, 0, 0.5)

        Behavior on opacity {
            NumberAnimation { duration: Theme.Theme.durationNormal }
        }
    }

    // Panel background
    background: Rectangle {
        color: Theme.Theme.surface
        radius: Theme.Theme.radiusXLarge
        border.color: Theme.Theme.border
        border.width: 1

        layer.enabled: true
        layer.effect: DropShadow {
            transparentBorder: true
            horizontalOffset: 0
            verticalOffset: 6
            radius: 20
            samples: 21
            color: Qt.rgba(0, 0, 0, 0.2)
        }
    }

    // Enter animation
    enter: Transition {
        ParallelAnimation {
            NumberAnimation { property: "opacity"; from: 0; to: 1; duration: Theme.Theme.durationNormal }
            NumberAnimation { property: "y"; from: root.y - 16; to: root.y; duration: Theme.Theme.durationNormal; easing.type: Easing.OutCubic }
        }
    }

    // Exit animation
    exit: Transition {
        NumberAnimation { property: "opacity"; from: 1; to: 0; duration: Theme.Theme.durationFast }
    }

    contentItem: ColumnLayout {
        spacing: 0

        // Search input header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: "transparent"

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 24
                spacing: 16

                // Search icon
                Icon {
                    name: "search"
                    size: 20
                    color: Theme.Theme.textTertiary
                }

                // Search input
                TextField {
                    id: searchInput
                    Layout.fillWidth: true
                    placeholderText: "搜索照片..."
                    font.pixelSize: Theme.Theme.fontSizeXl
                    color: Theme.Theme.primary
                    placeholderTextColor: Theme.Theme.textTertiary
                    background: Item {}
                    text: root.query
                    onTextChanged: root.query = text

                    Component.onCompleted: forceActiveFocus()
                }

                // Close button
                Rectangle {
                    width: 36
                    height: 36
                    radius: Theme.Theme.radiusMedium
                    color: closeMouseArea.containsMouse ? Theme.Theme.element : "transparent"

                    Icon {
                        anchors.centerIn: parent
                        name: "close"
                        size: 16
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

        // Filters area (scrollable)
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            ScrollBar.vertical: ThemedScrollBar {}

            ColumnLayout {
                width: parent.width
                spacing: 20

                Item { Layout.preferredHeight: 24 }

                // Tags filter
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 12

                    Text {
                        text: "标签"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: Theme.Theme.textSecondary
                    }

                    Flow {
                        Layout.fillWidth: true
                        spacing: 8

                        Repeater {
                            model: root.tags
                            delegate: Rectangle {
                                width: tagText.implicitWidth + 24
                                height: 32
                                radius: 16
                                color: root.selectedTagIds.indexOf(modelData.tagId) >= 0
                                       ? Theme.Theme.primary
                                       : Theme.Theme.element
                                border.color: root.selectedTagIds.indexOf(modelData.tagId) >= 0
                                              ? "transparent"
                                              : Theme.Theme.border
                                border.width: 1

                                Text {
                                    id: tagText
                                    anchors.centerIn: parent
                                    text: modelData.tagName
                                    font.pixelSize: Theme.Theme.fontSizeSm
                                    font.weight: Font.Medium
                                    color: root.selectedTagIds.indexOf(modelData.tagId) >= 0
                                           ? "white"
                                           : Theme.Theme.textSecondary
                                }

                                MouseArea {
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: root.toggleTag(modelData.tagId)
                                }
                            }
                        }

                        // Empty state
                        Text {
                            visible: root.tags.length === 0
                            text: "暂无标签"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textTertiary
                        }
                    }
                }

                // Date range filter
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 8

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 16

                        // From date
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 8

                            Text {
                                text: "开始日期"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.Medium
                                color: Theme.Theme.textSecondary
                            }

                            Rectangle {
                                Layout.fillWidth: true
                                height: 36
                                radius: Theme.Theme.radiusMedium
                                color: Theme.Theme.element
                                border.color: dateFromInput.activeFocus ? Theme.Theme.primary : Theme.Theme.border
                                border.width: 1

                                RowLayout {
                                    anchors.fill: parent
                                    anchors.leftMargin: 12
                                    anchors.rightMargin: 10
                                    spacing: 8

                                    TextField {
                                        id: dateFromInput
                                        Layout.fillWidth: true
                                        placeholderText: "yyyy/mm/dd"
                                        text: root.dateFrom
                                        onTextChanged: root.dateFrom = text
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        color: Theme.Theme.textPrimary
                                        placeholderTextColor: Theme.Theme.textTertiary
                                        background: Item {}
                                    }

                                    Icon {
                                        name: "calendar"
                                        size: 16
                                        color: Theme.Theme.textTertiary
                                    }
                                }
                            }
                        }

                        // To date
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 8

                            Text {
                                text: "结束日期"
                                font.pixelSize: Theme.Theme.fontSizeSm
                                font.weight: Font.Medium
                                color: Theme.Theme.textSecondary
                            }

                            Rectangle {
                                Layout.fillWidth: true
                                height: 36
                                radius: Theme.Theme.radiusMedium
                                color: Theme.Theme.element
                                border.color: dateToInput.activeFocus ? Theme.Theme.primary : Theme.Theme.border
                                border.width: 1

                                RowLayout {
                                    anchors.fill: parent
                                    anchors.leftMargin: 12
                                    anchors.rightMargin: 10
                                    spacing: 8

                                    TextField {
                                        id: dateToInput
                                        Layout.fillWidth: true
                                        placeholderText: "yyyy/mm/dd"
                                        text: root.dateTo
                                        onTextChanged: root.dateTo = text
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        color: Theme.Theme.textPrimary
                                        placeholderTextColor: Theme.Theme.textTertiary
                                        background: Item {}
                                    }

                                    Icon {
                                        name: "calendar"
                                        size: 16
                                        color: Theme.Theme.textTertiary
                                    }
                                }
                            }
                        }
                    }
                }

                // Rating filter
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24
                    spacing: 12

                    Text {
                        text: "最低评分"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: Theme.Theme.textSecondary
                    }

                    RowLayout {
                        spacing: 4

                        Repeater {
                            model: 5
                            delegate: Rectangle {
                                width: 28
                                height: 28
                                radius: Theme.Theme.radiusSmall
                                color: "transparent"

                                Icon {
                                    anchors.centerIn: parent
                                    name: "star"
                                    size: 18
                                    filled: (index + 1) <= root.minRating
                                    color: (index + 1) <= root.minRating
                                           ? "#FACC15"
                                           : Theme.Theme.textTertiary
                                }

                                MouseArea {
                                    id: starMouseArea
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: {
                                        root.minRating = root.minRating === (index + 1) ? 0 : (index + 1)
                                    }
                                }
                            }
                        }

                        Text {
                            visible: root.minRating > 0
                            text: root.minRating + " 星及以上"
                            font.pixelSize: Theme.Theme.fontSizeSm
                            color: Theme.Theme.textSecondary
                            Layout.leftMargin: 8
                        }
                    }
                }

                // Favorites toggle
                RowLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 24
                    Layout.rightMargin: 24

                    Text {
                        text: "仅显示收藏"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: Theme.Theme.textSecondary
                        Layout.fillWidth: true
                    }

                    // Toggle switch
                    Rectangle {
                        width: 44
                        height: 22
                        radius: 11
                        color: root.favoritesOnly ? Theme.Theme.primary : Theme.Theme.element
                        border.color: root.favoritesOnly ? Theme.Theme.primary : Theme.Theme.border
                        border.width: 1

                        Behavior on color {
                            ColorAnimation { duration: Theme.Theme.durationFast }
                        }

                        Rectangle {
                            x: root.favoritesOnly ? parent.width - width - 2 : 2
                            y: 2
                            width: 18
                            height: 18
                            radius: 9
                            color: "white"

                            Behavior on x {
                                NumberAnimation { duration: Theme.Theme.durationFast }
                            }
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.favoritesOnly = !root.favoritesOnly
                        }
                    }
                }

                Item { Layout.preferredHeight: 24 }
            }
        }

        // Footer with actions
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: Qt.rgba(Theme.Theme.element.r, Theme.Theme.element.g, Theme.Theme.element.b, 0.5)

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

                // Clear filters button
                Rectangle {
                    Layout.preferredHeight: 32
                    Layout.preferredWidth: clearText.implicitWidth + 24
                    radius: Theme.Theme.radiusMedium
                    color: clearMouseArea.containsMouse && root.hasFilters ? Theme.Theme.element : "transparent"
                    opacity: root.hasFilters ? 1 : 0.5

                    Text {
                        id: clearText
                        anchors.centerIn: parent
                        text: "清除过滤器"
                        font.pixelSize: Theme.Theme.fontSizeSm
                        font.weight: Font.Medium
                        color: Theme.Theme.textSecondary
                    }

                    MouseArea {
                        id: clearMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: root.hasFilters ? Qt.PointingHandCursor : Qt.ForbiddenCursor
                        onClicked: if (root.hasFilters) root.clearFilters()
                    }
                }

                Item { Layout.fillWidth: true }

                // Shortcut hint
                Text {
                    text: "Ctrl+Enter 搜索"
                    font.pixelSize: Theme.Theme.fontSizeXs
                    color: Theme.Theme.textTertiary
                }

                // Search button
                Rectangle {
                    Layout.preferredHeight: 36
                    Layout.preferredWidth: searchBtnText.implicitWidth + 36
                    radius: Theme.Theme.radiusMedium
                    color: searchBtnMouseArea.containsMouse ? Theme.Theme.primaryDark : Theme.Theme.primary

                    Behavior on color {
                        ColorAnimation { duration: Theme.Theme.durationFast }
                    }

                    Text {
                        id: searchBtnText
                        anchors.centerIn: parent
                        text: "搜索"
                        font.pixelSize: Theme.Theme.fontSizeMd
                        font.weight: Font.Medium
                        color: "white"
                    }

                    MouseArea {
                        id: searchBtnMouseArea
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.performSearch()
                    }
                }
            }
        }
    }
}
