pragma Singleton
import QtQuick

QtObject {
    // Theme mode state
    property bool darkMode: false
    property string mode: "light" // "light", "dark", "system"

    // Accent Color (Base Primary) - Terracotta from Web
    property color accentColor: "#DA7756"

    // Primary brand color - Dynamic based on accentColor
    readonly property color primary: darkMode ? "#E8957A" : accentColor
    readonly property color primaryDark: darkMode ? accentColor : "#C45D3A"
    readonly property color primaryLight: darkMode ? "#F0A890" : "#E8957A"

    // Background colors
    readonly property color background: darkMode ? "#1E1E1E" : "#FAF9F7"
    readonly property color sidebar: darkMode ? "#252526" : "#F5F3F0"
    readonly property color surface: darkMode ? "#2D2D2D" : "#FFFFFF"
    
    // Interactive elements
    readonly property color element: darkMode ? "#3C3C3C" : "#F0EEEB"
    readonly property color hover: darkMode ? "#454545" : "#E8E6E3"
    readonly property color button: darkMode ? "#333333" : "#F5F3F0"

    // Border colors
    readonly property color border: darkMode ? "#404040" : "#E8E6E3"
    readonly property color borderLight: darkMode ? "#333333" : "#F0EEEB"

    // Text colors
    readonly property color textPrimary: darkMode ? "#E8E8E8" : "#1A1918"
    readonly property color textSecondary: darkMode ? "#ABABAB" : "#6B6966"
    readonly property color textTertiary: darkMode ? "#808080" : "#9C9A97"

    // Semantic colors
    readonly property color danger: "#EF4444"
    readonly property color dangerHover: "#DC2626"
    readonly property color success: "#22C55E"
    readonly property color warning: "#F59E0B"

    // Ring (Focus/Outline)
    readonly property color ring: Qt.rgba(1, 1, 1, 0.1)

    // Shadows
    readonly property color shadowColor: "#000000"
    readonly property real shadowOpacity: darkMode ? 0.35 : 0.06

    // Animation durations
    readonly property int durationFast: 150
    readonly property int durationNormal: 200
    readonly property int durationSlow: 300

    // Border radius - Matches Tailwind sizing
    readonly property int radiusSmall: 6
    readonly property int radiusMedium: 8
    readonly property int radiusLarge: 12
    readonly property int radiusXLarge: 16
    readonly property int radiusXXLarge: 24
    readonly property int radiusFull: 9999

    // Spacing
    readonly property int spacingXs: 4
    readonly property int spacingSm: 8
    readonly property int spacingMd: 16
    readonly property int spacingLg: 24
    readonly property int spacingXl: 32

    // Fonts
    readonly property string fontSans: "Inter"
    readonly property string fontSerif: "Noto Serif SC"

    // Font sizes (Tailwind-like)
    readonly property int fontSizeXs: 12
    readonly property int fontSizeSm: 14
    readonly property int fontSizeMd: 16
    readonly property int fontSizeLg: 18
    readonly property int fontSizeXl: 20
    readonly property int fontSize2xl: 24

    // Functions
    function toggleTheme() {
        darkMode = !darkMode
        mode = darkMode ? "dark" : "light"
    }

    function setMode(newMode) {
        mode = newMode
        if (mode === "system") {
            darkMode = true 
        } else {
            darkMode = (mode === "dark")
        }
    }
}
