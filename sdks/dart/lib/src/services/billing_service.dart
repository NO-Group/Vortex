import '../core/vortex_client.dart';

class BillingService {
  final VortexClient _c;
  BillingService(this._c);

  Future<Map<String, dynamic>> status() async {
    return _c.sendJson('GET', '/v1/billing/status', auth: false);
  }

  Future<List<Map<String, dynamic>>> listPlans() async {
    final b = await _c.sendJson('GET', '/v1/billing/plans');
    return (b['plans'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> checkout({required String planName, required String email, String? successUrl, String? cancelUrl}) async {
    return _c.sendJson('POST', '/v1/billing/checkout', body: {
      'planName': planName, 'email': email,
      if (successUrl != null) 'successUrl': successUrl,
      if (cancelUrl != null) 'cancelUrl': cancelUrl,
    });
  }

  Future<List<Map<String, dynamic>>> listTransactions([int limit = 50]) async {
    final b = await _c.sendJson('GET', '/v1/billing/transactions', query: {'limit': limit.toString()});
    return (b['transactions'] as List? ?? []).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getSubscription() async {
    return _c.sendJson('GET', '/v1/billing/subscription');
  }

  Future<Map<String, dynamic>> cancelSubscription() async {
    return _c.sendJson('POST', '/v1/billing/subscription/cancel');
  }

  Future<Map<String, dynamic>> getMe() async {
    return _c.sendJson('GET', '/v1/billing/me');
  }
}
