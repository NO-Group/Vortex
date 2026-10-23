/// Typed error for all Vortex gateway failures.
class VortexException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final dynamic details;

  const VortexException(this.statusCode, this.code, this.message, [this.details]);

  /// Build from the standard error envelope:
  /// `{ "error": { "code": ..., "message": ..., "details": ... } }`
  factory VortexException.fromBody(int statusCode, dynamic body) {
    if (body is Map && body['error'] is Map) {
      final err = body['error'] as Map;
      return VortexException(
        statusCode,
        (err['code'] as String?) ?? 'unknown_error',
        (err['message'] as String?) ?? 'Request failed',
        err['details'],
      );
    }
    return VortexException(statusCode, 'unknown_error', 'Request failed ($statusCode)');
  }

  @override
  String toString() => 'VortexException($statusCode, $code): $message';
}
