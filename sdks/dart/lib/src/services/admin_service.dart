import '../core/vortex_client.dart';

class AdminService {
  final VortexClient _c;
  AdminService(this._c);

  Future<Map<String, dynamic>> sql(String statement) async {
    return _c.sendJson('POST', '/v1/sql', body: {'sql': statement});
  }

  Future<List<Map<String, dynamic>>> listPolicies() async {
    final b = await _c.sendJson('GET', '/v1/policies');
    return (b['policies'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createPolicy(Map<String, dynamic> input) async {
    return _c.sendJson('POST', '/v1/policies', body: input);
  }

  Future<Map<String, dynamic>> previewPolicy(Map<String, dynamic> input) async {
    return _c.sendJson('POST', '/v1/policies/preview', body: input);
  }

  Future<List<Map<String, dynamic>>> listUsers() async {
    final b = await _c.sendJson('GET', '/v1/auth/users');
    return (b['users'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> queryLog([int limit = 50]) async {
    return _c.sendJson('GET', '/v1/insights/queries', query: {'limit': limit.toString()});
  }

  Future<Map<String, dynamic>> insightsOverview() async {
    return _c.sendJson('GET', '/v1/insights/overview');
  }
}
