import QtQuick
import "../theme" as Theme

Item {
    id: root
    property int gridSize: 24
    property color gridColor: Theme.Theme.darkMode
                              ? Qt.rgba(1, 1, 1, 0.04)
                              : Qt.rgba(0, 0, 0, 0.06)

    Canvas {
        anchors.fill: parent
        onPaint: {
            var ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)
            ctx.strokeStyle = gridColor
            ctx.lineWidth = 1

            var size = root.gridSize
            for (var x = 0; x <= width; x += size) {
                ctx.beginPath()
                ctx.moveTo(x + 0.5, 0)
                ctx.lineTo(x + 0.5, height)
                ctx.stroke()
            }
            for (var y = 0; y <= height; y += size) {
                ctx.beginPath()
                ctx.moveTo(0, y + 0.5)
                ctx.lineTo(width, y + 0.5)
                ctx.stroke()
            }
        }

        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
    }
}
