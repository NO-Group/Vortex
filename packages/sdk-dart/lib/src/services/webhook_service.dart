import '../core/vortex_client.dart';

/// Webhook engine client — `/v1/webhooks`.
class WebhookService {
  final VortexClient _client;

  WebhookService(this._client);

  /// Register a new webhook endpoint.
  Future<Map<String, dynamic>> create({
    required String url,
    required List<String> events,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/webhooks',
      body: {'url': url, 'events': events},
    );
  }

  /// List your webhooks.
  Future<List<Map<String, dynamic>>> list() async {
    final body = await _client.sendJson('GET', '/v1/webhooks');
    return (body['webhooks'] as List).cast<Map<String, dynamic>>();
  }

  /// Update a webhook (url, events, or active status).
  Future<Map<String, dynamic>> update(
    String webhookId, {
    String? url,
    List<String>? events,
    bool? active,
  }) async {
    return _client.sendJson(
      'PATCH',
      '/v1/webhooks/$webhookId',
      body: {
        if (url != null) 'url': url,
        if (events != null) 'events': events,
        if (active != null) 'active': active,
      },
    );
  }

  /// Delete a webhook.
  Future<void> delete(String webhookId) async {
    await _client.sendJson('DELETE', '/v1/webhooks/$webhookId');
  }

  /// Regenerate the signing secret for a webhook.
  Future<String> regenerateSecret(String webhookId) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/webhooks/$webhookId/secret',
    );
    return body['secret'] as String;
  }

  /// View delivery history for a webhook.
  Future<List<Map<String, dynamic>>> log(String webhookId, {int limit = 50}) async {
    final body = await _client.sendJson(
      'GET',
      '/v1/webhooks/$webhookId/log?limit=$limit',
    );
    return (body['log'] as List).cast<Map<String, dynamic>>();
  }
}
