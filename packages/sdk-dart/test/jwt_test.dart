import 'package:flutter_test/flutter_test.dart';
import 'package:vortex_client/vortex.dart';

void main() {
  group('decodeJwtPayload', () {
    // base64url('{"sub":"u1","role":"user","exp":1}')
    const fixture1 = 'eyJzdWIiOiJ1MSIsInJvbGUiOiJ1c2VyIiwiZXhwIjoxfQ';

    test('decodes a well-formed token payload', () {
      final claims = decodeJwtPayload('h.$fixture1.s');
      expect(claims, isNotNull);
      expect(claims!['sub'], 'u1');
      expect(claims['role'], 'user');
      expect(claims['exp'], 1);
    });

    test('rejects malformed tokens', () {
      expect(decodeJwtPayload('garbage'), isNull);
      expect(decodeJwtPayload('a.b'), isNull);
      expect(decodeJwtPayload('h.!!!not-base64!!!.s'), isNull);
      expect(decodeJwtPayload('h.$fixture1'), isNull);
    });
  });

  group('JwtClaims', () {
    // base64url('{"sub":"u1","email":"a@b.co","role":"user","iss":"vortex","iat":1000,"exp":2000}')
    const fixture2 =
        'eyJzdWIiOiJ1MSIsImVtYWlsIjoiYUBiLmNvIiwicm9sZSI6InVzZXIiLCJpc3MiOiJ2b3J0ZXgiLCJpYXQiOjEwMDAsImV4cCI6MjAwMH0';

    test('exposes standard claims and expiry', () {
      final claims = JwtClaims.tryParse('h.$fixture2.s');
      expect(claims, isNotNull);
      expect(claims!.subject, 'u1');
      expect(claims.email, 'a@b.co');
      expect(claims.role, 'user');
      expect(claims.issuer, 'vortex');
      expect(claims.issuedAt, DateTime.fromMillisecondsSinceEpoch(1000 * 1000));
      expect(
        claims.isExpired(at: DateTime.fromMillisecondsSinceEpoch(3000 * 1000)),
        isTrue,
      );
      expect(
        claims.isExpired(at: DateTime.fromMillisecondsSinceEpoch(1500 * 1000)),
        isFalse,
      );
    });

    test('returns null for garbage', () {
      expect(JwtClaims.tryParse('nope'), isNull);
    });
  });
}
