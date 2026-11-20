import 'package:vortex/vortex.dart';

/// Password security client — `/v1/auth/password-security`.
class VortexPasswordSecurity {
  final VortexClient _client;

  VortexPasswordSecurity(this._client);

  /// Check if a password is in a known breached list.
  Future<bool> checkBreached(String password) async {
    final data = await _client.request(
        '/v1/auth/password-security/check?password=$password');
    return data['breached'] as bool;
  }

  /// Get password history for the authenticated user.
  Future<List<PasswordHistoryEntry>> getHistory() async {
    final data = await _client.request('/v1/auth/password-security/history');
    return (data['history'] as List)
        .map((e) => PasswordHistoryEntry.fromMap(e as Map))
        .toList();
  }

  /// Get lockout status for the authenticated user.
  Future<PasswordSecurityStatus> getLockoutStatus() async {
    final data = await _client.request('/v1/auth/password-security/lockout');
    return PasswordSecurityStatus.fromMap(data);
  }

  /// Validate a new password for strength, breaches, and reuse.
  Future<PasswordValidationResult> validatePassword(String password) async {
    final data = await _client.request('/v1/auth/password-security/validate',
        method: 'POST', body: {'password': password});
    return PasswordValidationResult.fromMap(data);
  }
}
