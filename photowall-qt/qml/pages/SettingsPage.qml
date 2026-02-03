import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt5Compat.GraphicalEffects
import "../components"
import "../theme" as Theme

Rectangle {
    id: root
    color: Theme.Theme.background

    property var settings: ({
        scan: { autoScan: true, scanInterval: 900, recursive: true, realtimeWatch: false },
        thumbnail: { cacheSizeMb: 1024, quality: 85 },
        performance: { scanThreads: 0, thumbnailThreads: 0 }
    })
    property var syncFolders: []
    property bool loading: false
    property bool saving: false
    property string activeSection: "sync"
    property bool scanIntervalOpen: false
    property bool autoScanRunning: false

    property int themeHue: 15
    property string themeMode: Theme.Theme.mode
    property var sectionOrder: ["sync", "appearance", "scan", "thumbnail", "performance"]

    onThemeModeChanged: Theme.Theme.setMode(themeMode)
    onThemeHueChanged: Theme.Theme.accentColor = hslToHex(themeHue, 64, 60)

    function sectionItem(sectionId) {
        if (sectionId === "sync") return section_sync
        if (sectionId === "appearance") return section_appearance
        if (sectionId === "scan") return section_scan
        if (sectionId === "thumbnail") return section_thumbnail
        if (sectionId === "performance") return section_performance
        return null
    }

    function scrollToSection(sectionId) {
        var section = sectionItem(sectionId)
        if (!section || !contentFlick) return
        var pos = section.mapToItem(contentFlick, 0, 0).y
        contentFlick.contentY = Math.max(0, pos - 24)
        activeSection = sectionId
    }

    function updateActiveSection() {
        if (!contentFlick) return
        var currentY = contentFlick.contentY
        var offset = 120
        var candidate = sectionOrder[0]
        for (var i = 0; i < sectionOrder.length; i++) {
            var id = sectionOrder[i]
            var section = sectionItem(id)
            if (!section) continue
            var top = section.mapToItem(contentFlick, 0, 0).y
            if (top - offset <= currentY) {
                candidate = id
            }
        }
        if (contentFlick.contentY + contentFlick.height >= contentFlick.contentHeight - 8) {
            candidate = sectionOrder[sectionOrder.length - 1]
        }
        if (activeSection !== candidate) {
            activeSection = candidate
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        ColumnLayout {
            Layout.leftMargin: 24
            Layout.rightMargin: 24
            Layout.topMargin: 24
            spacing: 6

            Text {
                text: "设置"
                font.pixelSize: 24
                font.weight: Font.DemiBold
                font.family: Theme.Theme.fontSerif
                color: Theme.Theme.textPrimary
            }
            Text {
                text: "管理您的应用程序设置和偏好。"
                font.pixelSize: Theme.Theme.fontSizeSm
                color: Theme.Theme.textSecondary
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.leftMargin: 24
            Layout.rightMargin: 24
            Layout.bottomMargin: 24
            spacing: 32

            ColumnLayout {
                Layout.alignment: Qt.AlignTop
                Layout.preferredWidth: 224
                Layout.maximumWidth: 224
                spacing: 6

                Repeater {
                    model: [
                        { id: "sync", label: "文件夹同步", icon: "folder_managed" },
                        { id: "appearance", label: "外观", icon: "contrast" },
                        { id: "scan", label: "照片扫描", icon: "image_search" },
                        { id: "thumbnail", label: "缩略图", icon: "photo_size_select_large" },
                        { id: "performance", label: "性能", icon: "speed" }
                    ]
                    delegate: Rectangle {
                        Layout.fillWidth: true
                        height: 36
                        radius: Theme.Theme.radiusMedium
                        color: root.activeSection === modelData.id
                               ? Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.12)
                               : "transparent"
                        border.width: root.activeSection === modelData.id ? 1 : 0
                        border.color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.2)

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            spacing: 12
                            Icon {
                                name: modelData.icon
                                size: 20
                                color: root.activeSection === modelData.id ? Theme.Theme.primary : Theme.Theme.textSecondary
                            }
                            Text {
                                text: modelData.label
                                font.pixelSize: 14
                                font.weight: root.activeSection === modelData.id ? Font.Medium : Font.Normal
                                color: root.activeSection === modelData.id ? Theme.Theme.primary : Theme.Theme.textSecondary
                            }
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: scrollToSection(modelData.id)
                        }
                    }
                }

                ColumnLayout {
                    Layout.topMargin: 24
                    spacing: 12
                    Layout.fillWidth: true

                    Button {
                        text: "保存设置"
                        Layout.fillWidth: true
                        Layout.preferredHeight: 36
                        background: Rectangle {
                            radius: Theme.Theme.radiusMedium
                            color: parent.down ? Theme.Theme.primaryDark : Theme.Theme.primary
                        }
                        contentItem: Text {
                            text: parent.text
                            color: "white"
                            font.weight: Font.Medium
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                    }

                    Button {
                        text: "恢复默认设置"
                        Layout.fillWidth: true
                        Layout.preferredHeight: 36
                        background: Rectangle {
                            radius: Theme.Theme.radiusMedium
                            color: parent.down ? Theme.Theme.hover : Theme.Theme.element
                            border.width: 1
                            border.color: Theme.Theme.border
                        }
                        contentItem: Text {
                            text: parent.text
                            color: Theme.Theme.textSecondary
                            font.weight: Font.Medium
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                    }
                }
            }

            Flickable {
                id: contentFlick
                Layout.fillWidth: true
                Layout.fillHeight: true
                clip: true
                contentWidth: width
                contentHeight: contentColumn.implicitHeight + 24
                boundsBehavior: Flickable.StopAtBounds
                onContentYChanged: updateActiveSection()

                Behavior on contentY {
                    NumberAnimation { duration: 220; easing.type: Easing.InOutQuad }
                }

                ScrollBar.vertical: ThemedScrollBar {}

                ColumnLayout {
                    id: contentColumn
                    width: Math.min(contentFlick.width, 896)
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 24

                    SettingsCard {
                        id: section_sync
                        title: "文件夹同步"
                        description: "管理自动扫描新照片的文件夹。"

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 12

                            ListView {
                                Layout.fillWidth: true
                                implicitHeight: contentHeight
                                height: contentHeight
                                spacing: 8
                                visible: syncFolders.length > 0
                                model: syncFolders
                                delegate: Rectangle {
                                    width: ListView.view.width
                                    height: 56
                                    radius: Theme.Theme.radiusLarge
                                    color: Theme.Theme.surface
                                    border.width: 1
                                    border.color: Theme.Theme.border

                                    RowLayout {
                                        anchors.fill: parent
                                        anchors.margins: 12
                                        spacing: 12

                                        Icon {
                                            name: "folder"
                                            size: 24
                                            color: Theme.Theme.primary
                                            filled: true
                                        }

                                        ColumnLayout {
                                            Layout.fillWidth: true
                                            spacing: 2
                                            Text {
                                                text: modelData.path || modelData
                                                font.pixelSize: 14
                                                font.weight: Font.Medium
                                                color: Theme.Theme.textPrimary
                                                elide: Text.ElideMiddle
                                                Layout.fillWidth: true
                                            }
                                        }

                                        Button {
                                            Layout.preferredWidth: 32
                                            Layout.preferredHeight: 32
                                            contentItem: Icon {
                                                anchors.centerIn: parent
                                                name: "delete"
                                                size: 18
                                                color: parent.hovered ? Theme.Theme.danger : Theme.Theme.textTertiary
                                            }
                                            background: Rectangle {
                                                color: parent.hovered
                                                       ? Qt.rgba(Theme.Theme.danger.r, Theme.Theme.danger.g, Theme.Theme.danger.b, 0.1)
                                                       : "transparent"
                                                radius: 16
                                            }
                                        }
                                    }
                                }
                            }

                            Rectangle {
                                visible: syncFolders.length === 0
                                Layout.fillWidth: true
                                height: 160
                                radius: Theme.Theme.radiusXLarge
                                color: "transparent"
                                border.width: 2
                                border.color: Qt.rgba(Theme.Theme.border.r, Theme.Theme.border.g, Theme.Theme.border.b, 0.5)

                                ColumnLayout {
                                    anchors.centerIn: parent
                                    spacing: 8
                                    Icon {
                                        name: "folder_off"
                                        size: 36
                                        color: Qt.rgba(Theme.Theme.textTertiary.r, Theme.Theme.textTertiary.g, Theme.Theme.textTertiary.b, 0.5)
                                        Layout.alignment: Qt.AlignHCenter
                                    }
                                    Text {
                                        text: "尚未添加同步文件夹"
                                        font.pixelSize: 14
                                        color: Theme.Theme.textSecondary
                                        Layout.alignment: Qt.AlignHCenter
                                    }
                                }
                            }

                            RowLayout {
                                spacing: 12

                                Button {
                                    text: "添加文件夹"
                                    background: Rectangle {
                                        radius: Theme.Theme.radiusMedium
                                        color: parent.down ? Theme.Theme.primaryDark : Theme.Theme.primary
                                    }
                                    contentItem: RowLayout {
                                        spacing: 8
                                        anchors.centerIn: parent
                                        Icon { name: "add"; size: 18; color: "white" }
                                        Text {
                                            text: "添加文件夹"
                                            color: "white"
                                            font.weight: Font.Medium
                                        }
                                    }
                                    Layout.preferredHeight: 36
                                    Layout.preferredWidth: 140
                                }

                                Button {
                                    text: syncFolders.length > 0 ? "立即同步 (" + syncFolders.length + " 个文件夹)" : "立即同步"
                                    enabled: syncFolders.length > 0
                                    background: Rectangle {
                                        radius: Theme.Theme.radiusMedium
                                        color: parent.down ? Theme.Theme.hover : Theme.Theme.element
                                        border.width: 1
                                        border.color: Theme.Theme.border
                                    }
                                    contentItem: RowLayout {
                                        spacing: 8
                                        anchors.centerIn: parent
                                        Icon { name: "sync"; size: 18; color: Theme.Theme.textSecondary }
                                        Text {
                                            text: parent.parent.text
                                            color: Theme.Theme.textSecondary
                                            font.weight: Font.Medium
                                        }
                                    }
                                    Layout.preferredHeight: 36
                                    Layout.preferredWidth: 220
                                }
                            }
                        }
                    }

                    SettingsCard {
                        id: section_appearance
                        title: "外观"
                        description: "个性化您的应用程序主题。"
                        titleSize: 28
                        titleFontFamily: Theme.Theme.fontSerif
                        contentPadding: 32

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 32

                            ColumnLayout {
                                spacing: 12
                                Layout.fillWidth: true

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 16
                                    Text {
                                        text: "主题模式"
                                        font.pixelSize: Theme.Theme.fontSizeMd
                                        font.weight: Font.Medium
                                        color: Theme.Theme.textPrimary
                                        Layout.fillWidth: true
                                    }

                                    Item {
                                        Layout.preferredWidth: 280
                                        Layout.preferredHeight: 40
                                        Layout.alignment: Qt.AlignRight | Qt.AlignVCenter

                                        Rectangle {
                                            anchors.right: parent.right
                                            anchors.verticalCenter: parent.verticalCenter
                                            width: parent.width
                                            height: parent.height
                                            color: Theme.Theme.surface
                                            border.color: Theme.Theme.border
                                            border.width: 1
                                            radius: height / 2

                                            RowLayout {
                                                anchors.fill: parent
                                                anchors.margins: 4
                                                spacing: 4
                                                Repeater {
                                                    model: [
                                                        { id: "light", label: "浅色", icon: "light_mode" },
                                                        { id: "system", label: "自动", icon: "settings_brightness" },
                                                        { id: "dark", label: "深色", icon: "dark_mode" }
                                                    ]
                                                    delegate: Rectangle {
                                                        Layout.fillWidth: true
                                                        Layout.preferredHeight: 30
                                                        radius: height / 2
                                                        color: themeMode === modelData.id ? Theme.Theme.primary : "transparent"
                                                        RowLayout {
                                                            anchors.centerIn: parent
                                                            spacing: 6
                                                            Icon { name: modelData.icon; size: 16; color: themeMode === modelData.id ? "white" : Theme.Theme.textSecondary }
                                                            Text { text: modelData.label; font.pixelSize: 13; font.weight: Font.Medium; color: themeMode === modelData.id ? "white" : Theme.Theme.textSecondary }
                                                        }
                                                        MouseArea {
                                                            anchors.fill: parent
                                                            cursorShape: Qt.PointingHandCursor
                                                            onClicked: themeMode = modelData.id
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Text {
                                    text: "选择浅色、深色模式或跟随系统设置。深色模式经过专门优化，提供舒适的沉浸式体验。"
                                    font.pixelSize: 13
                                    color: Theme.Theme.textSecondary
                                    lineHeight: 20
                                    lineHeightMode: Text.FixedHeight
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                            }

                            Rectangle { Layout.fillWidth: true; height: 1; color: Theme.Theme.border; opacity: 0.5 }

                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 16

                                RowLayout {
                                    Text { text: "主题颜色"; font.pixelSize: 16; font.weight: Font.Medium; color: Theme.Theme.textPrimary; Layout.fillWidth: true }
                                    Rectangle {
                                        width: 70; height: 24; radius: 4; color: Theme.Theme.element; border.width: 1; border.color: Theme.Theme.border
                                        Text { anchors.centerIn: parent; text: hslToHex(themeHue, 64, 60).toUpperCase(); font.pixelSize: 12; font.family: "Monospace"; color: Theme.Theme.textSecondary }
                                    }
                                }

                                Rectangle {
                                    Layout.fillWidth: true
                                    height: 40
                                    radius: 12
                                    border.width: 1
                                    border.color: Qt.rgba(Theme.Theme.border.r, Theme.Theme.border.g, Theme.Theme.border.b, 0.5)
                                    color: Theme.Theme.surface

                                    Rectangle {
                                        anchors.fill: parent
                                        anchors.margins: 4
                                        radius: 8
                                        gradient: Gradient {
                                            orientation: Gradient.Horizontal
                                            GradientStop { position: 0.0; color: "#f87171" }
                                            GradientStop { position: 0.14; color: "#fb923c" }
                                            GradientStop { position: 0.28; color: "#fbbf24" }
                                            GradientStop { position: 0.42; color: "#a3e635" }
                                            GradientStop { position: 0.57; color: "#2dd4bf" }
                                            GradientStop { position: 0.71; color: "#38bdf8" }
                                            GradientStop { position: 0.85; color: "#818cf8" }
                                            GradientStop { position: 1.0; color: "#f472b6" }
                                        }

                                        MouseArea {
                                            anchors.fill: parent
                                            cursorShape: Qt.PointingHandCursor

                                            function updateHue(mouseX) {
                                                var percent = Math.max(0, Math.min(1, mouseX / width))
                                                themeHue = Math.round(percent * 360)
                                            }

                                            onPressed: { updateHue(mouse.x) }
                                            onPositionChanged: { updateHue(mouse.x) }

                                            Rectangle {
                                                x: (themeHue / 360) * parent.width - width / 2
                                                anchors.verticalCenter: parent.verticalCenter
                                                width: 24; height: 24; radius: 12
                                                color: "white"
                                                border.width: 2
                                                border.color: "white"

                                                layer.enabled: true
                                                layer.effect: DropShadow {
                                                    transparentBorder: true
                                                    radius: 8; samples: 16
                                                    color: "#40000000"
                                                }
                                            }
                                        }
                                    }
                                }

                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 12

                                    Rectangle {
                                        Layout.fillWidth: true
                                        height: 80
                                        radius: Theme.Theme.radiusLarge
                                        color: Theme.Theme.surface
                                        border.width: 1
                                        border.color: Theme.Theme.border
                                        Rectangle {
                                            anchors.centerIn: parent
                                            width: 36
                                            height: 36
                                            radius: 18
                                            color: Theme.Theme.primary
                                        }
                                    }

                                    Rectangle {
                                        Layout.fillWidth: true
                                        height: 80
                                        radius: Theme.Theme.radiusLarge
                                        color: Theme.Theme.primary
                                        border.width: 1
                                        border.color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.3)
                                        ColumnLayout {
                                            anchors.centerIn: parent
                                            spacing: 6
                                            Icon { name: "check"; size: 18; color: "white" }
                                            Text { text: "Active"; font.pixelSize: 11; color: "white" }
                                        }
                                    }

                                    Rectangle {
                                        Layout.fillWidth: true
                                        height: 80
                                        radius: Theme.Theme.radiusLarge
                                        color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.06)
                                        border.width: 1
                                        border.color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.3)
                                        RowLayout {
                                            anchors.centerIn: parent
                                            spacing: 6
                                            Icon { name: "palette"; size: 16; color: Theme.Theme.primary }
                                            Text { text: "Accent"; font.pixelSize: 12; color: Theme.Theme.primary }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    SettingsCard {
                        id: section_scan
                        title: "照片扫描"
                        description: "配置应用程序如何查找和处理您的照片。"

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 16

                            SettingRow {
                                title: "自动扫描"
                                description: "定期自动检查同步文件夹中的新照片。"
                                ToggleSwitch {
                                    checked: settings.scan.autoScan
                                    onToggled: { settings.scan.autoScan = value }
                                }
                            }

                            SettingRow {
                                visible: settings.scan.autoScan
                                title: "扫描间隔"
                                description: "自动扫描的时间间隔（分钟）。"
                                Rectangle {
                                    width: 140
                                    height: 32
                                    radius: Theme.Theme.radiusMedium
                                    color: Theme.Theme.button
                                    border.width: 1
                                    border.color: Theme.Theme.border

                                    RowLayout {
                                        anchors.centerIn: parent
                                        spacing: 6
                                        Text {
                                            text: settings.scan.scanInterval / 60 >= 60
                                                  ? (settings.scan.scanInterval / 3600) + " 小时"
                                                  : (settings.scan.scanInterval / 60) + " 分钟"
                                            font.pixelSize: 13
                                            color: Theme.Theme.textPrimary
                                        }
                                        Icon { name: "expand_more"; size: 16; color: Theme.Theme.textSecondary }
                                    }

                                    MouseArea {
                                        anchors.fill: parent
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: scanIntervalOpen = !scanIntervalOpen
                                    }
                                }
                            }

                            Rectangle {
                                id: scanIntervalPanel
                                visible: scanIntervalOpen
                                Layout.fillWidth: true
                                implicitHeight: scanIntervalColumn.implicitHeight + 16
                                radius: Theme.Theme.radiusMedium
                                color: Theme.Theme.surface
                                border.width: 1
                                border.color: Theme.Theme.border

                                ColumnLayout {
                                    id: scanIntervalColumn
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    spacing: 4
                                    Repeater {
                                        model: [
                                            { value: 5, label: "5 分钟" },
                                            { value: 10, label: "10 分钟" },
                                            { value: 15, label: "15 分钟" },
                                            { value: 30, label: "30 分钟" },
                                            { value: 60, label: "1 小时" },
                                            { value: 120, label: "2 小时" }
                                        ]
                                        delegate: Rectangle {
                                            Layout.fillWidth: true
                                            height: 32
                                            radius: Theme.Theme.radiusSmall
                                            color: settings.scan.scanInterval / 60 === modelData.value
                                                   ? Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.1)
                                                   : "transparent"
                                            RowLayout {
                                                anchors.fill: parent
                                                anchors.leftMargin: 8
                                                Text {
                                                    text: modelData.label
                                                    font.pixelSize: 13
                                                    color: settings.scan.scanInterval / 60 === modelData.value
                                                           ? Theme.Theme.primary
                                                           : Theme.Theme.textSecondary
                                                }
                                            }
                                            MouseArea {
                                                anchors.fill: parent
                                                cursorShape: Qt.PointingHandCursor
                                                onClicked: {
                                                    settings.scan.scanInterval = modelData.value * 60
                                                    scanIntervalOpen = false
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            SettingRow {
                                title: "递归扫描子文件夹"
                                description: "扫描时包含所有子文件夹。"
                                ToggleSwitch {
                                    checked: settings.scan.recursive
                                    onToggled: { settings.scan.recursive = value }
                                }
                            }

                            Rectangle {
                                id: scanServiceCard
                                Layout.fillWidth: true
                                implicitHeight: scanServiceColumn.implicitHeight + 32
                                radius: Theme.Theme.radiusLarge
                                color: Theme.Theme.surface
                                border.width: 1
                                border.color: Theme.Theme.border

                                ColumnLayout {
                                    id: scanServiceColumn
                                    anchors.fill: parent
                                    anchors.margins: 16
                                    spacing: 12

                                    RowLayout {
                                        Layout.fillWidth: true
                                        spacing: 16
                                        ColumnLayout {
                                            Layout.fillWidth: true
                                            spacing: 4
                                            Text { text: "自动扫描服务"; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary }
                                            Text { text: "智能定时扫描（阶梯式频率）"; font.pixelSize: 12; color: Theme.Theme.textSecondary }
                                        }
                                        Item {
                                            Layout.preferredWidth: 220
                                            Layout.alignment: Qt.AlignRight | Qt.AlignVCenter
                                            RowLayout {
                                                anchors.right: parent.right
                                                anchors.verticalCenter: parent.verticalCenter
                                                spacing: 12
                                                Rectangle {
                                                    height: 24
                                                    radius: 12
                                                    color: autoScanRunning ? Qt.rgba(Theme.Theme.success.r, Theme.Theme.success.g, Theme.Theme.success.b, 0.2)
                                                                          : Qt.rgba(Theme.Theme.textSecondary.r, Theme.Theme.textSecondary.g, Theme.Theme.textSecondary.b, 0.2)
                                                    RowLayout {
                                                        anchors.centerIn: parent
                                                        spacing: 6
                                                        Rectangle {
                                                            width: 8; height: 8; radius: 4
                                                            color: autoScanRunning ? Theme.Theme.success : Theme.Theme.textSecondary
                                                        }
                                                        Text {
                                                            text: autoScanRunning ? "运行中" : "已停止"
                                                            font.pixelSize: 11
                                                            color: autoScanRunning ? Theme.Theme.success : Theme.Theme.textSecondary
                                                        }
                                                    }
                                                }
                                                Button {
                                                    text: autoScanRunning ? "停止" : "启动"
                                                    Layout.preferredHeight: 28
                                                    background: Rectangle {
                                                        radius: Theme.Theme.radiusMedium
                                                        color: autoScanRunning
                                                               ? Qt.rgba(Theme.Theme.danger.r, Theme.Theme.danger.g, Theme.Theme.danger.b, 0.15)
                                                               : Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.15)
                                                    }
                                                    contentItem: Text {
                                                        text: parent.text
                                                        font.pixelSize: 12
                                                        color: autoScanRunning ? Theme.Theme.danger : Theme.Theme.primary
                                                        horizontalAlignment: Text.AlignHCenter
                                                        verticalAlignment: Text.AlignVCenter
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    Rectangle { height: 1; Layout.fillWidth: true; color: Theme.Theme.border; opacity: 0.5 }

                                    SettingRow {
                                        title: "实时监控"
                                        description: "监控文件变化，新建/修改/删除时立即响应。"
                                        ToggleSwitch {
                                            checked: settings.scan.realtimeWatch
                                            onToggled: { settings.scan.realtimeWatch = value }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    SettingsCard {
                        id: section_thumbnail
                        title: "缩略图"
                        description: "配置缩略图生成和缓存设置。"

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 20

                            ColumnLayout {
                                spacing: 8
                                Layout.fillWidth: true
                                RowLayout {
                                    Layout.fillWidth: true
                                    Text { text: "缓存大小限制"; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary; Layout.fillWidth: true }
                                    Text { text: settings.thumbnail.cacheSizeMb + " MB"; font.pixelSize: 12; color: Theme.Theme.textSecondary }
                                }
                                Text {
                                    text: "较大的缓存可以加快浏览速度，但会占用更多磁盘空间。"
                                    font.pixelSize: 12
                                    color: Theme.Theme.textSecondary
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                                ThemedSlider {
                                    from: 100
                                    to: 10000
                                    stepSize: 100
                                    value: settings.thumbnail.cacheSizeMb
                                    onValueChanged: settings.thumbnail.cacheSizeMb = Math.round(value / 100) * 100
                                }
                            }

                            ColumnLayout {
                                spacing: 8
                                Layout.fillWidth: true
                                RowLayout {
                                    Layout.fillWidth: true
                                    Text { text: "缩略图质量"; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary; Layout.fillWidth: true }
                                    Text { text: settings.thumbnail.quality + "%"; font.pixelSize: 12; color: Theme.Theme.textSecondary }
                                }
                                Text {
                                    text: "更高的质量生成更清晰的缩略图，但会占用更多存储空间。"
                                    font.pixelSize: 12
                                    color: Theme.Theme.textSecondary
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                                ThemedSlider {
                                    from: 50
                                    to: 100
                                    stepSize: 1
                                    value: settings.thumbnail.quality
                                    onValueChanged: settings.thumbnail.quality = Math.round(value)
                                }
                            }
                        }
                    }

                    SettingsCard {
                        id: section_performance
                        title: "性能"
                        description: "调整设置以优化应用程序的速度和资源使用。"

                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 20

                            SettingRow {
                                title: "高刷模式 (120Hz)"
                                description: "减少特效，优先保证滚动与切换的帧率稳定。"
                                ToggleSwitch {
                                    checked: true
                                }
                            }

                            ColumnLayout {
                                spacing: 8
                                Layout.fillWidth: true
                                RowLayout {
                                    Layout.fillWidth: true
                                    Text { text: "扫描线程数"; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary; Layout.fillWidth: true }
                                    Text {
                                        text: settings.performance.scanThreads === 0 ? "自动" : settings.performance.scanThreads
                                        font.pixelSize: 12
                                        color: Theme.Theme.textSecondary
                                    }
                                }
                                Text {
                                    text: "用于扫描照片的线程数。设置为 0 则自动设置。"
                                    font.pixelSize: 12
                                    color: Theme.Theme.textSecondary
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                                ThemedSlider {
                                    from: 0
                                    to: 16
                                    stepSize: 1
                                    value: settings.performance.scanThreads
                                    onValueChanged: settings.performance.scanThreads = Math.round(value)
                                }
                            }

                            ColumnLayout {
                                spacing: 8
                                Layout.fillWidth: true
                                RowLayout {
                                    Layout.fillWidth: true
                                    Text { text: "缩略图线程数"; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary; Layout.fillWidth: true }
                                    Text {
                                        text: settings.performance.thumbnailThreads === 0 ? "自动" : settings.performance.thumbnailThreads
                                        font.pixelSize: 12
                                        color: Theme.Theme.textSecondary
                                    }
                                }
                                Text {
                                    text: "用于生成缩略图的线程数。设置为 0 则自动设置。"
                                    font.pixelSize: 12
                                    color: Theme.Theme.textSecondary
                                    wrapMode: Text.WordWrap
                                    Layout.fillWidth: true
                                }
                                ThemedSlider {
                                    from: 0
                                    to: 16
                                    stepSize: 1
                                    value: settings.performance.thumbnailThreads
                                    onValueChanged: settings.performance.thumbnailThreads = Math.round(value)
                                }
                            }
                        }
                    }

                    Item { Layout.preferredHeight: 80 }
                }
            }
        }
    }

    component SettingsCard: Rectangle {
        property string title: ""
        property string description: ""
        property int titleSize: 18
        property string titleFontFamily: Theme.Theme.fontSans
        property int contentPadding: 24
        default property alias content: innerLayout.data

        Layout.fillWidth: true
        implicitHeight: contentColumn.implicitHeight + contentPadding * 2

        color: Theme.Theme.surface
        radius: Theme.Theme.radiusXLarge
        border.width: 1
        border.color: Theme.Theme.border

        layer.enabled: !Theme.Theme.darkMode
        layer.effect: DropShadow {
            transparentBorder: true
            horizontalOffset: 0
            verticalOffset: 1
            radius: 6
            samples: 8
            color: Qt.rgba(0, 0, 0, 0.04)
        }

        ColumnLayout {
            id: contentColumn
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: contentPadding
            spacing: 24

            ColumnLayout {
                spacing: 2
                Layout.fillWidth: true
                Text {
                    text: title
                    font.pixelSize: titleSize
                    font.weight: Font.DemiBold
                    font.family: titleFontFamily
                    color: Theme.Theme.textPrimary
                    Layout.fillWidth: true
                }
                Text {
                    text: description
                    font.pixelSize: Theme.Theme.fontSizeSm
                    color: Theme.Theme.textSecondary
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }

            ColumnLayout {
                id: innerLayout
                Layout.fillWidth: true
                spacing: 16
            }
        }
    }

    component SettingRow: Item {
        property string title: ""
        property string description: ""
        property int trailingWidth: 220
        default property alias trailing: trailingSlot.data
        implicitHeight: rowLayout.implicitHeight
        Layout.fillWidth: true

        RowLayout {
            id: rowLayout
            width: parent.width
            spacing: 16
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                Text { text: title; font.pixelSize: 14; font.weight: Font.Medium; color: Theme.Theme.textPrimary }
                Text { text: description; font.pixelSize: 12; color: Theme.Theme.textSecondary; wrapMode: Text.WordWrap }
            }
            Item {
                Layout.preferredWidth: trailingWidth
                Layout.alignment: Qt.AlignRight | Qt.AlignVCenter
                RowLayout {
                    id: trailingSlot
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: 12
                }
            }
        }
    }

    component ToggleSwitch: Item {
        id: toggle
        property bool checked: false
        signal toggled(bool value)
        width: 44
        height: 24

        Rectangle {
            anchors.fill: parent
            radius: height / 2
            color: checked ? Theme.Theme.primary : Theme.Theme.element
            border.width: 1
            border.color: Theme.Theme.border
        }

        Rectangle {
            width: 20
            height: 20
            radius: 10
            x: checked ? parent.width - width - 2 : 2
            y: 2
            color: "white"
            Behavior on x { NumberAnimation { duration: 160; easing.type: Easing.InOutQuad } }
        }

        MouseArea {
            anchors.fill: parent
            cursorShape: Qt.PointingHandCursor
            onClicked: {
                toggle.checked = !toggle.checked
                toggle.toggled(toggle.checked)
            }
        }
    }

    component ThemedSlider: Slider {
        id: slider
        implicitHeight: 24

        background: Rectangle {
            x: 0
            y: (parent.height - 6) / 2
            width: parent.availableWidth
            height: 6
            radius: 3
            color: Qt.rgba(Theme.Theme.textSecondary.r, Theme.Theme.textSecondary.g, Theme.Theme.textSecondary.b, 0.2)

            Rectangle {
                width: parent.width * slider.visualPosition
                height: parent.height
                radius: 3
                color: Theme.Theme.primary
            }
        }

        handle: Rectangle {
            width: 16
            height: 16
            radius: 8
            x: slider.visualPosition * (parent.availableWidth - width)
            y: (parent.height - height) / 2
            color: "white"
            border.width: 2
            border.color: Theme.Theme.primary
            layer.enabled: true
            layer.effect: DropShadow {
                transparentBorder: true
                radius: 6
                samples: 12
                color: Qt.rgba(0, 0, 0, 0.18)
            }
        }
    }

    function hslToHex(h, s, l) {
        s /= 100
        l /= 100
        var a = s * Math.min(l, 1 - l)
        var f = function(n) {
            var k = (n + h / 30) % 12
            var color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
            return Math.round(255 * color).toString(16).padStart(2, "0")
        }
        return "#" + f(0) + f(8) + f(4)
    }
}
