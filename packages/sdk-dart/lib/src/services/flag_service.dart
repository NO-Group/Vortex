import '../core/vortex_client.dart';

/// Feature flags client — `/v1/flags`.
class FlagService {
  final VortexClient _client;

  FlagService(this._client);

  /// Create a new feature flag.
  Future<Map<String, dynamic>> create({
    required String key,
    String? description,
    String? status, // 'off' | 'on' | 'gradual'
    int? rolloutPercentage,
    Map<String, dynamic>? targeting,
    List<Map<String, dynamic>>? variants,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/flags',
      body: {
        'key': key,
        if (description != null) 'description': description,
        if (status != null) 'status': status,
        if (rolloutPercentage != null) 'rolloutPercentage': rolloutPercentage,
        if (targeting != null) 'targeting': targeting,
        if (variants != null) 'variants': variants,
      },
    );
  }

  /// List all feature flags.
  Future<List<Map<String, dynamic>>> list() async {
    final body = await _client.sendJson('GET', '/v1/flags');
    return (body['flags'] as List).cast<Map<String, dynamic>>();
  }

  /// Update a feature flag.
  Future<Map<String, dynamic>> update(String flagId, {
    String? description,
    String? status,
    int? rolloutPercentage,
    Map<String, dynamic>? targeting,
    List<Map<String, dynamic>>? variants,
  }) async {
    return _client.sendJson(
      'PATCH',
      '/v1/flags/$flagId',
      body: {
        if (description != null) 'description': description,
        if (status != null) 'status': status,
        if (rolloutPercentage != null) 'rolloutPercentage': rolloutPercentage,
        if (targeting != null) 'targeting': targeting,
        if (variants != null) 'variants': variants,
      },
    );
  }

  /// Delete a feature flag.
  Future<void> delete(String flagId) async {
    await _client.sendJson('DELETE', '/v1/flags/$flagId');
  }

  /// Evaluate a single flag for the current user.
  Future<Map<String, dynamic>> evaluate(String key) async {
    return _client.sendJson(
      'GET',
      '/v1/flags/evaluate?key=$key',
    );
  }

  /// Evaluate all flags for the current user.
  Future<Map<String, bool>> evaluateAll() async {
    final body = await _client.sendJson('GET', '/v1/flags/evaluate-all');
    return (body['flags'] as Map).cast<String, bool>();
  }
}
