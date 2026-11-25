import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../core/vortex_client.dart';
import '../models/realtime.dart';

/// Connection state of the realtime socket.
enum RealtimeStatus { offline, connecting, online }

/// Realtime engine client — `ws(s)://host/v1/realtime`.
///
/// ```dart
/// vortex.realtime.connect();
/// vortex.realtime.channel('table:notes').subscribe();
/// vortex.realtime.onEvent.listen((e) => print('${e.action} ${e.table}'));
/// ```
class RealtimeService {
  final VortexClient _client;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _frameSub;
  Timer? _reconnectTimer;

  RealtimeStatus _status = RealtimeStatus.offline;
  bool _disposed = false;
  bool _closedByUser = false;
  Duration _reconnectDelay = const Duration(milliseconds: 500);

  final Set<String> _channels = <String>{};
  final StreamController<TableEvent> _eventController =
      StreamController<TableEvent>.broadcast();
  final StreamController<RealtimeStatus> _statusController =
      StreamController<RealtimeStatus>.broadcast();

  RealtimeService(this._client);

  RealtimeStatus get status => _status;

  /// All database-change events received on this socket.
  Stream<TableEvent> get onEvent => _eventController.stream;

  /// Connection-state transitions.
  Stream<RealtimeStatus> get onStatus => _statusController.stream;

  /// Currently joined channels.
  List<String> get subscribedChannels => List<String>.unmodifiable(_channels);

  /// Get a channel handle (join with `subscribe()`).
  RealtimeChannel channel(String name) => RealtimeChannel._(this, name);

  /// Open (or resume) the socket. Requires an authenticated client.
  void connect() {
    if (_disposed || _closedByUser) return;
    final token = _client.accessToken;
    if (token == null) {
      throw StateError('VortexClient is not authenticated — sign in first');
    }
    final current = _channel;
    if (current != null && _status != RealtimeStatus.offline) return;

    _setStatus(RealtimeStatus.connecting);
    final uri = _wsUri(token);
    final socket = WebSocketChannel.connect(uri);
    _channel = socket;

    _frameSub = socket.stream.listen(
      _handleFrame,
      onError: (_) => socket.close(),
      onDone: _onDisconnected,
      cancelOnError: false,
    );
  }

  /// Close the socket and stop reconnecting.
  void disconnect() {
    _closedByUser = true;
    _reconnectTimer?.cancel();
    _frameSub?.cancel();
    _channel?.sink.close();
    _channel = null;
    _setStatus(RealtimeStatus.offline);
  }

  /// Release all resources.
  void dispose() {
    _disposed = true;
    disconnect();
    _eventController.close();
    _statusController.close();
  }

  // ── Internals ────────────────────────────────────────────────────────

  void _subscribe(String name) {
    if (!VortexProtocol.isValidChannel(name)) {
      throw ArgumentError.value(name, 'name', 'expected "table:<name>" or "table:*"');
    }
    _channels.add(name);
    _send({'type': VortexProtocol.subscribe, 'channel': name});
  }

  void _unsubscribe(String name) {
    _channels.remove(name);
    _send({'type': VortexProtocol.unsubscribe, 'channel': name});
  }

  void _send(Map<String, dynamic> frame) {
    final socket = _channel;
    if (socket != null && _status == RealtimeStatus.online) {
      socket.sink.add(json.encode(frame));
    }
  }

  void _handleFrame(dynamic raw) {
    try {
      final msg = json.decode(raw as String) as Map<String, dynamic>;
      if (msg['type'] == VortexProtocol.event) {
        _eventController.add(TableEvent.fromJson(msg));
      }
    } catch (_) {
      // ignore malformed frames
    }
  }

  void _onDisconnected() {
    _frameSub?.cancel();
    _frameSub = null;
    _channel = null;
    _setStatus(RealtimeStatus.offline);
    if (_disposed || _closedByUser) return;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(_reconnectDelay, () {
      _reconnectDelay =
          _reconnectDelay * 2 > const Duration(seconds: 10)
              ? const Duration(seconds: 10)
              : _reconnectDelay * 2;
      connect();
    });
  }

  void _setStatus(RealtimeStatus status) {
    _status = status;
    if (!_statusController.isClosed) {
      _statusController.add(status);
    }
  }

  Uri _wsUri(String token) {
    var base = _client.baseUrl.replaceAll(RegExp(r'/+$'), '');
    if (base.startsWith('https://')) {
      base = 'wss://${base.substring(8)}';
    } else if (base.startsWith('http://')) {
      base = 'ws://${base.substring(7)}';
    }
    return Uri.parse(
      '$base/v1/realtime?token=${Uri.encodeQueryComponent(token)}',
    );
  }
}

/// A subscribed (or subscribable) channel on the realtime engine.
class RealtimeChannel {
  final RealtimeService _service;
  final String name;

  RealtimeChannel._(this._service, this.name);

  /// Join this channel.
  void subscribe() => _service._subscribe(name);

  /// Leave this channel.
  void unsubscribe() => _service._unsubscribe(name);

  /// Events delivered to this channel (`table:<name>` or `table:*`).
  Stream<TableEvent> get onEvent =>
      _service.onEvent.where((event) => _matches(event));

  bool _matches(TableEvent event) {
    if (name == VortexProtocol.allTablesChannel) return true;
    return name == VortexProtocol.tableChannel(event.table);
  }
}
