import '../core/vortex_client.dart';

/// Billing service for the Vortex Dart SDK — `/v1/billing`.
///
/// ```dart
/// final status = await vortex.billing.status();
/// final plans = await vortex.billing.listPlans();
/// final checkout = await vortex.billing.checkout(
///   planName: 'pro',
///   email: 'user@example.com',
///   successUrl: 'https://app.com/billing?success',
/// );
/// ```
class BillingService {
  final VortexClient _client;

  BillingService(this._client);

  /// Check if billing is configured and which gateway is active.
  Future<Map<String, dynamic>> status() async {
    return _client.sendJson('GET', '/v1/billing/status', auth: false);
  }

  /// List all active plans.
  Future<List<Map<String, dynamic>>> listPlans() async {
    final body = await _client.sendJson('GET', '/v1/billing/plans');
    return (body['plans'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  /// Get a single plan by name.
  Future<Map<String, dynamic>> getPlan(String name) async {
    return _client.sendJson('GET', '/v1/billing/plans/$name');
  }

  /// Create a checkout for a plan — returns redirect URL and reference.
  Future<Map<String, dynamic>> checkout({
    required String planName,
    required String email,
    String? successUrl,
    String? cancelUrl,
  }) async {
    return _client.sendJson('POST', '/v1/billing/checkout', body: {
      'planName': planName,
      'email': email,
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
  }

  /// List the current user's transactions.
  Future<List<Map<String, dynamic>>> listTransactions([int limit = 50]) async {
    final body = await _client.sendJson(
      'GET',
      '/v1/billing/transactions',
      query: {'limit': limit.toString()},
    );
    return (body['transactions'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  /// Get the current user's subscription.
  Future<Map<String, dynamic>> getSubscription() async {
    return _client.sendJson('GET', '/v1/billing/subscription');
  }

  /// Cancel the current user's subscription (at end of period).
  Future<Map<String, dynamic>> cancelSubscription() async {
    return _client.sendJson('POST', '/v1/billing/subscription/cancel');
  }

  /// Get the current user's plan, credits, and subscription summary.
  Future<Map<String, dynamic>> getMe() async {
    return _client.sendJson('GET', '/v1/billing/me');
  }
}
