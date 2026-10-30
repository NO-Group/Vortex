/// QR Code sign-in client — `/v1/auth/qr-code`.
library;

import '../core/vortex_client.dart';

class QrCodeService {
  QrCodeService(this._client);

  final VortexClient _client;

  /// Generate a QR code sign-in session for the authenticated user.
  Future<Map<String, dynamic>> init() async {
    return _client.sendJson('POST', '/v1/auth/qr-code/init');
  }

  /// Verify a scanned QR token and receive a session.
  Future<Map<String, dynamic>> verify(String token) async {
    return _client.sendJson('POST', '/v1/auth/qr-code/verify', body: {'token': token});
  }
}
