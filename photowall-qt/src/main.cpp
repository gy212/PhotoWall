#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>

#include "core/RustBridge.h"
#include "core/PhotoModel.h"
#include "core/PhotoStore.h"
#include "core/ThumbnailProvider.h"
#include "core/EventDispatcher.h"
#include "core/FolderTreeModel.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);

    app.setApplicationName(QStringLiteral("PhotoWall"));
    app.setOrganizationName(QStringLiteral("PhotoWall"));
    app.setApplicationVersion(QStringLiteral("1.0.0"));

    // Set default style
    QQuickStyle::setStyle(QStringLiteral("Fusion"));

    // Initialize Rust bridge
    if (!RustBridge::instance()->initialize()) {
        qCritical() << "Failed to initialize Rust bridge:" << RustBridge::instance()->lastError();
        return 1;
    }

    // Initialize event dispatcher (connects to RustBridge)
    EventDispatcher::instance();

    // Create QML engine
    QQmlApplicationEngine engine;

    // Register thumbnail provider
    engine.addImageProvider(QStringLiteral("thumbnail"), new ThumbnailProvider());

    // Register types for QML
    qmlRegisterType<PhotoModel>("PhotoWall", 1, 0, "PhotoModel");
    qmlRegisterType<FolderTreeModel>("PhotoWall", 1, 0, "FolderTreeModel");
    qmlRegisterSingletonType<PhotoStore>("PhotoWall", 1, 0, "PhotoStore", &PhotoStore::create);

    // Load main QML file
    const QUrl url(QStringLiteral("qrc:/qml/main.qml"));

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreated,
                     &app, [url](QObject *obj, const QUrl &objUrl) {
        if (!obj && url == objUrl) {
            QCoreApplication::exit(-1);
        }
    }, Qt::QueuedConnection);

    engine.load(url);

    int result = app.exec();

    // Cleanup
    RustBridge::instance()->shutdown();

    return result;
}
