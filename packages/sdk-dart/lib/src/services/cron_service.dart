import '../core/vortex_client.dart';

/// Cron / Scheduled Jobs client — `/v1/cron/jobs`.
///
/// Manages autonomous scheduled jobs that invoke Vortex Functions on
/// cron schedules. Supports create, list, update, delete, manual trigger,
/// and execution history.
class CronService {
  final VortexClient _client;

  CronService(this._client);

  /// Create a new scheduled job.
  Future<Map<String, dynamic>> createJob({
    required String name,
    String? functionName,
    required String cronExpression,
    Map<String, dynamic>? payload,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/cron/jobs',
      body: {
        'name': name,
        if (functionName != null) 'functionName': functionName,
        'cronExpression': cronExpression,
        if (payload != null) 'payload': payload,
      },
    );
  }

  /// List all scheduled jobs.
  Future<List<Map<String, dynamic>>> listJobs() async {
    final body = await _client.sendJson('GET', '/v1/cron/jobs');
    return (body['jobs'] as List).cast<Map<String, dynamic>>();
  }

  /// Get a single scheduled job by name.
  Future<Map<String, dynamic>> getJob(String name) async {
    final body = await _client.sendJson('GET', '/v1/cron/jobs/$name');
    return body['job'] as Map<String, dynamic>;
  }

  /// Update a scheduled job (expression, payload, status).
  Future<Map<String, dynamic>> updateJob(String name, {
    String? functionName,
    String? cronExpression,
    Map<String, dynamic>? payload,
    String? status, // 'enabled' | 'disabled'
  }) async {
    return _client.sendJson(
      'PUT',
      '/v1/cron/jobs/$name',
      body: {
        if (functionName != null) 'functionName': functionName,
        if (cronExpression != null) 'cronExpression': cronExpression,
        if (payload != null) 'payload': payload,
        if (status != null) 'status': status,
      },
    );
  }

  /// Delete a scheduled job and its run history.
  Future<void> deleteJob(String name) async {
    await _client.sendJson('DELETE', '/v1/cron/jobs/$name');
  }

  /// Manually trigger a job immediately.
  Future<Map<String, dynamic>> trigger(String name, {
    Map<String, dynamic>? payload,
  }) async {
    return _client.sendJson(
      'POST',
      '/v1/cron/jobs/$name/trigger',
      body: payload != null ? {'payload': payload} : {},
    );
  }

  /// List execution history for a job.
  Future<List<Map<String, dynamic>>> listRuns(String name, {int limit = 50}) async {
    final body = await _client.sendJson('GET', '/v1/cron/jobs/$name/runs?limit=$limit');
    return (body['runs'] as List).cast<Map<String, dynamic>>();
  }

  /// Get scheduler status (running, tick count).
  Future<Map<String, dynamic>> schedulerStatus() async {
    return _client.sendJson('GET', '/v1/cron/scheduler');
  }
}
