/// Media transformation client — `/v1/storage/transformations`.
library;

import '../core/vortex_client.dart';

class TransformationsService {
  TransformationsService(this._client);

  final VortexClient _client;

  /// Request a media transformation.
  Future<Map<String, dynamic>> request(
    String key,
    String operation,
    Map<String, dynamic> params,
  ) async {
    return _client.sendJson('POST', '/v1/storage/transformations', body: {
      'key': key,
      'operation': operation,
      'params': params,
    });
  }

  /// List transformations for the caller.
  Future<List<Map<String, dynamic>>> list() async {
    final data = await _client.sendJson('GET', '/v1/storage/transformations');
    return (data['transformations'] as List).map((e) => e as Map<String, dynamic>).toList();
  }

  /// Get a single transformation by id.
  Future<Map<String, dynamic>> get(String id) async {
    return _client.sendJson('GET', '/v1/storage/transformations/$id');
  }

  /// Delete a transformation record.
  Future<void> delete(String id) async {
    await _client.sendJson('DELETE', '/v1/storage/transformations/$id');
  }
}
