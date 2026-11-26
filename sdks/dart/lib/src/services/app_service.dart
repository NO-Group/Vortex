import '../core/vortex_client.dart';

class AppService {
  final VortexClient _c;
  AppService(this._c);

  Future<Map<String, dynamic>> create(String name, String title) async {
    return _c.sendJson('POST', '/v1/apps', body: {'name': name, 'title': title});
  }

  Future<List<Map<String, dynamic>>> list() async {
    final b = await _c.sendJson('GET', '/v1/apps');
    return (b['apps'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> uploadFile(String app, String path, String content) async {
    return _c.sendJson('POST', '/v1/apps/$app/files', body: {'path': path, 'content': content});
  }

  Future<Map<String, dynamic>> delete(String app) async {
    return _c.sendJson('DELETE', '/v1/apps/$app');
  }
}
