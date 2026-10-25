import 'dart:convert';

import 'package:http/http.dart' as http;

import '../services/auth_service.dart';
import '../services/db_service.dart';
import '../services/realtime_service.dart';
import '../services/storage_service.dart';
import '../services/webhook_service.dart';
import '../services/function_service.dart';
import '../services/audit_service.dart';
import 'api_exception.dart';
import 'jwt.dart';

/// The official Vortex client facade.
///
/// ```dart
/// final vortex = VortexClient(baseUrl: 'https://api.example.com');
/// final session = await vortex.auth.signIn(email: 'a@b.co', password: '…');
/// final notes = await vortex.db.from('notes').limit(10).execute();
/// ```
class VortexClient {
  /// Base URL of the Vortex engine (no trailing slash).
  final String baseUrl;

  /// Inject a custom HTTP client (e.g. `MockClient` in tests).
  final http.Client _http;

  late final AuthService auth = AuthService(this);
  late final DbService db = DbService(this);
  late final StorageService storage = StorageService(this);
  late final RealtimeService realtime = RealtimeService(this);
  late final WebhookService webhooks = WebhookService(this);
  late final FunctionService functions = FunctionService(this);
  late final AuditService audit = AuditService(this);

  String? _accessToken;

  VortexClient({
    required this.baseUrl,
    http.Client? httpClient,
    String? accessToken,
  })  : _http = httpClient ?? http.Client(),
        _accessToken = accessToken;

  // ── Token session state ───────────────────────────────────────────────

  String? get accessToken => _accessToken;

  set accessToken(String? token) => _accessToken = token;

  /// Restore a previously persisted session from a raw JWT.
  void restoreSession(String token) {
    _accessToken = token;
  }

  /// Claims of the current access token (unverified decode), or `null`.
  JwtClaims? get claims {
    final token = _accessToken;
    return token == null ? null : JwtClaims.tryParse(token);
  }

  bool get isAuthenticated => _accessToken != null;

  /// Drop the in-memory session.
  void signOut() {
    _accessToken = null;
  }

  void dispose() {
    realtime.dispose();
    _http.close();
  }

  // ── HTTP core ─────────────────────────────────────────────────────────

  Uri _uri(String path, [Map<String, String>? query]) {
    final normalized = baseUrl.replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$normalized$path').replace(queryParameters: query);
  }

  Map<String, String> _headers({bool auth = true, String? contentType}) {
    final headers = <String, String>{};
    if (contentType != null) headers['content-type'] = contentType;
    if (auth && _accessToken != null) {
      headers['authorization'] = 'Bearer $_accessToken';
    }
    return headers;
  }

  /// Send a JSON request and return the decoded body.
  Future<Map<String, dynamic>> sendJson(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    Map<String, String>? query,
  }) async {
    final uri = _uri(path, query);
    final headers = _headers(auth: auth, contentType: 'application/json');
    final encoded = body == null ? null : json.encode(body);

    final http.Response res;
    switch (method.toUpperCase()) {
      case 'GET':
        res = await _http.get(uri, headers: headers);
      case 'POST':
        res = await _http.post(uri, headers: headers, body: encoded);
      case 'PATCH':
        res = await _http.patch(uri, headers: headers, body: encoded);
      case 'DELETE':
        res = await _http.delete(uri, headers: headers, body: encoded);
      case 'PUT':
        res = await _http.put(uri, headers: headers, body: encoded);
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }
    return _decode(res);
  }

  /// Send a raw-body request (storage uploads) and return the decoded body.
  Future<Map<String, dynamic>> sendRaw(
    String method,
    String path, {
    required List<int> body,
    String contentType = 'application/octet-stream',
    Map<String, String>? query,
  }) async {
    final uri = _uri(path, query);
    final headers = _headers(auth: true, contentType: contentType);

    final http.Response res;
    switch (method.toUpperCase()) {
      case 'POST':
        res = await _http.post(uri, headers: headers, body: body);
      case 'PUT':
        res = await _http.put(uri, headers: headers, body: body);
      default:
        throw ArgumentError('Unsupported raw HTTP method: $method');
    }
    return _decode(res);
  }

  /// Fetch raw bytes (storage downloads).
  Future<List<int>> sendGetBytes(String path, {Map<String, String>? query}) async {
    final res = await _http.get(_uri(path, query), headers: _headers());
    if (res.statusCode >= 400) {
      throw VortexException.fromBody(res.statusCode, _tryDecode(res.body));
    }
    return res.bodyBytes;
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
    try {
      return json.decode(body);
    } catch (_) {
      return null;
    }
  }
}
