/// Session management models.
class UserSession {
  final String id;
  final String sessionId;
  final String? userAgent;
  final String? ipAddress;
  final String? deviceType;
  final String lastActiveAt;
  final String createdAt;

  UserSession({
    required this.id,
    required this.sessionId,
    required this.userAgent,
    required this.ipAddress,
    required this.deviceType,
    required this.lastActiveAt,
    required this.createdAt,
  });

  factory UserSession.fromMap(Map map) => UserSession(
        id: map['id'] as String,
        sessionId: map['sessionId'] as String,
        userAgent: map['userAgent'] as String?,
        ipAddress: map['ipAddress'] as String?,
        deviceType: map['deviceType'] as String?,
        lastActiveAt: map['lastActiveAt'] as String,
        createdAt: map['createdAt'] as String,
      );
}

/// Password security models.
class PasswordSecurityStatus {
  final bool locked;
  final String? lockedUntil;
  final int failedCount;
  final int attemptsRemaining;

  PasswordSecurityStatus({
    required this.locked,
    required this.lockedUntil,
    required this.failedCount,
    required this.attemptsRemaining,
  });

  factory PasswordSecurityStatus.fromMap(Map map) => PasswordSecurityStatus(
        locked: map['locked'] as bool,
        lockedUntil: map['lockedUntil'] as String?,
        failedCount: map['failedCount'] as int,
        attemptsRemaining: map['attemptsRemaining'] as int,
      );
}

class PasswordValidationResult {
  final bool valid;
  final List<String> errors;

  PasswordValidationResult({required this.valid, required this.errors});

  factory PasswordValidationResult.fromMap(Map map) => PasswordValidationResult(
        valid: map['valid'] as bool,
        errors: (map['errors'] as List).map((e) => e as String).toList(),
      );
}

class PasswordHistoryEntry {
  final String id;
  final String createdAt;

  PasswordHistoryEntry({required this.id, required this.createdAt});

  factory PasswordHistoryEntry.fromMap(Map map) => PasswordHistoryEntry(
        id: map['id'] as String,
        createdAt: map['createdAt'] as String,
      );
}

/// Security scoring models.
class SecurityCheck {
  final String name;
  final bool passed;
  final int weight;
  final String detail;

  SecurityCheck({
    required this.name,
    required this.passed,
    required this.weight,
    required this.detail,
  });

  factory SecurityCheck.fromMap(Map map) => SecurityCheck(
        name: map['name'] as String,
        passed: map['passed'] as bool,
        weight: map['weight'] as int,
        detail: map['detail'] as String,
      );
}

class SecurityPostureScore {
  final int score;
  final String grade;
  final List<SecurityCheck> checks;
  final List<String> recommendations;

  SecurityPostureScore({
    required this.score,
    required this.grade,
    required this.checks,
    required this.recommendations,
  });

  factory SecurityPostureScore.fromMap(Map map) => SecurityPostureScore(
        score: map['score'] as int,
        grade: map['grade'] as String,
        checks: (map['checks'] as List)
            .map((e) => SecurityCheck.fromMap(e as Map))
            .toList(),
        recommendations:
            (map['recommendations'] as List).map((e) => e as String).toList(),
      );
}

class SecurityScoreEntry {
  final int score;
  final String grade;
  final String createdAt;

  SecurityScoreEntry({
    required this.score,
    required this.grade,
    required this.createdAt,
  });

  factory SecurityScoreEntry.fromMap(Map map) => SecurityScoreEntry(
        score: map['score'] as int,
        grade: map['grade'] as String,
        createdAt: map['createdAt'] as String,
      );
}

class EncryptionInfo {
  final String algorithm;
  final String keyVersion;
  final bool atRest;
  final List<String> fields;

  EncryptionInfo({
    required this.algorithm,
    required this.keyVersion,
    required this.atRest,
    required this.fields,
  });

  factory EncryptionInfo.fromMap(Map map) => EncryptionInfo(
        algorithm: map['algorithm'] as String,
        keyVersion: map['keyVersion'] as String,
        atRest: map['atRest'] as bool,
        fields: (map['fields'] as List).map((e) => e as String).toList(),
      );
}
