import QtQuick
import QtQuick.Controls
import "../theme" as Theme

ScrollBar {
    id: root
    policy: ScrollBar.AsNeeded
    minimumSize: 0.2

    contentItem: Rectangle {
        implicitWidth: 6
        radius: 999
        color: root.pressed
               ? Qt.rgba(133 / 255, 128 / 255, 121 / 255, 0.6)
               : Qt.rgba(133 / 255, 128 / 255, 121 / 255, root.hovered ? 0.6 : 0.4)
    }

    background: Item {}
}
