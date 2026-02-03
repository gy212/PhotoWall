#ifndef THUMBNAILPROVIDER_H
#define THUMBNAILPROVIDER_H

#include <QQuickAsyncImageProvider>
#include <QCache>
#include <QMutex>
#include <QHash>
#include <QSet>

class ThumbnailResponse;

/**
 * C-03: ThumbnailProvider
 * QQuickAsyncImageProvider for async thumbnail loading.
 * URL format:
 * - image://thumbnail/fileHash|<url-encoded filePath>/size
 * - image://thumbnail/fileHash/size (cache-only, no generation)
 * Size options: tiny, small, medium, large
 */
class ThumbnailProvider : public QQuickAsyncImageProvider
{
public:
    ThumbnailProvider();
    ~ThumbnailProvider() override = default;

    QQuickImageResponse* requestImageResponse(const QString& id,
                                              const QSize& requestedSize) override;

    // Cache management
    void clearCache();
    void setCacheSize(int maxImages);

    // Called by ThumbnailResponse when thumbnail is ready
    void cacheImage(const QString& key, const QImage& image);
    QImage getCachedImage(const QString& key) const;
    bool hasCachedImage(const QString& key) const;

    // Track pending requests
    void addPendingRequest(const QString& fileHash, ThumbnailResponse* response);
    void removePendingRequest(const QString& fileHash, ThumbnailResponse* response);
    void notifyThumbnailReady(const QString& fileHash, const QString& size,
                              const QString& path, bool isPlaceholder,
                              const QString& placeholderBase64, bool useOriginal);

private:
    mutable QMutex m_cacheMutex;
    QCache<QString, QImage> m_imageCache;

    mutable QMutex m_pendingMutex;
    QHash<QString, QSet<ThumbnailResponse*>> m_pendingRequests;

    static constexpr int DEFAULT_CACHE_SIZE = 200;
};

/**
 * Async response for thumbnail requests.
 */
class ThumbnailResponse : public QQuickImageResponse
{
    Q_OBJECT

public:
    ThumbnailResponse(ThumbnailProvider* provider, const QString& fileHash,
                      const QString& filePath, const QString& size,
                      const QSize& requestedSize);
    ~ThumbnailResponse() override;

    QQuickTextureFactory* textureFactory() const override;
    QString errorString() const override { return m_errorString; }

    void handleThumbnailReady(const QString& path, bool isPlaceholder,
                              const QString& placeholderBase64, bool useOriginal);

private slots:
    void onThumbnailReady(const QString& fileHash, const QString& size,
                          const QString& path, bool isPlaceholder,
                          const QString& placeholderBase64, bool useOriginal);

private:
    void loadFromPath(const QString& path);
    void loadFromBase64(const QString& base64);
    void finishWithImage(const QImage& image);
    void finishWithError(const QString& error);

    ThumbnailProvider* m_provider;
    QString m_fileHash;
    QString m_filePath;
    QString m_size;
    QSize m_requestedSize;
    QImage m_image;
    QString m_errorString;
    bool m_finished = false;
};

#endif // THUMBNAILPROVIDER_H
