import 'package:vortex/vortex.dart';

/// Session management client — `/v1/auth/sessions`.
class VortexSessions {
  final VortexClient _client;

  VortexSessions(this._client);

  /// List active sessions for the authenticated user.
  Future<List<UserSession>> list() async {
    final data = await _client.request('/v1/auth/sessions');
    return (data['sessions'] as List)
        .map((e) => UserSession.fromMap(e as Map))
        .toList();
  }

  /// Revoke a single session.
  Future<void> revoke(String sessionId) async {
    await _client.request('/v1/auth/sessions/revoke',
        method: 'POST', body: {'sessionId': sessionId});
  }

  /// Revoke all sessions except the current one.
  Future<int> revokeAll() async {
    final data = await _client.request('/v1/auth/sessions/revoke-all',
        method: 'POST');
    return data['revoked'] as int;
  }
}
