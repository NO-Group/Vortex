import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:vortex_client/vortex.dart';

void main() {
  group('VortexClient + DbQuery over MockClient', () {
    test('select builds the gateway query body', () async {
      late http.Request captured;

      final client = VortexClient(
        baseUrl: 'https://api.example.com/',
        httpClient: MockClient((request) async {
          captured = request;
          return http.Response(
            json.encode({
              'rows': [
                {'id': 1, 'title': 'hello'}
              ],
              'count': 1,
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
        accessToken: 'test-token',
      );

      final result = await client.db
          .from('notes')
          .select(['id', 'title'])
          .like('title', '%hel%')
          .order('created_at', direction: 'desc')
          .limit(10)
          .execute();

      expect(captured.method, 'POST');
      expect(captured.url.path, '/v1/db/notes/query');
      expect(captured.headers['authorization'], 'Bearer test-token');

      final body = json.decode(captured.body) as Map<String, dynamic>;
      expect(body['select'], ['id', 'title']);
      expect(body['filters'], [
        {'column': 'title', 'op': 'like', 'value': '%hel%'}
      ]);
      expect(body['orderBy'], [
        {'column': 'created_at', 'direction': 'desc'}
      ]);
      expect(body['limit'], 10);

      expect(result.count, 1);
      expect(result.rows.first['title'], 'hello');
    });

    test('insert posts rows and parses the result', () async {
      late http.Request captured;
      final client = VortexClient(
        baseUrl: 'https://api.example.com',
        httpClient: MockClient((request) async {
          captured = request;
          return http.Response(
            json.encode({
              'rows': [
                {'id': 'r1', 'title': 'x', 'owner_id': 'u1'}
              ],
              'count': 1,
            }),
            201,
          );
        }),
        accessToken: 't',
      );

      final res = await client.db.from('notes').insert({'title': 'x'});
      expect(captured.url.path, '/v1/db/notes');
      expect(json.decode(captured.body), {
        'rows': [
          {'title': 'x'}
        ]
      });
      expect(res.rows.first['owner_id'], 'u1');
    });

    test('update and delete require filters', () async {
      final client = VortexClient(
        baseUrl: 'https://api.example.com',
        httpClient: MockClient((_) async => http.Response('{}', 200)),
        accessToken: 't',
      );

      final query = client.db.from('notes');
      expect(
        () => query.update({'title': 'y'}),
        throwsA(isA<VortexException>()),
      );

      final query2 = client.db.from('notes');
      expect(() => query2.delete(), throwsA(isA<VortexException>()));
    });

    test('error envelopes surface as VortexException', () async {
      final client = VortexClient(
        baseUrl: 'https://api.example.com',
        httpClient: MockClient((_) async {
          return http.Response(
            json.encode({
              'error': {'code': 'forbidden', 'message': 'Insufficient permissions'}
            }),
            403,
          );
        }),
        accessToken: 't',
      );

      expect(
        () => client.db.from('users').limit(1).execute(),
        throwsA(
          isA<VortexException>()
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.code, 'code', 'forbidden'),
        ),
      );
    });

    test('auth sign-in stores the session token', () async {
      final client = VortexClient(
        baseUrl: 'https://api.example.com',
        httpClient: MockClient((request) async {
          expect(request.url.path, '/v1/auth/login');
          return http.Response(
            json.encode({
              'user': {
                'id': 'u1',
                'email': 'a@b.co',
                'role': 'user',
                'metadata': {'team': 'n-o'},
                'createdAt': '2026-10-23T00:00:00.000Z',
              },
              'token': 'jwt-token',
              'expiresIn': 3600,
            }),
            200,
          );
        }),
      );

      expect(client.isAuthenticated, isFalse);
      final session = await client.auth.signIn(email: 'a@b.co', password: 'p');
      expect(session.user.email, 'a@b.co');
      expect(session.user.metadata['team'], 'n-o');
      expect(client.isAuthenticated, isTrue);
      expect(client.accessToken, 'jwt-token');
    });
  });
}
