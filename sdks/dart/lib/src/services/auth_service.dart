import '../core/vortex_client.dart';

class AuthService {
  final VortexClient _c;
  AuthService(this._c);

  Future<Map<String, dynamic>> signIn({required String email, required String password}) async {
    return _c.sendJson('POST', '/v1/auth/login', body: {'email': email, 'password': password});
  }

  Future<Map<String, dynamic>> signUp({required String email, required String password, Map<String, dynamic>? metadata}) async {
    return _c.sendJson('POST', '/v1/auth/signup', body: {
      'email': email, 'password': password,
      if (metadata != null) 'metadata': metadata,
    });
  }

  Future<Map<String, dynamic>> requestMagicLink(String email) async {
    return _c.sendJson('POST', '/v1/auth/magic-link', body: {'email': email});
  }

  Future<Map<String, dynamic>> verifyMagicLink(String token) async {
    return _c.sendJson('POST', '/v1/auth/magic-link/verify', body: {'token': token});
  }

  Future<Map<String, dynamic>> me() async {
    return _c.sendJson('GET', '/v1/auth/me');
  }

  Future<List<Map<String, dynamic>>> listOAuthProviders() async {
    final b = await _c.sendJson('GET', '/v1/auth/oauth/providers', auth: false);
    return (b['providers'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> listOAuthAccounts() async {
    final b = await _c.sendJson('GET', '/v1/auth/oauth/accounts');
    return (b['accounts'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> registerDevice({required String token, required String platform, String? pushService}) async {
    return _c.sendJson('POST', '/v1/notifications/devices', body: {
      'token': token, 'platform': platform,
      if (pushService != null) 'pushService': pushService,
    });
  }

  Future<Map<String, dynamic>> sendNotification({required String title, required String body, Map<String, dynamic>? data}) async {
    return _c.sendJson('POST', '/v1/notifications', body: {
      'title': title, 'body': body,
      if (data != null) 'data': data,
    });
  }
}
