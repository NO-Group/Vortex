import 'package:vortex/vortex.dart';

/// Security scoring client — `/v1/security`.
class VortexSecurityScore {
  final VortexClient _client;

  VortexSecurityScore(this._client);

  /// Get security posture score for the authenticated user.
  Future<SecurityPostureScore> get() async {
    final data = await _client.request('/v1/security/score');
    return SecurityPostureScore.fromMap(data);
  }

  /// Get historical security scores.
  Future<List<SecurityScoreEntry>> getHistory() async {
    final data = await _client.request('/v1/security/history');
    return (data['history'] as List)
        .map((e) => SecurityScoreEntry.fromMap(e as Map))
        .toList();
  }

  /// Get encryption at rest information.
  Future<EncryptionInfo> getEncryptionInfo() async {
    final data = await _client.request('/v1/security/encryption');
    return EncryptionInfo.fromMap(data);
  }
}
