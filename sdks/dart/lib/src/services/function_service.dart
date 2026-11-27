import '../core/vortex_client.dart';

class FunctionService {
  final VortexClient _c;
  FunctionService(this._c);

  Future<Map<String, dynamic>> deploy(String name, String code, {String description = ''}) async {
    return _c.sendJson('POST', '/v1/functions', body: {'name': name, 'code': code, 'description': description});
  }

  Future<List<Map<String, dynamic>>> list() async {
    final b = await _c.sendJson('GET', '/v1/functions');
    return (b['functions'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> invoke(String name, Map<String, dynamic> data) async {
    return _c.sendJson('POST', '/functions/$name', body: data, auth: false);
  }

  Future<Map<String, dynamic>> update(String name, Map<String, dynamic> updates) async {
    return _c.sendJson('PATCH', '/v1/functions/$name', body: updates);
  }

  Future<Map<String, dynamic>> delete(String name) async {
    return _c.sendJson('DELETE', '/v1/functions/$name');
  }
}
