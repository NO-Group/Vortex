import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../core/vortex_client.dart';

class RealtimeService {
  final VortexClient _c;
  final WebSocketChannel? _channel;
  StreamSubscription? _sub;

  RealtimeService(this._c);

  void connect(String token, {
    void Function(Map<String, dynamic>)? onTableChange,
    void Function(Map<String, dynamic>)? onPresence,
    void Function(Map<String, dynamic>)? onBroadcast,
    void Function(Map<String, dynamic>)? onReplay,
  }) {
    final url = '${_c.baseUrl.replaceAll(RegExp(r'/+$'), '').replaceFirst('http', 'ws')}/v1/realtime?token=$token';
    final channel = WebSocketChannel.connect(Uri.parse(url));
    _sub = channel.stream.listen((data) {
      final msg = _tryJson(data);
      if (msg == null) return;
      switch (msg['type']) {
        case 'vortex:event': onTableChange?.call(msg);
        case 'vortex:presence_diff':
        case 'vortex:presence_sync': onPresence?.call(msg);
        case 'vortex:broadcast': onBroadcast?.call(msg);
        case 'vortex:replay': onReplay?.call(msg);
      }
    });
  }

  void subscribe(String channel, {int since = 0}) {
    _channel?.sink.add('{"type":"vortex:subscribe","channel":"$channel","since":$since}');
  }

  void unsubscribe(String channel) {
    _channel?.sink.add('{"type":"vortex:unsubscribe","channel":"$channel"}');
  }

  void broadcast(String room, String event, dynamic payload) {
    _channel?.sink.add('{"type":"vortex:broadcast","channel":"room:$room","event":"$event","payload":$payload}');
  }

  void dispose() {
    _sub?.cancel();
    _channel?.sink.close();
  }

  dynamic _tryJson(dynamic data) {
    try {
      if (data is String) return _parseJson(data);
      return data;
    } catch (_) { return null; }
  }

  Map<String, dynamic> _parseJson(String s) {
    return Map<String, dynamic>.from(_decode(s) as Map);
  }

  dynamic _decode(String s) {
    return Uri.dataFromString('data:application/json;base64,${_encode(s)}').toString();
  }

  String _encode(String s) => s;
}
