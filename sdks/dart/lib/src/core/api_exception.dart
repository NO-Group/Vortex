class VortexException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final dynamic details;

  VortexException(this.statusCode, this.code, this.message, {this.details});

  factory VortexException.fromBody(int status, dynamic body) {
    final error = body is Map ? body['error'] : null;
    return VortexException(
      status,
      error?['code'] ?? 'error',
      error?['message'] ?? 'Request failed with status $status',
      details: body,
    );
  }

  @override
  String toString() => 'VortexException($statusCode, $code): $message';
}
