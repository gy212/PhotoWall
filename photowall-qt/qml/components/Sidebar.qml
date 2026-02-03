import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt5Compat.GraphicalEffects
import "../theme" as Theme

Rectangle {
    id: root

    // Properties
    property string activeItem: "photos"  // "photos", "albums", "favorites", "folders", "trash", "settings"
    property int photoCount: 0
    property int favoriteCount: 0
    property int trashCount: 0
    property bool indexing: false
    property real indexProgress: 0.0
    property string indexCurrentFile: ""

    // Signals
    signal navigationRequested(string itemId)

    // Appearance
    color: Theme.Theme.sidebar
    implicitWidth: 200

    // Navigation items data
    readonly property var libraryItems: [
        { id: "photos", label: "所有照片", icon: "photos", countProp: "photoCount" },
        { id: "albums", label: "相册", icon: "albums", countProp: "" },
        { id: "favorites", label: "收藏", icon: "favorites_outline", countProp: "favoriteCount" }
    ]

    readonly property var fileItems: [
        { id: "folders", label: "文件夹", icon: "folder", countProp: "" },
        { id: "trash", label: "回收站", icon: "delete", countProp: "trashCount" }
    ]

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 0

        // Library section
        Text {
            text: "媒体库"
            font.pixelSize: 11 // Web uses 11px
            font.bold: true
            font.capitalization: Font.AllUppercase
            font.letterSpacing: 1.5
            color: Theme.Theme.textSecondary
            Layout.leftMargin: 12
            Layout.topMargin: 8
            Layout.bottomMargin: 6
        }

        // Library navigation items
        Repeater {
            model: root.libraryItems
            delegate: NavItem {
                Layout.fillWidth: true
                itemId: modelData.id
                label: modelData.label
                icon: modelData.icon
                count: modelData.countProp === "photoCount" ? root.photoCount
                     : modelData.countProp === "favoriteCount" ? root.favoriteCount
                     : 0
                showCount: modelData.countProp !== ""
                isActive: root.activeItem === modelData.id
                onClicked: root.navigationRequested(modelData.id)
            }
        }

        // Spacer between sections
        Item { Layout.preferredHeight: 12 }

        // File Management section
        Text {
            text: "文件管理"
            font.pixelSize: 11
            font.bold: true
            font.capitalization: Font.AllUppercase
            font.letterSpacing: 1.5
            color: Theme.Theme.textSecondary
            Layout.leftMargin: 12
            Layout.bottomMargin: 6
        }

        // File management navigation items
        Repeater {
            model: root.fileItems
            delegate: NavItem {
                Layout.fillWidth: true
                itemId: modelData.id
                label: modelData.label
                icon: modelData.icon
                count: modelData.countProp === "trashCount" ? root.trashCount : 0
                showCount: modelData.countProp !== ""
                isActive: root.activeItem === modelData.id
                onClicked: root.navigationRequested(modelData.id)
            }
        }

        // Flexible spacer
        Item { Layout.fillHeight: true }

        // Indexing progress
        ColumnLayout {
            visible: root.indexing
            Layout.fillWidth: true
            Layout.leftMargin: 12
            Layout.rightMargin: 12
            spacing: 4

            Text {
                text: "索引中..."
                font.pixelSize: Theme.Theme.fontSizeSm
                font.italic: true
                color: Theme.Theme.textSecondary
            }

            ProgressBar {
                Layout.fillWidth: true
                value: root.indexProgress
                from: 0
                to: 1

                background: Rectangle {
                    implicitHeight: 4
                    color: Theme.Theme.element
                    radius: 2
                }

                contentItem: Item {
                    Rectangle {
                        width: parent.width * root.indexProgress
                        height: parent.height
                        radius: 2
                        color: Theme.Theme.primary
                    }
                }
            }

            Text {
                text: root.indexCurrentFile
                font.pixelSize: Theme.Theme.fontSizeXs
                color: Theme.Theme.textTertiary
                elide: Text.ElideMiddle
                Layout.fillWidth: true
            }
        }

        // Settings button
        NavItem {
            Layout.fillWidth: true
            Layout.topMargin: 8
            Layout.bottomMargin: 4
            itemId: "settings"
            label: "设置"
            icon: "settings"
            showCount: false
            isActive: root.activeItem === "settings"
            rotateIconOnHover: true
            onClicked: root.navigationRequested("settings")
        }
    }

    // NavItem component
    component NavItem: Rectangle {
        id: navItem

        property string itemId: ""
        property string label: ""
        property string icon: ""
        property int count: 0
        property bool showCount: false
        property bool isActive: false
        property bool rotateIconOnHover: false

        signal clicked()

        implicitHeight: 36
        radius: 6 // Web uses 0.375rem = 6px (or 8px depending on theme) -> Web uses rounded-md (0.375rem = 6px)
        
        // Background logic
        color: isActive
               ? (Theme.Theme.darkMode 
                  ? Qt.rgba(232/255, 149/255, 122/255, 0.15) 
                  : Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.08)) // Soft highlight
               : (navMouseArea.containsMouse ? Theme.Theme.element : "transparent")

        // Border
        border.color: "transparent"
        border.width: 0

        // Shadow
        layer.enabled: false

        Behavior on color {
            ColorAnimation { duration: Theme.Theme.durationNormal }
        }

        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12
            anchors.rightMargin: 12
            spacing: 12

            // Icon
            Icon {
                id: navIcon
                name: navItem.icon
                size: 18 // Web uses w-[18px]
                
                // Color logic:
                // Active: Primary
                // Inactive: Tertiary -> Hover: Secondary
                color: isActive 
                       ? Theme.Theme.primary 
                       : (navMouseArea.containsMouse ? Theme.Theme.textSecondary : Theme.Theme.textTertiary)

                rotation: navItem.rotateIconOnHover && navMouseArea.containsMouse && !isActive ? 45 : 0
                Behavior on rotation {
                    NumberAnimation { duration: Theme.Theme.durationNormal }
                }
                Behavior on color {
                    ColorAnimation { duration: Theme.Theme.durationNormal }
                }
            }

            // Label
            Text {
                Layout.fillWidth: true
                text: navItem.label
                font.pixelSize: 13
                font.weight: isActive ? Font.Medium : Font.Normal
                // Active: Primary (Web says text-primary for active, but let's check... 
                // Web: isActive ? "text-primary" : "text-secondary hover:text-primary")
                // Wait, Web active text color is `text-primary` (dark grey/white), NOT brand color.
                // Only the Icon is brand color.
                
                color: isActive 
                       ? Theme.Theme.textPrimary // Web matches this
                       : (navMouseArea.containsMouse ? Theme.Theme.textPrimary : Theme.Theme.textSecondary)
                       
                elide: Text.ElideRight

                Behavior on color {
                    ColorAnimation { duration: Theme.Theme.durationNormal }
                }
            }

            // Count badge
            Rectangle {
                visible: navItem.showCount && navItem.count > 0
                Layout.preferredWidth: badgeText.implicitWidth + 12
                Layout.preferredHeight: 18
                radius: 9
                // Badge color logic
                color: isActive 
                       ? (Theme.Theme.darkMode ? Qt.rgba(232/255, 149/255, 122/255, 0.15) : Qt.rgba(218/255, 119/255, 86/255, 0.1)) 
                       : (navMouseArea.containsMouse ? Theme.Theme.surface : Theme.Theme.element)

                Text {
                    id: badgeText
                    anchors.centerIn: parent
                    text: navItem.count > 999 ? "999+" : navItem.count.toString()
                    font.pixelSize: 10
                    font.bold: true
                    color: isActive ? Theme.Theme.primary : Theme.Theme.textTertiary
                }
            }
        }

        MouseArea {
            id: navMouseArea
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: navItem.clicked()
        }
    }
}
