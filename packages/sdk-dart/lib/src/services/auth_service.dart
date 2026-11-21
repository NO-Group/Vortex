import '../core/vortex_client.dart';
import '../models/auth.dart';

/// Auth engine client — `/v1/auth`.
class AuthService {
  final VortexClient _client;

  AuthService(this._client);

  /// Register a new account and start a session.
  Future<VortexSession> signUp({
    required String email,
    required String password,
    Map<String, dynamic>? metadata,
  }) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/auth/signup',
      auth: false,
      body: {
        'email': email,
        'password': password,
        if (metadata != null) 'metadata': metadata,
      },
    );
    final session = VortexSession.fromJson(body);
    _client.accessToken = session.token;
    return session;
  }

  /// Exchange credentials for an access token.
  /// If 2FA is enabled, returns a challenge instead of a session.
  Future<Map<String, dynamic>> signIn({
    required String email,
    required String password,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/auth/login',
      auth: false,
      body: {'email': email, 'password': password},
    );
  }

  /// Complete 2FA login with a temp token and code.
  Future<VortexSession> verify2FA({
    required String tempToken,
    required String code,
  }) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/auth/2fa/verify',
      auth: false,
      body: {'tempToken': tempToken, 'code': code},
    );
    final session = VortexSession.fromJson(body);
    _client.accessToken = session.token;
    return session;
  }

  /// Begin 2FA enrollment — returns secret, otpauth URL, and backup codes.
  Future<Map<String, dynamic>> setup2FA() async {
    return _client.sendJson('POST', '/v1/auth/2fa/setup');
  }

  /// Confirm 2FA enrollment with a 6-digit code.
  Future<Map<String, dynamic>> enable2FA({required String code}) async {
    return _client.sendJson(
      'POST',
      '/v1/auth/2fa/enable',
      body: {'code': code},
    );
  }

  /// Disable 2FA (requires password + current code).
  Future<Map<String, dynamic>> disable2FA({
    required String password,
    required String code,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/auth/2fa/disable',
      body: {'password': password, 'code': code},
    );
  }

  /// Regenerate backup codes.
  Future<Map<String, dynamic>> regenerateBackupCodes() async {
    return _client.sendJson('POST', '/v1/auth/2fa/backup-codes');
  }

  /// Profile of the authenticated user (`GET /v1/auth/me`).
  Future<VortexUser> getUser() async {
    final body = await _client.sendJson('GET', '/v1/auth/me');
    return VortexUser.fromJson(body['user'] as Map<String, dynamic>);
  }

  /// Drop the local session (token is held client-side only).
  void signOut() {
    _client.signOut();
  }

  /// Update your own profile metadata.
  Future<VortexUser> updateProfile({required Map<String, dynamic> metadata}) async {
    final body = await _client.sendJson(
      'PATCH',
      '/v1/auth/profile',
      body: {'metadata': metadata},
    );
    return VortexUser.fromJson(body['user'] as Map<String, dynamic>);
  }

  /// Change your password (verifies current password first).
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _client.sendJson(
      'POST',
      '/v1/auth/password',
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  /// Delete your own account (irreversible).
  Future<void> deleteAccount() async {
    await _client.sendJson('DELETE', '/v1/auth/account');
  }
}
