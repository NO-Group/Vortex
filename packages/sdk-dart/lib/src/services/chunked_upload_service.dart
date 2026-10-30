/// Chunked / multipart upload client — `/v1/storage/chunked`.
library;

import '../core/vortex_client.dart';

class ChunkedUploadService {
  ChunkedUploadService(this._client);

  final VortexClient _client;

  /// Initialize a chunked upload session.
  Future<Map<String, dynamic>> init(String key, int totalChunks, {String? contentType}) async {
    return _client.sendJson('POST', '/v1/storage/chunked/init', body: {
      'key': key,
      'totalChunks': totalChunks,
      if (contentType != null) 'contentType': contentType,
    });
  }

  /// Upload a single chunk (raw body).
  Future<Map<String, dynamic>> uploadChunk(
    String uploadId,
    int chunkIndex,
    int totalChunks,
    Uint8List body,
    String contentType,
  ) async {
    final params = {'uploadId': uploadId, 'chunkIndex': '$chunkIndex', 'totalChunks': '$totalChunks'};
    return _client.sendRaw('PUT', '/v1/storage/chunked/chunk', body: body, contentType: contentType, query: params);
  }

  /// Complete the upload — assemble chunks into the final object.
  Future<Map<String, dynamic>> complete(String uploadId) async {
    return _client.sendJson('POST', '/v1/storage/chunked/complete', body: {'uploadId': uploadId});
  }

  /// Check upload progress.
  Future<Map<String, dynamic>> status(String uploadId) async {
    return _client.sendJson('GET', '/v1/storage/chunked/status', query: {'uploadId': uploadId});
  }

  /// Abort an upload session.
  Future<void> abort(String uploadId) async {
    await _client.sendJson('POST', '/v1/storage/chunked/abort', body: {'uploadId': uploadId});
  }

  /// Bulk delete multiple objects at once.
  Future<Map<String, dynamic>> bulkDelete(List<String> keys) async {
    return _client.sendJson('POST', '/v1/storage/bulk-delete', body: {'keys': keys});
  }
}
