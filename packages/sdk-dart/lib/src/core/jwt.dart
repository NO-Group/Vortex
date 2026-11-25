import 'dart:convert';

/// Decode a JWT payload WITHOUT verification (display / expiry checks only).
/// Returns `null` when the token is malformed.
Map<String, dynamic>? decodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length != 3) return null;

  var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
  while (payload.length % 4 != 0) {
    payload += '=';
  }

  try {
    final decoded = utf8.decode(base64.decode(payload));
    final map = json.decode(decoded);
    return map is Map<String, dynamic> ? map : null;
  } catch (_) {
    return null;
  }
}

/// Claim helpers over a decoded payload.
class JwtClaims {
  final Map<String, dynamic> payload;

  const JwtClaims(this.payload);

  static JwtClaims? tryParse(String token) {
    final payload = decodeJwtPayload(token);
    return payload == null ? null : JwtClaims(payload);
  }

  String? get subject => payload['sub'] as String?;
  String? get email => payload['email'] as String?;
  String? get role => payload['role'] as String?;
  String? get issuer => payload['iss'] as String?;

  DateTime? get issuedAt {
    final iat = (payload['iat'] as num?)?.toInt();
    return iat == null ? null : DateTime.fromMillisecondsSinceEpoch(iat * 1000);
  }

  DateTime? get expiresAt {
    final exp = (payload['exp'] as num?)?.toInt();
    return exp == null ? null : DateTime.fromMillisecondsSinceEpoch(exp * 1000);
  }

  bool isExpired({DateTime? at}) {
    final exp = expiresAt;
    if (exp == null) return false;
    return exp.isBefore(at ?? DateTime.now());
  }
}
