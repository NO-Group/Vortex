import '../core/vortex_client.dart';
import '../core/api_exception.dart';
import '../models/query.dart';

/// Database gateway client — `/v1/db/:table`.
class DbService {
  final VortexClient _client;

  DbService(this._client);

  /// Start a fluent query against a table.
  DbQuery from(String table) => DbQuery._(_client, table);
}

/// Fluent query builder mapping onto the Vortex database gateway.
///
/// ```dart
/// final res = await vortex.db
///     .from('notes')
///     .like('title', '%engine%')
///     .order('created_at', direction: 'desc')
///     .limit(10)
///     .execute();
/// ```
class DbQuery {
  final VortexClient _client;
  final String table;

  final List<String> _select = [];
  final List<QueryFilter> _filters = [];
  final List<QueryOrder> _orders = [];
  int? _limit;
  int? _offset;

  DbQuery._(this._client, this.table);

  // ── Projection & pagination ──────────────────────────────────────────

  /// Restrict returned columns (defaults to `*`).
  DbQuery select([List<String> columns = const []]) {
    _select
      ..clear()
      ..addAll(columns);
    return this;
  }

  DbQuery limit(int count) {
    _limit = count;
    return this;
  }

  DbQuery offset(int count) {
    _offset = count;
    return this;
  }

  DbQuery order(String column, {String direction = 'asc'}) {
    _orders.add(QueryOrder(column, direction: direction));
    return this;
  }

  // ── Filters ──────────────────────────────────────────────────────────

  DbQuery filter(String column, dynamic value, {String op = FilterOp.eq}) {
    _filters.add(QueryFilter(column, op, value));
    return this;
  }

  DbQuery eq(String column, dynamic value) => filter(column, value);

  DbQuery neq(String column, dynamic value) =>
      filter(column, value, op: FilterOp.neq);

  DbQuery gt(String column, dynamic value) => filter(column, value, op: FilterOp.gt);

  DbQuery gte(String column, dynamic value) =>
      filter(column, value, op: FilterOp.gte);

  DbQuery lt(String column, dynamic value) => filter(column, value, op: FilterOp.lt);

  DbQuery lte(String column, dynamic value) =>
      filter(column, value, op: FilterOp.lte);

  DbQuery like(String column, String pattern) =>
      filter(column, pattern, op: FilterOp.like);

  DbQuery inList(String column, List<dynamic> values) =>
      filter(column, values, op: FilterOp.inList);

  DbQuery isNull(String column) => filter(column, null, op: FilterOp.isNull);

  // ── Execution ────────────────────────────────────────────────────────

  /// Request body for the select endpoint (visible for testing).
  Map<String, dynamic> buildQueryBody() => {
        if (_select.isNotEmpty) 'select': _select,
        if (_filters.isNotEmpty)
          'filters': _filters.map((f) => f.toJson()).toList(),
        if (_orders.isNotEmpty)
          'orderBy': _orders.map((o) => o.toJson()).toList(),
        if (_limit != null) 'limit': _limit,
        if (_offset != null) 'offset': _offset,
      };

  /// Run the SELECT (`POST /v1/db/:table/query`).
  Future<QueryResult> execute() async {
    final body = await _client.sendJson(
      'POST',
      '/v1/db/$table/query',
      body: buildQueryBody(),
    );
    return QueryResult.fromJson(body);
  }

  /// INSERT one or more rows (`POST /v1/db/:table`).
  Future<QueryResult> insert(Map<String, dynamic> row) =>
      insertMany([row]);

  /// INSERT a batch of rows.
  Future<QueryResult> insertMany(List<Map<String, dynamic>> rows) async {
    final body = await _client.sendJson(
      'POST',
      '/v1/db/$table',
      body: {'rows': rows},
    );
    return QueryResult.fromJson(body);
  }

  /// UPDATE rows matching the accumulated filters (`PATCH /v1/db/:table`).
  Future<QueryResult> update(Map<String, dynamic> patch) async {
    if (_filters.isEmpty) {
      throw const VortexException(
        400,
        'missing_filters',
        'Update requires at least one filter',
      );
    }
    final body = await _client.sendJson(
      'PATCH',
      '/v1/db/$table',
      body: {
        'patch': patch,
        'filters': _filters.map((f) => f.toJson()).toList(),
      },
    );
    return QueryResult.fromJson(body);
  }

  /// DELETE rows matching the accumulated filters (`DELETE /v1/db/:table`).
  Future<QueryResult> delete() async {
    if (_filters.isEmpty) {
      throw const VortexException(
        400,
        'missing_filters',
        'Delete requires at least one filter',
      );
    }
    final body = await _client.sendJson(
      'DELETE',
      '/v1/db/$table',
      body: {
        'filters': _filters.map((f) => f.toJson()).toList(),
      },
    );
    return QueryResult.fromJson(body);
  }
}
