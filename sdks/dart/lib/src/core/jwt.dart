import 'dart:convert';

class JwtClaims {
  final String? sub;
  final String? email;
  final String? role;
  final Map<String, dynamic>? metadata;

  JwtClaims({this.sub, this.email, this.role, this.metadata});

  factory JwtClaims.tryParse(String token) {
    try {
      final parts = token.split('.');
      if (parts.length < 2) return null;
      final payload = json.decode(base64.decode(
        base64.normalize(parts[1]).replaceAll('-', '+').replaceAll('_', '/'),
      ).toStringUtf8());
      return JwtClaims(
        sub: payload['sub'],
        email: payload['email'],
        role: payload['role'],
        metadata: payload['metadata'],
      );
    } catch (_) {
      return null;
    }
  }
}
