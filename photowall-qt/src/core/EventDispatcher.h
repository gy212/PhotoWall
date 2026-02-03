#ifndef EVENTDISPATCHER_H
#define EVENTDISPATCHER_H

#include <QObject>
#include <QJsonObject>
#include <QHash>
#include <functional>

/**
 * C-05: EventDispatcher
 * Routes events from RustBridge to appropriate handlers.
 */
class EventDispatcher : public QObject
{
    Q_OBJECT

public:
    using EventHandler = std::function<void(const QJsonObject&)>;

    static EventDispatcher* instance();

    // Register a handler for a specific event
    void registerHandler(const QString& eventName, EventHandler handler);

    // Unregister all handlers for an event
    void unregisterHandlers(const QString& eventName);

    // Check if an event has handlers
    bool hasHandlers(const QString& eventName) const;

signals:
    // Re-emit specific events for convenience
    void thumbnailReady(const QString& fileHash, const QString& size,
                        const QString& path, bool isPlaceholder,
                        const QString& placeholderBase64, bool useOriginal);

    void indexProgress(int processed, int total, const QString& currentFile);
    void indexFinished(int indexed, int skipped, int failed);
    void indexCancelled();

    void settingsChanged(const QJsonObject& settings);

    void autoScanStarted(const QString& path);
    void autoScanFinished(const QString& path, int count);
    void autoScanError(const QString& path, const QString& error);

    void fileWatcherEvent(const QString& eventType, const QString& path);

private slots:
    void onEventReceived(const QString& eventName, const QJsonObject& payload);

private:
    explicit EventDispatcher(QObject* parent = nullptr);
    ~EventDispatcher() override = default;

    EventDispatcher(const EventDispatcher&) = delete;
    EventDispatcher& operator=(const EventDispatcher&) = delete;

    void dispatchEvent(const QString& eventName, const QJsonObject& payload);

    QHash<QString, QList<EventHandler>> m_handlers;

    static EventDispatcher* s_instance;
};

#endif // EVENTDISPATCHER_H