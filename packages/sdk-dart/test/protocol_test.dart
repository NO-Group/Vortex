import 'package:flutter_test/flutter_test.dart';
import 'package:vortex_client/vortex.dart';

void main() {
  group('VortexProtocol', () {
    test('constants mirror the server wire protocol exactly', () {
      expect(VortexProtocol.auth, 'vortex:auth');
      expect(VortexProtocol.subscribe, 'vortex:subscribe');
      expect(VortexProtocol.unsubscribe, 'vortex:unsubscribe');
      expect(VortexProtocol.ping, 'vortex:ping');
      expect(VortexProtocol.pong, 'vortex:pong');
      expect(VortexProtocol.ack, 'vortex:ack');
      expect(VortexProtocol.event, 'vortex:event');
      expect(VortexProtocol.error, 'vortex:error');
    });

    test('channel namespaces', () {
      expect(VortexProtocol.tableChannel('notes'), 'table:notes');
      expect(VortexProtocol.allTablesChannel, 'table:*');
    });

    test('channel validation', () {
      expect(VortexProtocol.isValidChannel('table:users'), isTrue);
      expect(VortexProtocol.isValidChannel('table:*'), isTrue);
      expect(VortexProtocol.isValidChannel('table:good_name_1'), isTrue);
      expect(VortexProtocol.isValidChannel('notes'), isFalse);
      expect(VortexProtocol.isValidChannel('table:'), isFalse);
      expect(VortexProtocol.isValidChannel('table:DROP TABLE'), isFalse);
      expect(VortexProtocol.isValidChannel(''), isFalse);
    });
  });

  group('TableEvent', () {
    test('parses a fan-out frame', () {
      final event = TableEvent.fromJson({
        'id': 'evt-1',
        'action': 'INSERT',
        'table': 'notes',
        'rows': [
          {'id': 1, 'title': 'hi'}
        ],
        'actorId': 'u-1',
        'timestamp': '2026-10-23T19:00:00.000Z',
      });

      expect(event.id, 'evt-1');
      expect(event.isInsert, isTrue);
      expect(event.isUpdate, isFalse);
      expect(event.table, 'notes');
      expect(event.rows, hasLength(1));
      expect(event.rows.first['title'], 'hi');
      expect(event.actorId, 'u-1');
      expect(event.timestamp.isUtc, isTrue);
    });
  });

  group('Query models', () {
    test('filters and orders serialize to the gateway shape', () {
      const filter = QueryFilter('title', FilterOp.like, '%x%');
      const order = QueryOrder('created_at', direction: 'desc');
      expect(filter.toJson(), {'column': 'title', 'op': 'like', 'value': '%x%'});
      expect(order.toJson(), {'column': 'created_at', 'direction': 'desc'});
    });

    test('QueryResult parses rows + count', () {
      final result = QueryResult.fromJson({
        'rows': [
          {'id': 1},
          {'id': 2},
        ],
        'count': 2,
      });
      expect(result.count, 2);
      expect(result.rows[1]['id'], 2);
    });
  });
}
