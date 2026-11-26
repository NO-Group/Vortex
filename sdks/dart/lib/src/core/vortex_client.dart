import 'dart:convert';
import 'package:http/http.dart' as http;

import '../services/auth_service.dart';
import '../services/db_service.dart';
import '../services/realtime_service.dart';
import '../services/storage_service.dart';
import '../services/function_service.dart';
import '../services/app_service.dart';
import '../services/billing_service.dart';
import '../services/admin_service.dart';
import 'api_exception.dart';

class VortexClient {
  final String baseUrl;
  final http.Client _http;
  String? _accessToken;

  late final AuthService auth = AuthService(this);
  late final DbService db = DbService(this);
  late final StorageService storage = StorageService(this);
  late final RealtimeService realtime = RealtimeService(this);
  late final FunctionService functions = FunctionService(this);
  late final AppService apps = AppService(this);
  late final BillingService billing = BillingService(this);
  late final AdminService admin = AdminService(this);

  VortexClient({required this.baseUrl, http.Client? httpClient, String? accessToken})
      : _http = httpClient ?? http.Client(),
        _accessToken = accessToken;

  String? get accessToken => _accessToken;
  set accessToken(String? token) => _accessToken = token;

  void restoreSession(String token) => _accessToken = token;
  bool get isAuthenticated => _accessToken != null;

  void signOut() => _accessToken = null;

  void dispose() {
    realtime.dispose();
    _http.close();
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final normalized = baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$normalized$path').replace(queryParameters: query);
  }

  Map<String, String> _headers({bool auth = true, String? contentType}) {
    final h = <String, String>{};
    if (contentType != null) h['content-type'] = contentType;
    if (auth && _accessToken != null) h['authorization'] = 'Bearer $_accessToken';
    return h;
  }

  Future<Map<String, dynamic>> sendJson(
    String method, String path,
    {Map<String, dynamic>? body, bool auth = true, Map<String, String>? query}) async {
    final uri = _uri(path, query);
    final headers = _headers(auth: auth, contentType: 'application/json');
    final encoded = body == null ? null : json.encode(body);
    final http.Response res;
    switch (method.toUpperCase()) {
      case 'GET': res = await _http.get(uri, headers: headers);
      case 'POST': res = await _http.post(uri, headers: headers, body: encoded);
      case 'PATCH': res = await _http.patch(uri, headers: headers, body: encoded);
      case 'DELETE': res = await _http.delete(uri, headers: headers, body: encoded);
      default: throw ArgumentError('Unsupported HTTP method: $method');
    }
    return _decode(res);
  }

  Map<String, dynamic> _decode(http.Response res) {
    final decoded = _tryDecode(res.body);
    if (res.statusCode >= 400) {
      throw VortexException.fromBody(res.statusCode, decoded);
    }
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  dynamic _tryDecode(String body) {
    if (body.isEmpty) return null;
    try { return json.decode(body); } catch (_) { return null; }
  }
}
