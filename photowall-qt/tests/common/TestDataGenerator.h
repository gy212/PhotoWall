#ifndef TESTDATAGENERATOR_H
#define TESTDATAGENERATOR_H

#include <QJsonObject>
#include <QJsonArray>
#include <QString>
#include <QDateTime>
#include <QRandomGenerator>

namespace TestDataGenerator {

/**
 * Generate a test photo JSON object.
 * @param id Photo ID
 * @param options Optional overrides
 * @return Photo JSON object
 */
inline QJsonObject generatePhoto(qint64 id, const QJsonObject& options = {})
{
    QString hash = QString("hash_%1_%2")
        .arg(id)
        .arg(QRandomGenerator::global()->generate());

    QJsonObject photo;
    photo["photoId"] = id;
    photo["filePath"] = options.value("filePath").toString(
        QString("C:/Photos/photo_%1.jpg").arg(id));
    photo["fileName"] = options.value("fileName").toString(
        QString("photo_%1.jpg").arg(id));
    photo["fileHash"] = options.value("fileHash").toString(hash);
    photo["width"] = options.value("width").toInt(4000);
    photo["height"] = options.value("height").toInt(3000);
    photo["dateTaken"] = options.value("dateTaken").toString(
        QDateTime::currentDateTime().addDays(-id).toString(Qt::ISODate));
    photo["dateAdded"] = options.value("dateAdded").toString(
        QDateTime::currentDateTime().toString(Qt::ISODate));
    photo["isFavorite"] = options.value("isFavorite").toBool(false);
    photo["rating"] = options.value("rating").toInt(0);
    photo["cameraModel"] = options.value("cameraModel").toString("Test Camera");
    photo["lensModel"] = options.value("lensModel").toString("Test Lens");
    photo["fileSize"] = options.value("fileSize").toInteger(5000000);
    photo["isDeleted"] = options.value("isDeleted").toBool(false);

    return photo;
}

/**
 * Generate multiple test photos.
 * @param count Number of photos to generate
 * @param startId Starting ID
 * @param options Optional overrides applied to all photos
 * @return Array of photo JSON objects
 */
inline QJsonArray generatePhotos(int count, qint64 startId = 1,
                                  const QJsonObject& options = {})
{
    QJsonArray photos;
    for (int i = 0; i < count; ++i) {
        photos.append(generatePhoto(startId + i, options));
    }
    return photos;
}

/**
 * Generate a test tag JSON object.
 * @param id Tag ID
 * @param name Tag name
 * @param color Tag color
 * @return Tag JSON object
 */
inline QJsonObject generateTag(qint64 id, const QString& name,
                                const QString& color = "#FF5733")
{
    QJsonObject tag;
    tag["id"] = id;
    tag["name"] = name;
    tag["color"] = color;
    tag["photoCount"] = 0;
    return tag;
}

/**
 * Generate a test album JSON object.
 * @param id Album ID
 * @param name Album name
 * @param description Album description
 * @return Album JSON object
 */
inline QJsonObject generateAlbum(qint64 id, const QString& name,
                                  const QString& description = "")
{
    QJsonObject album;
    album["id"] = id;
    album["name"] = name;
    album["description"] = description;
    album["photoCount"] = 0;
    album["coverPhotoId"] = QJsonValue::Null;
    return album;
}

/**
 * Generate a photos response with pagination info.
 * @param photos Array of photos
 * @param total Total count
 * @param hasMore Whether more pages exist
 * @param nextCursor Next cursor for pagination
 * @return Response JSON object
 */
inline QJsonObject generatePhotosResponse(const QJsonArray& photos, int total,
                                           bool hasMore,
                                           const QJsonObject& nextCursor = {})
{
    QJsonObject response;
    response["photos"] = photos;
    response["total"] = total;
    response["hasMore"] = hasMore;
    response["nextCursor"] = nextCursor;
    return response;
}

/**
 * Generate index progress event payload.
 * @param processed Number of processed files
 * @param total Total files
 * @param currentFile Current file being processed
 * @return Event payload JSON object
 */
inline QJsonObject generateIndexProgress(int processed, int total,
                                          const QString& currentFile)
{
    QJsonObject payload;
    payload["processed"] = processed;
    payload["total"] = total;
    payload["currentFile"] = currentFile;
    return payload;
}

/**
 * Generate index finished event payload.
 * @param indexed Number of indexed files
 * @param skipped Number of skipped files
 * @param failed Number of failed files
 * @return Event payload JSON object
 */
inline QJsonObject generateIndexFinished(int indexed, int skipped, int failed)
{
    QJsonObject payload;
    payload["indexed"] = indexed;
    payload["skipped"] = skipped;
    payload["failed"] = failed;
    return payload;
}

} // namespace TestDataGenerator

#endif // TESTDATAGENERATOR_H
