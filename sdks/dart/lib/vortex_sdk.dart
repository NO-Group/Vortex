/// Vortex BaaS SDK for Flutter/Dart.
///
/// ```dart
/// import 'package:vortex_sdk/vortex_sdk.dart';
///
/// final vortex = VortexClient(baseUrl: 'https://your-vortex.example.com');
/// final session = await vortex.auth.signIn(email: 'user@example.com', password: 'password');
/// final notes = await vortex.db.from('notes').limit(10).execute();
/// ```
library vortex_sdk;

// Core
export 'src/core/vortex_client.dart';
export 'src/core/api_exception.dart';
export 'src/core/jwt.dart';

// Services
export 'src/services/auth_service.dart';
export 'src/services/db_service.dart';
export 'src/services/realtime_service.dart';
export 'src/services/storage_service.dart';
export 'src/services/function_service.dart';
export 'src/services/app_service.dart';
export 'src/services/billing_service.dart';
export 'src/services/admin_service.dart';

// Models
export 'src/models/models.dart';
