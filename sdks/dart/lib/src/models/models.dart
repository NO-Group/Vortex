// Shared models for Vortex Dart SDK

class AuthUser {
  final String id;
  final String email;
  final String role;
  final Map<String, dynamic> metadata;
  AuthUser({required this.id, required this.email, required this.role, required this.metadata});

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String,
    email: json['email'] as String,
    role: json['role'] as String,
    metadata: (json['metadata'] as Map? ?? {}).cast<String, dynamic>(),
  );
}

class AuthSession {
  final String token;
  final AuthUser user;
  final int expiresIn;
  AuthSession({required this.token, required this.user, required this.expiresIn});

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    token: json['token'] as String,
    user: AuthUser.fromJson(json['user'] as Map),
    expiresIn: (json['expiresIn'] as num).toInt(),
  );
}

class BillingPlan {
  final String name;
  final String displayName;
  final double price;
  final String currency;
  final String interval;
  final Map<String, dynamic>? features;
  BillingPlan({required this.name, required this.displayName, required this.price, required this.currency, required this.interval, this.features});

  factory BillingPlan.fromJson(Map<String, dynamic> json) => BillingPlan(
    name: json['name'] as String,
    displayName: json['displayName'] as String,
    price: (json['priceCents'] as num) / 100,
    currency: json['currency'] as String,
    interval: json['interval'] as String,
    features: json['features'] as Map?,
  );
}
