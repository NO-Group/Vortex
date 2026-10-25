import '../core/vortex_client.dart';

/// API keys client — `/v1/api-keys`.
class ApiKeyService {
  final VortexClient _client;

  ApiKeyService(this._client);

  /// Create a new API key. The full key is returned only at creation.
  Future<Map<String, dynamic>> create({
    required String name,
    List<String>? scopes,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/api-keys',
      body: {'name': name, if (scopes != null) 'scopes': scopes},
    );
  }

  /// List active API keys.
  Future<List<Map<String, dynamic>>> list() async {
    final body = await _client.sendJson('GET', '/v1/api-keys');
    return (body['apiKeys'] as List).cast<Map<String, dynamic>>();
  }

  /// Revoke (delete) an API key. Irreversible.
  Future<void> revoke(String apiKeyId) async {
    await _client.sendJson('DELETE', '/v1/api-keys/$apiKeyId');
  }
}
