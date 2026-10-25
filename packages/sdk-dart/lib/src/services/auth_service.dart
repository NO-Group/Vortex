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
  Future<VortexSession> signIn({
    required String email,
    required String password,
  }) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/auth/login',
      auth: false,
      body: {'email': email, 'password': password},
    );
    final session = VortexSession.fromJson(body);
    _client.accessToken = session.token;
    return session;
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
