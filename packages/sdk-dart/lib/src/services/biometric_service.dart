/// Biometric authentication client — `/v1/auth/biometric`.
library;

import '../core/vortex_client.dart';

class BiometricService {
  BiometricService(this._client);

  final VortexClient _client;

  /// Issue a verification challenge.
  Future<Map<String, dynamic>> challenge({String kind = 'facial_liveness'}) async {
    return _client.sendJson('POST', '/v1/auth/biometric/challenge', body: {'kind': kind});
  }

  /// Verify a liveness-check payload against the challenge.
  Future<Map<String, dynamic>> verify(
    String challengeId,
    String kind,
    Map<String, dynamic> payload,
  ) async {
    return _client.sendJson('POST', '/v1/auth/biometric/verify', body: {
      'challengeId': challengeId,
      'kind': kind,
      'payload': payload,
    });
  }

  /// List recent biometric attestations.
  Future<List<Map<String, dynamic>>> listAttestations() async {
    final data = await _client.sendJson('GET', '/v1/auth/biometric/attestations');
    return (data['attestations'] as List).map((e) => e as Map<String, dynamic>).toList();
  }

  /// Get a single attestation by id.
  Future<Map<String, dynamic>> getAttestation(String id) async {
    return _client.sendJson('GET', '/v1/auth/biometric/attestations/$id');
  }
}
