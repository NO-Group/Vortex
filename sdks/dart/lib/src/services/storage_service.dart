import '../core/vortex_client.dart';

class StorageService {
  final VortexClient _c;
  StorageService(this._c);

  Future<Map<String, dynamic>> createBucket(String name, {bool isPublic = false}) async {
    return _c.sendJson('POST', '/v1/storage/buckets', body: {'name': name, 'isPublic': isPublic});
  }

  Future<List<Map<String, dynamic>>> listBuckets() async {
    final b = await _c.sendJson('GET', '/v1/storage/buckets');
    return (b['buckets'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> presignUpload(String path) async {
    return _c.sendJson('POST', '/v1/storage/presign-upload', body: {'path': path});
  }

  Future<List<Map<String, dynamic>>> listObjects(String bucket, {String prefix = ''}) async {
    final b = await _c.sendJson('GET', '/v1/storage/list', query: {'bucket': bucket, 'prefix': prefix});
    return (b['objects'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> deleteObject(String bucket, String path) async {
    return _c.sendJson('DELETE', '/v1/storage/object', body: {'bucket': bucket, 'path': path});
  }

  String imageUrl(String bucket, String path, {Map<String, dynamic>? opts}) {
    final params = opts?.map((k, v) => '$k=${v.toString()}').join('&');
    return '${_c.baseUrl}/v1/storage/public/$bucket/$path${params != null ? '?$params' : ''}';
  }
}
