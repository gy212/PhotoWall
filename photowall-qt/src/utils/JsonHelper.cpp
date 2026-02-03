#include "JsonHelper.h"

namespace JsonHelper {

std::optional<QJsonDocument> parse(const QString& json) {
    QJsonParseError error;
    QJsonDocument doc = QJsonDocument::fromJson(json.toUtf8(), &error);
    if (error.error != QJsonParseError::NoError) {
        return std::nullopt;
    }
    return doc;
}

std::optional<QJsonDocument> parse(const char* json) {
    if (!json) return std::nullopt;
    return parse(QString::fromUtf8(json));
}

QString stringify(const QJsonDocument& doc, bool compact) {
    return QString::fromUtf8(doc.toJson(compact ? QJsonDocument::Compact : QJsonDocument::Indented));
}

QString stringify(const QJsonObject& obj, bool compact) {
    return stringify(QJsonDocument(obj), compact);
}

QString stringify(const QJsonArray& arr, bool compact) {
    return stringify(QJsonDocument(arr), compact);
}

QString getString(const QJsonObject& obj, const QString& key, const QString& defaultValue) {
    if (!obj.contains(key)) return defaultValue;
    QJsonValue val = obj.value(key);
    return val.isString() ? val.toString() : defaultValue;
}

qint64 getInt64(const QJsonObject& obj, const QString& key, qint64 defaultValue) {
    if (!obj.contains(key)) return defaultValue;
    QJsonValue val = obj.value(key);
    if (val.isDouble()) {
        return static_cast<qint64>(val.toDouble());
    }
    return defaultValue;
}

int getInt(const QJsonObject& obj, const QString& key, int defaultValue) {
    return static_cast<int>(getInt64(obj, key, defaultValue));
}

double getDouble(const QJsonObject& obj, const QString& key, double defaultValue) {
    if (!obj.contains(key)) return defaultValue;
    QJsonValue val = obj.value(key);
    return val.isDouble() ? val.toDouble() : defaultValue;
}

bool getBool(const QJsonObject& obj, const QString& key, bool defaultValue) {
    if (!obj.contains(key)) return defaultValue;
    QJsonValue val = obj.value(key);
    return val.isBool() ? val.toBool() : defaultValue;
}

QJsonArray getArray(const QJsonObject& obj, const QString& key) {
    if (!obj.contains(key)) return QJsonArray();
    QJsonValue val = obj.value(key);
    return val.isArray() ? val.toArray() : QJsonArray();
}

QJsonObject getObject(const QJsonObject& obj, const QString& key) {
    if (!obj.contains(key)) return QJsonObject();
    QJsonValue val = obj.value(key);
    return val.isObject() ? val.toObject() : QJsonObject();
}

QDateTime getDateTime(const QJsonObject& obj, const QString& key) {
    QString str = getString(obj, key);
    if (str.isEmpty()) return QDateTime();
    return QDateTime::fromString(str, Qt::ISODate);
}

void setDateTime(QJsonObject& obj, const QString& key, const QDateTime& dt) {
    if (dt.isValid()) {
        obj[key] = dt.toString(Qt::ISODate);
    }
}

QStringList toStringList(const QJsonArray& arr) {
    QStringList result;
    result.reserve(arr.size());
    for (const QJsonValue& val : arr) {
        if (val.isString()) {
            result.append(val.toString());
        }
    }
    return result;
}

QList<qint64> toInt64List(const QJsonArray& arr) {
    QList<qint64> result;
    result.reserve(arr.size());
    for (const QJsonValue& val : arr) {
        if (val.isDouble()) {
            result.append(static_cast<qint64>(val.toDouble()));
        }
    }
    return result;
}

QJsonArray fromStringList(const QStringList& list) {
    QJsonArray arr;
    for (const QString& str : list) {
        arr.append(str);
    }
    return arr;
}

QJsonArray fromInt64List(const QList<qint64>& list) {
    QJsonArray arr;
    for (qint64 val : list) {
        arr.append(static_cast<double>(val));
    }
    return arr;
}

} // namespace JsonHelper
