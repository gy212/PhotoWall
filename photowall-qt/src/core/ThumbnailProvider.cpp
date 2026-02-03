#include "ThumbnailProvider.h"
#include "RustBridge.h"

#include <QFile>
#include <QImageReader>
#include <QQuickTextureFactory>
#include <QMutexLocker>
#include <QJsonArray>
#include <QJsonObject>
#include <QUrl>

// ============================================================================
// ThumbnailProvider
// ============================================================================

ThumbnailProvider::ThumbnailProvider()
    : m_imageCache(DEFAULT_CACHE_SIZE)
{
    // Connect to RustBridge thumbnail signals
    connect(RustBridge::instance(), &RustBridge::thumbnailReady,
            this, [this](const QString& fileHash, const QString& size,
                        const QString& path, bool isPlaceholder,
                        const QString& placeholderBase64, bool useOriginal) {
        notifyThumbnailReady(fileHash, size, path, isPlaceholder, placeholderBase64, useOriginal);
    });
}

QQuickImageResponse* ThumbnailProvider::requestImageResponse(const QString& id,
                                                              const QSize& requestedSize)
{
    // Parse ID: fileHash|encodedPath/size
    QStringList parts = id.split('/');
    QString hashPart = parts.value(0);
    QString size = parts.value(1, QStringLiteral("medium"));
    QString filePath;

    int separator = hashPart.indexOf('|');
    if (separator >= 0) {
        filePath = QUrl::fromPercentEncoding(hashPart.mid(separator + 1).toUtf8());
        hashPart = hashPart.left(separator);
    }

    return new ThumbnailResponse(this, hashPart, filePath, size, requestedSize);
}

void ThumbnailProvider::clearCache()
{
    QMutexLocker locker(&m_cacheMutex);
    m_imageCache.clear();
}

void ThumbnailProvider::setCacheSize(int maxImages)
{
    QMutexLocker locker(&m_cacheMutex);
    m_imageCache.setMaxCost(maxImages);
}

void ThumbnailProvider::cacheImage(const QString& key, const QImage& image)
{
    QMutexLocker locker(&m_cacheMutex);
    m_imageCache.insert(key, new QImage(image));
}

QImage ThumbnailProvider::getCachedImage(const QString& key) const
{
    QMutexLocker locker(&m_cacheMutex);
    QImage* cached = m_imageCache.object(key);
    return cached ? *cached : QImage();
}

bool ThumbnailProvider::hasCachedImage(const QString& key) const
{
    QMutexLocker locker(&m_cacheMutex);
    return m_imageCache.contains(key);
}

void ThumbnailProvider::addPendingRequest(const QString& fileHash, ThumbnailResponse* response)
{
    QMutexLocker locker(&m_pendingMutex);
    m_pendingRequests[fileHash].insert(response);
}

void ThumbnailProvider::removePendingRequest(const QString& fileHash, ThumbnailResponse* response)
{
    QMutexLocker locker(&m_pendingMutex);
    auto it = m_pendingRequests.find(fileHash);
    if (it != m_pendingRequests.end()) {
        it->remove(response);
        if (it->isEmpty()) {
            m_pendingRequests.erase(it);
        }
    }
}

void ThumbnailProvider::notifyThumbnailReady(const QString& fileHash, const QString& size,
                                              const QString& path, bool isPlaceholder,
                                              const QString& placeholderBase64, bool useOriginal)
{
    QMutexLocker locker(&m_pendingMutex);
    auto it = m_pendingRequests.find(fileHash);
    if (it != m_pendingRequests.end()) {
        QSet<ThumbnailResponse*> responses = *it;
        m_pendingRequests.erase(it);
        locker.unlock();

        for (ThumbnailResponse* response : responses) {
            response->handleThumbnailReady(path, isPlaceholder, placeholderBase64, useOriginal);
        }
    }
}

// ============================================================================
// ThumbnailResponse
// ============================================================================

ThumbnailResponse::ThumbnailResponse(ThumbnailProvider* provider, const QString& fileHash,
                                     const QString& filePath, const QString& size,
                                     const QSize& requestedSize)
    : m_provider(provider)
    , m_fileHash(fileHash)
    , m_filePath(filePath)
    , m_size(size)
    , m_requestedSize(requestedSize)
{
    // Check cache first
    QString cacheKey = QStringLiteral("%1/%2").arg(fileHash, size);
    if (m_provider->hasCachedImage(cacheKey)) {
        m_image = m_provider->getCachedImage(cacheKey);
        m_finished = true;
        emit finished();
        return;
    }

    // Check if thumbnail exists on disk
    QString path = RustBridge::instance()->getThumbnailPath(fileHash, size);
    if (!path.isEmpty() && QFile::exists(path)) {
        loadFromPath(path);
        return;
    }

    if (m_filePath.isEmpty()) {
        finishWithError(QStringLiteral("Missing file path for thumbnail request"));
        return;
    }

    // Request thumbnail generation
    m_provider->addPendingRequest(fileHash, this);

    QJsonArray requests;
    QJsonObject req;
    req[QStringLiteral("filePath")] = m_filePath;
    req[QStringLiteral("fileHash")] = fileHash;
    req[QStringLiteral("size")] = size;
    requests.append(req);

    RustBridge::instance()->enqueueThumbnailsBatch(requests);
}

ThumbnailResponse::~ThumbnailResponse()
{
    if (!m_finished) {
        m_provider->removePendingRequest(m_fileHash, this);
    }
}

QQuickTextureFactory* ThumbnailResponse::textureFactory() const
{
    return QQuickTextureFactory::textureFactoryForImage(m_image);
}

void ThumbnailResponse::onThumbnailReady(const QString& fileHash, const QString& size,
                                         const QString& path, bool isPlaceholder,
                                         const QString& placeholderBase64, bool useOriginal)
{
    if (fileHash != m_fileHash || size != m_size) {
        return;
    }
    handleThumbnailReady(path, isPlaceholder, placeholderBase64, useOriginal);
}

void ThumbnailResponse::handleThumbnailReady(const QString& path, bool isPlaceholder,
                                              const QString& placeholderBase64, bool useOriginal)
{
    if (m_finished) return;

    if (isPlaceholder && !placeholderBase64.isEmpty()) {
        loadFromBase64(placeholderBase64);
    } else if (!path.isEmpty()) {
        loadFromPath(path);
    } else {
        finishWithError(QStringLiteral("No thumbnail available"));
    }
}

void ThumbnailResponse::loadFromPath(const QString& path)
{
    QImageReader reader(path);
    reader.setAutoTransform(true);

    if (m_requestedSize.isValid()) {
        reader.setScaledSize(m_requestedSize);
    }

    QImage image = reader.read();
    if (image.isNull()) {
        finishWithError(reader.errorString());
    } else {
        finishWithImage(image);
    }
}

void ThumbnailResponse::loadFromBase64(const QString& base64)
{
    QByteArray data = QByteArray::fromBase64(base64.toLatin1());
    QImage image;
    if (image.loadFromData(data)) {
        finishWithImage(image);
    } else {
        finishWithError(QStringLiteral("Failed to decode base64 image"));
    }
}

void ThumbnailResponse::finishWithImage(const QImage& image)
{
    m_image = image;
    m_finished = true;

    // Cache the image
    QString cacheKey = QStringLiteral("%1/%2").arg(m_fileHash, m_size);
    m_provider->cacheImage(cacheKey, image);

    m_provider->removePendingRequest(m_fileHash, this);
    emit finished();
}

void ThumbnailResponse::finishWithError(const QString& error)
{
    m_errorString = error;
    m_finished = true;
    m_provider->removePendingRequest(m_fileHash, this);
    emit finished();
}
