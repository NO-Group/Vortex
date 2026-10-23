/// Realtime wire protocol — constants mirror `@vortex/core` protocol.ts
/// exactly. All frames are JSON text messages.
library;

/// Message type constants for the Vortex realtime protocol.
class VortexProtocol {
  VortexProtocol._();

  /// Client: authenticate this socket with a JWT.
  static const String auth = 'vortex:auth';

  /// Client: subscribe to a channel (e.g. `table:notes`).
  static const String subscribe = 'vortex:subscribe';

  /// Client: unsubscribe from a channel.
  static const String unsubscribe = 'vortex:unsubscribe';

  /// Bidirectional heartbeat.
  static const String ping = 'vortex:ping';
  static const String pong = 'vortex:pong';

  /// Server: acknowledgement of a client command.
  static const String ack = 'vortex:ack';

  /// Server: database change fan-out.
  static const String event = 'vortex:event';

  /// Server: error frame.
  static const String error = 'vortex:error';

  /// Channel namespace for one table's change stream.
  static String tableChannel(String table) => 'table:$table';

  /// Wildcard channel — every table's change stream.
  static const String allTablesChannel = 'table:*';

  /// Valid channel ids look like `table:<name>` or `table:*`.
  static bool isValidChannel(String channel) =>
      RegExp(r'^table:(\*|[a-zA-Z_][a-zA-Z0-9_]*)$').hasMatch(channel);
}

/// A database-change event broadcast by the realtime engine.
class TableEvent {
  final String id;

  /// `INSERT` | `UPDATE` | `DELETE`
  final String action;
  final String table;
  final List<Map<String, dynamic>> rows;
  final String? actorId;
  final DateTime timestamp;

  const TableEvent({
    required this.id,
    required this.action,
    required this.table,
    required this.rows,
    required this.actorId,
    required this.timestamp,
  });

  factory TableEvent.fromJson(Map<String, dynamic> json) {
    final rawRows = (json['rows'] as List<dynamic>? ?? const []);
    return TableEvent(
      id: json['id'] as String,
      action: json['action'] as String,
      table: json['table'] as String,
      rows: rawRows
          .map((r) => Map<String, dynamic>.from(r as Map))
          .toList(growable: false),
      actorId: json['actorId'] as String?,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  bool get isInsert => action == 'INSERT';
  bool get isUpdate => action == 'UPDATE';
  bool get isDelete => action == 'DELETE';
}
