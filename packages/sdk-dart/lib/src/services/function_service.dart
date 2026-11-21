import '../core/vortex_client.dart';

/// Functions engine client — `/v1/functions`.
class FunctionService {
  final VortexClient _client;

  FunctionService(this._client);

  /// Deploy a new function.
  Future<Map<String, dynamic>> deploy({
    required String name,
    required String source,
    String? title,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/functions',
      body: {'name': name, 'source': source, if (title != null) 'title': title},
    );
  }

  /// List your functions.
  Future<List<Map<String, dynamic>>> list() async {
    final body = await _client.sendJson('GET', '/v1/functions');
    return (body['functions'] as List).cast<Map<String, dynamic>>();
  }

  /// Get a function's details.
  Future<Map<String, dynamic>> get(String name) async {
    final body = await _client.sendJson('GET', '/v1/functions/$name');
    return body['function'] as Map<String, dynamic>;
  }

  /// Update a function (source, title, or status).
  Future<Map<String, dynamic>> update(
    String name, {
    String? source,
    String? title,
    String? status,
  }) async {
    return _client.sendJson(
      'PATCH',
      '/v1/functions/$name',
      body: {
        if (source != null) 'source': source,
        if (title != null) 'title': title,
        if (status != null) 'status': status,
      },
    );
  }

  /// Delete a function.
  Future<void> delete(String name) async {
    await _client.sendJson('DELETE', '/v1/functions/$name');
  }

  /// Invoke a function via HTTP.
  Future<Map<String, dynamic>> invoke(String name, {
    Map<String, dynamic>? headers,
    body,
  }) async {
    return _client.sendJson('POST', '/v1/functions/$name', body: body);
  }
}
