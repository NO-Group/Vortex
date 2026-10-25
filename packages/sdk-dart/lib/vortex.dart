/// Official Vortex Flutter / Dart client SDK by N.O Group.
///
/// Auth, database, realtime, and storage gateways — plus the N.O Group
/// design system (pure dark canvas, 6-stop spectrum, controlled glass).
library vortex_client;

// Brand / design system
export 'src/brand/design_system.dart';

// Core
export 'src/core/api_exception.dart';
export 'src/core/jwt.dart';
export 'src/core/vortex_client.dart';

// Models
export 'src/models/auth.dart';
export 'src/models/query.dart';
export 'src/models/realtime.dart';
export 'src/models/storage.dart';

// Services
export 'src/services/auth_service.dart';
export 'src/services/db_service.dart';
export 'src/services/realtime_service.dart';
export 'src/services/storage_service.dart';
export 'src/services/webhook_service.dart';
export 'src/services/function_service.dart';
export 'src/services/audit_service.dart';
export 'src/services/apikey_service.dart';
export 'src/services/flag_service.dart';
export 'src/services/vector_service.dart';

// UI controllers
export 'src/ui/glass_panel.dart';
export 'src/ui/kinetic_button.dart';
export 'src/ui/skeleton.dart';
export 'src/ui/vortex_theme.dart';
