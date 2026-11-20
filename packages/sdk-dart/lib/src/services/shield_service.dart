/// Shield / AppCheck client — `/v1/shield`.
library;

import '../core/vortex_client.dart';

class ShieldService {
  ShieldService(this._client);

  final VortexClient _client;

  /// Verify a client attestation (AppCheck / Play Integrity / SafetyNet).
  Future<Map<String, dynamic>> attest(String attestationType, Map<String, dynamic> payload) async {
    return _client.sendJson('POST', '/v1/shield/attest', body: {
      'attestationType': attestationType,
      'payload': payload,
    });
  }

  /// List recent attestations.
  Future<List<Map<String, dynamic>>> listAttestations() async {
    final data = await _client.sendJson('GET', '/v1/shield/attestations');
    return (data['attestations'] as List).map((e) => e as Map<String, dynamic>).toList();
  }

  /// Verify a request signature.
  Future<Map<String, dynamic>> verifySignature(
    String method,
    String path,
    String body,
    int timestamp,
    String signature,
    String algorithm,
  ) async {
    return _client.sendJson('POST', '/v1/shield/signature/verify', body: {
      'method': method,
      'path': path,
      'body': body,
      'timestamp': timestamp,
      'signature': signature,
      'algorithm': algorithm,
    });
  }

  /// Generate a signature for a request (for client-side signing).
  Future<Map<String, dynamic>> generateSignature(
    String method,
    String path,
    String body,
    int timestamp,
    String algorithm,
  ) async {
    return _client.sendJson('POST', '/v1/shield/signature/generate', body: {
      'method': method,
      'path': path,
      'body': body,
      'timestamp': timestamp,
      'algorithm': algorithm,
    });
  }

  /// Check current IP throttle status.
  Future<Map<String, dynamic>> throttle() async {
    return _client.sendJson('GET', '/v1/shield/throttle');
  }

  /// Shield health check.
  Future<Map<String, dynamic>> health() async {
    return _client.sendJson('GET', '/v1/shield/health');
  }
}
