/// Auth domain models for the Vortex SDK.
library;

/// An authenticated Vortex user profile.
class VortexUser {
  final String id;
  final String email;
  final String role;
  final Map<String, dynamic> metadata;
  final DateTime? createdAt;

  const VortexUser({
    required this.id,
    required this.email,
    required this.role,
    this.metadata = const {},
    this.createdAt,
  });

  factory VortexUser.fromJson(Map<String, dynamic> json) {
    return VortexUser(
      id: json['id'] as String,
      email: json['email'] as String,
      role: (json['role'] as String?) ?? 'user',
      metadata: (json['metadata'] as Map<String, dynamic>?) ?? const {},
      createdAt: json['createdAt'] is String
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'role': role,
        'metadata': metadata,
        if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      };

  @override
  String toString() => 'VortexUser($email, role: $role)';
}

/// An authenticated session — user + access token.
class VortexSession {
  final VortexUser user;
  final String token;
  final int expiresIn;

  const VortexSession({
    required this.user,
    required this.token,
    required this.expiresIn,
  });

  factory VortexSession.fromJson(Map<String, dynamic> json) {
    return VortexSession(
      user: VortexUser.fromJson(json['user'] as Map<String, dynamic>),
      token: json['token'] as String,
      expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 3600,
    );
  }
}
