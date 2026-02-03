#include "EventDispatcher.h"
#include "RustBridge.h"
#include "utils/JsonHelper.h"

#include <QCoreApplication>

EventDispatcher* EventDispatcher::s_instance = nullptr;

EventDispatcher* EventDispatcher::instance()
{
    if (!s_instance) {
        s_instance = new EventDispatcher(qApp);
    }
    return s_instance;
}

EventDispatcher::EventDispatcher(QObject* parent)
    : QObject(parent)
{
    // Connect to RustBridge generic event signal
    connect(RustBridge::instance(), &RustBridge::eventReceived,
            this, &EventDispatcher::onEventReceived);
}

void EventDispatcher::registerHandler(const QString& eventName, EventHandler handler)
{
    m_handlers[eventName].append(handler);
}

void EventDispatcher::unregisterHandlers(const QString& eventName)
{
    m_handlers.remove(eventName);
}

bool EventDispatcher::hasHandlers(const QString& eventName) const
{
    return m_handlers.contains(eventName) && !m_handlers[eventName].isEmpty();
}

void EventDispatcher::onEventReceived(const QString& eventName, const QJsonObject& payload)
{
    // Dispatch to registered handlers
    dispatchEvent(eventName, payload);

    // Emit typed signals for common events
    if (eventName == QStringLiteral("thumbnail-ready")) {
        emit thumbnailReady(
            JsonHelper::getString(payload, QStringLiteral("fileHash")),
            JsonHelper::getString(payload, QStringLiteral("size")),
            JsonHelper::getString(payload, QStringLiteral("path")),
            JsonHelper::getBool(payload, QStringLiteral("isPlaceholder")),
            JsonHelper::getString(payload, QStringLiteral("placeholderBase64")),
            JsonHelper::getBool(payload, QStringLiteral("useOriginal"))
        );
    }
    else if (eventName == QStringLiteral("index-progress")) {
        emit indexProgress(
            JsonHelper::getInt(payload, QStringLiteral("processed")),
            JsonHelper::getInt(payload, QStringLiteral("total")),
            JsonHelper::getString(payload, QStringLiteral("currentFile"))
        );
    }
    else if (eventName == QStringLiteral("index-finished")) {
        emit indexFinished(
            JsonHelper::getInt(payload, QStringLiteral("indexed")),
            JsonHelper::getInt(payload, QStringLiteral("skipped")),
            JsonHelper::getInt(payload, QStringLiteral("failed"))
        );
    }
    else if (eventName == QStringLiteral("index-cancelled")) {
        emit indexCancelled();
    }
    else if (eventName == QStringLiteral("settings-changed")) {
        emit settingsChanged(payload);
    }
    else if (eventName == QStringLiteral("auto-scan:started")) {
        emit autoScanStarted(JsonHelper::getString(payload, QStringLiteral("path")));
    }
    else if (eventName == QStringLiteral("auto-scan:finished")) {
        emit autoScanFinished(
            JsonHelper::getString(payload, QStringLiteral("path")),
            JsonHelper::getInt(payload, QStringLiteral("count"))
        );
    }
    else if (eventName == QStringLiteral("auto-scan:error")) {
        emit autoScanError(
            JsonHelper::getString(payload, QStringLiteral("path")),
            JsonHelper::getString(payload, QStringLiteral("error"))
        );
    }
    else if (eventName.startsWith(QStringLiteral("file-watcher:"))) {
        QString eventType = eventName.mid(13); // Remove "file-watcher:" prefix
        emit fileWatcherEvent(eventType, JsonHelper::getString(payload, QStringLiteral("path")));
    }
}

void EventDispatcher::dispatchEvent(const QString& eventName, const QJsonObject& payload)
{
    auto it = m_handlers.find(eventName);
    if (it != m_handlers.end()) {
        for (const EventHandler& handler : *it) {
            handler(payload);
        }
    }

    // Also dispatch to wildcard handlers
    auto wildcardIt = m_handlers.find(QStringLiteral("*"));
    if (wildcardIt != m_handlers.end()) {
        for (const EventHandler& handler : *wildcardIt) {
            handler(payload);
        }
    }
}
