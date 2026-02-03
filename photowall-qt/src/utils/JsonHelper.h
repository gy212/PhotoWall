#ifndef JSONHELPER_H
#define JSONHELPER_H

#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QString>
#include <QVariant>
#include <QDateTime>
#include <optional>

namespace JsonHelper {

// Parse JSON string to QJsonDocument
std::optional<QJsonDocument> parse(const QString& json);
std::optional<QJsonDocument> parse(const char* json);

// Convert QJsonDocument to string
QString stringify(const QJsonDocument& doc, bool compact = true);
QString stringify(const QJsonObject& obj, bool compact = true);
QString stringify(const QJsonArray& arr, bool compact = true);

// Safe value extraction with defaults
QString getString(const QJsonObject& obj, const QString& key, const QString& defaultValue = QString());
qint64 getInt64(const QJsonObject& obj, const QString& key, qint64 defaultValue = 0);
int getInt(const QJsonObject& obj, const QString& key, int defaultValue = 0);
double getDouble(const QJsonObject& obj, const QString& key, double defaultValue = 0.0);
bool getBool(const QJsonObject& obj, const QString& key, bool defaultValue = false);
QJsonArray getArray(const QJsonObject& obj, const QString& key);
QJsonObject getObject(const QJsonObject& obj, const QString& key);

// DateTime helpers (ISO 8601 format)
QDateTime getDateTime(const QJsonObject& obj, const QString& key);
void setDateTime(QJsonObject& obj, const QString& key, const QDateTime& dt);

// Array helpers
QStringList toStringList(const QJsonArray& arr);
QList<qint64> toInt64List(const QJsonArray& arr);
QJsonArray fromStringList(const QStringList& list);
QJsonArray fromInt64List(const QList<qint64>& list);

} // namespace JsonHelper

#endif // JSONHELPER_H
