import '../core/vortex_client.dart';

/// Audit trail client — `/v1/audit`.
class AuditService {
  final VortexClient _client;

  AuditService(this._client);

  /// List audit log entries.
  Future<List<Map<String, dynamic>>> log({
    String? action,
    int limit = 50,
    int offset = 0,
  }) async {
    final params = <String>[];
    if (action != null) params.add('action=$action');
    params.add('limit=$limit');
    params.add('offset=$offset');
    final body = await _client.sendJson(
      'GET',
      '/v1/audit/log?${params.join('&')}',
    );
    return (body['entries'] as List).cast<Map<String, dynamic>>();
  }

  /// Get audit statistics.
  Future<Map<String, dynamic>> stats({String? userId}) async {
    final params = <String>[];
    if (userId != null) params.add('userId=$userId');
    final path = params.isEmpty
        ? '/v1/audit/stats'
        : '/v1/audit/stats?${params.join('&')}';
    return _client.sendJson('GET', path);
  }
}
