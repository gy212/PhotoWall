import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Window
import Qt5Compat.GraphicalEffects
import PhotoWall 1.0
import "components"
import "pages"
import "dialogs"
import "theme" as Theme

ApplicationWindow {
    id: window
    width: 1280
    height: 800
    visible: true
    title: qsTr("PhotoWall")
    font.family: Theme.Theme.fontSans
    font.pixelSize: Theme.Theme.fontSizeMd

    flags: Qt.Window | Qt.FramelessWindowHint
    color: "transparent"

    readonly property bool darkMode: Theme.Theme.darkMode

    property string currentPage: "home"

    property var store: PhotoStore

    signal pageChanged(string pageName)

    Rectangle {
        id: mainBackground
        anchors.fill: parent
        color: Theme.Theme.background
        radius: Theme.Theme.radiusLarge
        
        layer.enabled: true
        layer.effect: OpacityMask {
            maskSource: Rectangle {
                width: mainBackground.width
                height: mainBackground.height
                radius: mainBackground.radius
                visible: false
            }
        }
        
        // Title Bar
        Rectangle {
            id: titleBar
            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right
            height: 56
            color: Theme.Theme.surface
            
            radius: Theme.Theme.radiusLarge
            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: parent.radius; color: parent.color }

            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.Theme.border
                opacity: 0.6
            }

            // Drag Area
            MouseArea {
                anchors.fill: parent
                anchors.rightMargin: windowControls.width
                property point clickPos: Qt.point(0, 0)
                onPressed: function(mouse) { clickPos = Qt.point(mouse.x, mouse.y) }
                onPositionChanged: function(mouse) {
                    if (pressed) {
                        let delta = Qt.point(mouse.x - clickPos.x, mouse.y - clickPos.y)
                        window.x += delta.x
                        window.y += delta.y
                    }
                }
                onDoubleClicked: {
                    if (window.visibility === Window.Maximized) window.showNormal()
                    else window.showMaximized()
                }
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 0
                spacing: 0

                // Logo Section
                RowLayout {
                    spacing: 10
                    
                    Rectangle {
                        width: 36
                        height: 36
                        radius: 12
                        gradient: Gradient {
                            GradientStop { position: 0.0; color: Theme.Theme.primary }
                            GradientStop { position: 1.0; color: Theme.Theme.primaryDark }
                        }
                        
                        border.width: 1
                        border.color: Theme.Theme.ring
                        
                        Icon { anchors.centerIn: parent; name: "photo_library"; size: 18; color: "#FFFFFF"; filled: true }

                        layer.enabled: true
                        layer.effect: DropShadow {
                            transparentBorder: true
                            horizontalOffset: 0
                            verticalOffset: 3
                            radius: 10
                            samples: 17
                            color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.2)
                        }
                    }

                    Text {
                        text: "PhotoWall"
                        font.family: Theme.Theme.fontSerif
                        font.pixelSize: 20
                        font.weight: Font.Bold
                        font.letterSpacing: -0.5
                        color: Theme.Theme.primary
                    }
                }

                Item { Layout.fillWidth: true }

                // Navigation Pill - Web Style
                Rectangle {
                    id: navContainer
                    Layout.preferredHeight: 36
                    Layout.preferredWidth: navRow.implicitWidth + 8
                    radius: 18
                    color: Theme.Theme.element
                    border.width: 1
                    border.color: Qt.rgba(Theme.Theme.border.r, Theme.Theme.border.g, Theme.Theme.border.b, 0.5)

                    // Sliding Pill Background
                    Rectangle {
                        id: slidingPill
                        height: 28
                        radius: 14
                        color: Theme.Theme.surface
                        border.width: 1
                        border.color: Qt.rgba(Theme.Theme.border.r, Theme.Theme.border.g, Theme.Theme.border.b, 0.5)
                        anchors.verticalCenter: parent.verticalCenter
                        
                        z: 1
                        
                        // Width and X position based on current page
                        width: navContainer.currentNavItem ? navContainer.currentNavItem.width : 0
                        x: navContainer.currentNavItem ? navContainer.currentNavItem.x + navRow.x : 0
                        
                        visible: navContainer.currentNavItem !== null
                        
                        Behavior on x { NumberAnimation { duration: 200; easing.type: Easing.OutQuad } }
                        Behavior on width { NumberAnimation { duration: 200; easing.type: Easing.OutQuad } }

                        layer.enabled: true
                        layer.effect: DropShadow {
                            transparentBorder: true
                            horizontalOffset: 0
                            verticalOffset: 1
                            radius: 2
                            samples: 5
                            color: Qt.rgba(0,0,0,0.05)
                        }
                    }

                    property var currentNavItem: null

                    RowLayout {
                        id: navRow
                        anchors.centerIn: parent
                        spacing: 2
                        z: 2

                        Repeater {
                            model: [
                                { id: "home", label: "照片", icon: "grid_view" },
                                { id: "folders", label: "文件夹", icon: "folder" },
                                { id: "trash", label: "废纸篓", icon: "delete" },
                                { id: "settings", label: "设置", icon: "settings" }
                            ]

                            delegate: Item {
                                id: navItem
                                implicitWidth: navItemRow.implicitWidth + 32
                                implicitHeight: 28
                                
                                property bool isSelected: window.currentPage === modelData.id
                                
                                Component.onCompleted: if (isSelected) navContainer.currentNavItem = navItem
                                onIsSelectedChanged: if (isSelected) navContainer.currentNavItem = navItem

                                RowLayout {
                                    id: navItemRow
                                    anchors.centerIn: parent
                                    spacing: 8
                                    
                                    Icon {
                                        name: modelData.icon
                                        size: 18
                                        color: navItem.isSelected ? Theme.Theme.primary : (ma.containsMouse ? Theme.Theme.primary : Theme.Theme.textSecondary)
                                        filled: true
                                    }

                                    Text {
                                        text: modelData.label
                                        font.pixelSize: Theme.Theme.fontSizeSm
                                        font.weight: Font.DemiBold
                                        color: navItem.isSelected ? Theme.Theme.primary : (ma.containsMouse ? Theme.Theme.primary : Theme.Theme.textSecondary)
                                    }
                                }

                                MouseArea {
                                    id: ma
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    cursorShape: Qt.PointingHandCursor
                                    onClicked: navigateTo(modelData.id)
                                }
                            }
                        }
                    }
                }

                Item { Layout.fillWidth: true }

                // Right Controls
                RowLayout {
                    spacing: 12
                    Layout.rightMargin: 12

                    // Search Button
                    Rectangle {
                        width: 36
                        height: 36
                        radius: 10
                        color: searchMa.containsMouse ? Theme.Theme.element : "transparent"
                        
                        Icon { anchors.centerIn: parent; name: "search"; size: 18; color: searchMa.containsMouse ? Theme.Theme.primary : Theme.Theme.textSecondary }
                        
                        MouseArea {
                            id: searchMa
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: searchPanel.open()
                        }
                    }
                    
                    // Avatar
                    Rectangle {
                        width: 32
                        height: 32
                        radius: 16
                        gradient: Gradient {
                            GradientStop { position: 0.0; color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.2) }
                            GradientStop { position: 1.0; color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.05) }
                        }
                        border.width: 1
                        border.color: Theme.Theme.border
                        
                        // Inner Shadow simulation
                        Rectangle {
                            anchors.fill: parent
                            radius: 16
                            color: "transparent"
                            border.width: 1
                            border.color: Qt.rgba(0,0,0,0.05)
                        }
                    }

                    // Window Controls
                    WindowControls {
                        id: windowControls
                        maximized: window.visibility === Window.Maximized
                        onMinimizeClicked: window.showMinimized()
                        onMaximizeClicked: {
                            if (window.visibility === Window.Maximized) window.showNormal()
                            else window.showMaximized()
                        }
                        onCloseClicked: window.close()
                    }
                }
            }
        }

        // Content Area
        Item {
            anchors.top: titleBar.bottom
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: statusBar.top

            StackView {
                id: stackView
                anchors.fill: parent
                initialItem: homePageComponent

                pushEnter: Transition { PropertyAnimation { property: "opacity"; from: 0; to: 1; duration: 200 } }
                pushExit: Transition { PropertyAnimation { property: "opacity"; from: 1; to: 0; duration: 200 } }
                popEnter: Transition { PropertyAnimation { property: "opacity"; from: 0; to: 1; duration: 200 } }
                popExit: Transition { PropertyAnimation { property: "opacity"; from: 1; to: 0; duration: 200 } }
            }
        }

        // Floating import button
        Rectangle {
            id: importFab
            width: 56
            height: 56
            radius: 28
            color: Theme.Theme.primary
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.rightMargin: 24
            anchors.bottomMargin: 24

            layer.enabled: true
            layer.effect: DropShadow {
                transparentBorder: true
                horizontalOffset: 0
                verticalOffset: 6
                radius: 16
                samples: 25
                color: Qt.rgba(Theme.Theme.primary.r, Theme.Theme.primary.g, Theme.Theme.primary.b, 0.35)
            }

            Icon { anchors.centerIn: parent; name: "add_photo_alternate"; size: 24; color: "white" }

            MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onEntered: parent.scale = 1.05
                onExited: parent.scale = 1.0
            }

            Behavior on scale { NumberAnimation { duration: 150 } }
        }

        // Status Bar
        Rectangle {
            id: statusBar
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 0
            color: Theme.Theme.surface
            visible: false
            
            radius: Theme.Theme.radiusLarge
            Rectangle { anchors.top: parent.top; width: parent.width; height: parent.radius; color: parent.color }

            Rectangle { width: parent.width; height: 1; color: Theme.Theme.border }

            RowLayout {
                anchors.fill: parent; anchors.leftMargin: 16; anchors.rightMargin: 16
                Text {
                    text: store.hasSelection ? qsTr("%1 已选择").arg(store.selectedCount) : qsTr("就绪")
                    font.pixelSize: Theme.Theme.fontSizeXs; color: Theme.Theme.textSecondary
                }
                Item { Layout.fillWidth: true }
                Text {
                    text: store.photoModel.hasMore
                        ? qsTr("显示 %1 / %2").arg(store.photoModel.count).arg(store.photoModel.totalCount)
                        : qsTr("%1 张照片").arg(store.photoModel.count)
                    font.pixelSize: Theme.Theme.fontSizeXs; color: Theme.Theme.textSecondary
                }
            }
        }
    }

    Component { id: homePageComponent; HomePage { onPhotoDoubleClicked: (photo) => window.openPhotoViewer(photo, store.photoModel.photos, store.photoModel.photos.indexOf(photo)) } }
    Component { id: foldersPageComponent; FoldersPage { onPhotoDoubleClicked: (photo) => window.openPhotoViewer(photo) } }
    Component { id: trashPageComponent; TrashPage { onNavigateToHome: navigateTo("home") } }
    Component { id: settingsPageComponent; SettingsPage {} }

    ContextMenu { id: contextMenu }
    SearchPanel { id: searchPanel; parent: Overlay.overlay; onSearchRequested: (filters) => console.log(JSON.stringify(filters)) }
    PhotoViewer { id: photoViewer; parent: Overlay.overlay }

    function openPhotoViewer(photo, photos, index) {
        photoViewer.photo = photo; photoViewer.photos = photos || [photo]; photoViewer.currentIndex = index || 0; photoViewer.open()
    }
    function navigateTo(page) {
        if (page === window.currentPage) return
        window.currentPage = page; window.pageChanged(page); stackView.replace(getPageComponent(page))
    }
    function getPageComponent(page) {
        switch (page) {
            case "home": return homePageComponent; case "folders": return foldersPageComponent;
            case "trash": return trashPageComponent; case "settings": return settingsPageComponent;
            default: return homePageComponent
        }
    }
    Component.onCompleted: store.photoModel.loadInitial()
}
