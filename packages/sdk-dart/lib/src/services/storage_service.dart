import '../core/vortex_client.dart';
import '../models/storage.dart';

/// Storage gateway client — `/v1/storage`.
class StorageService {
  final VortexClient _client;

  StorageService(this._client);

  /// Presign a direct upload URL (`POST /v1/storage/presign-upload`).
  Future<PresignedUrl> presignUpload({
    required String key,
    String? contentType,
    int expiresIn = 900,
  }) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/storage/presign-upload',
      body: {
        'key': key,
        if (contentType != null) 'contentType': contentType,
        'expiresIn': expiresIn,
      },
    );
    return PresignedUrl.fromJson(body);
  }

  /// Presign a direct download URL (`POST /v1/storage/presign-download`).
  Future<PresignedUrl> presignDownload({required String key, int expiresIn = 900}) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/storage/presign-download',
      body: {'key': key, 'expiresIn': expiresIn},
    );
    return PresignedUrl.fromJson(body);
  }

  /// Proxied upload through the engine (`POST /v1/storage/upload?key=`).
  Future<void> uploadBytes(
    String key,
    List<int> bytes, {
    String contentType = 'application/octet-stream',
  }) async {
    await _client.sendRaw(
      'POST',
      '/v1/storage/upload',
      body: bytes,
      contentType: contentType,
      query: {'key': key},
    );
  }

  /// Proxied download through the engine (`GET /v1/storage/object?key=`).
  Future<List<int>> downloadBytes(String key) {
    return _client.sendGetBytes('/v1/storage/object', query: {'key': key});
  }

  /// List objects owned by the authenticated user.
  Future<List<StorageObject>> list() async {
    final body = await _client.sendJson('GET', '/v1/storage/list');
    final objects = (body['objects'] as List<dynamic>? ?? const []);
    return objects
        .map((o) => StorageObject.fromJson(o as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// Delete an owned object.
  Future<void> delete(String key) async {
    await _client.sendJson('DELETE', '/v1/storage/object', body: {'key': key});
  }
}
