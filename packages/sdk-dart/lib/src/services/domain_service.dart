import '../core/vortex_client.dart';

/// Custom domains client — `/v1/apps/:name/domains`.
class DomainService {
  final VortexClient _client;

  DomainService(this._client);

  /// Add a custom domain to an app.
  Future<Map<String, dynamic>> addDomain(String appName, String domain) async {
    return _client.sendJson(
      'POST',
      '/v1/apps/$appName/domains',
      body: {'domain': domain},
    );
  }

  /// List custom domains for an app.
  Future<List<Map<String, dynamic>>> listDomains(String appName) async {
    final body = await _client.sendJson('GET', '/v1/apps/$appName/domains');
    return (body['domains'] as List).cast<Map<String, dynamic>>();
  }

  /// Remove a custom domain from an app.
  Future<void> removeDomain(String appName, String domainId) async {
    await _client.sendJson('DELETE', '/v1/apps/$appName/domains/$domainId');
  }

  /// Verify a custom domain's DNS and activate it.
  Future<Map<String, dynamic>> verifyDomain(String appName, String domainId) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/apps/$appName/domains/$domainId/verify',
    );
    return body['domain'] as Map<String, dynamic>;
  }
}
