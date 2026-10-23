/// Storage gateway models.
library;

/// A presigned upload/download URL.
class PresignedUrl {
  final String key;
  final String method;
  final String url;
  final Map<String, String> headers;
  final DateTime expiresAt;

  const PresignedUrl({
    required this.key,
    required this.method,
    required this.url,
    required this.headers,
    required this.expiresAt,
  });

  factory PresignedUrl.fromJson(Map<String, dynamic> json) {
    return PresignedUrl(
      key: json['key'] as String,
      method: json['method'] as String,
      url: json['url'] as String,
      headers: ((json['headers'] as Map<String, dynamic>?) ?? const {})
          .map((k, v) => MapEntry(k, v.toString())),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}

/// Metadata for a stored object.
class StorageObject {
  final String id;
  final String key;
  final int size;
  final String contentType;
  final String? ownerId;
  final DateTime createdAt;

  const StorageObject({
    required this.id,
    required this.key,
    required this.size,
    required this.contentType,
    required this.ownerId,
    required this.createdAt,
  });

  factory StorageObject.fromJson(Map<String, dynamic> json) {
    return StorageObject(
      id: json['id'] as String,
      key: json['key'] as String,
      size: (json['size'] as num?)?.toInt() ?? 0,
      contentType: (json['contentType'] as String?) ?? 'application/octet-stream',
      ownerId: json['ownerId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
