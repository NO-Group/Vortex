import '../core/vortex_client.dart';

class QueryBuilder {
  final VortexClient _c;
  final String _table;
  final List<Map<String, dynamic>> _filters = [];
  int? _limit;
  int? _offset;
  List<Map<String, String>> _orderBy = [];
  bool _countTotal = false;
  List<String>? _select;

  QueryBuilder(this._c, this._table);

  QueryBuilder select(List<String> cols) { _select = cols; return this; }
  QueryBuilder where(String column, String op, dynamic value) {
    _filters.add({'column': column, 'op': op, 'value': value});
    return this;
  }
  QueryBuilder limit(int n) { _limit = n; return this; }
  QueryBuilder offset(int n) { _offset = n; return this; }
  QueryBuilder orderBy(String column, {String direction = 'asc'}) {
    _orderBy.add({'column': column, 'direction': direction});
    return this;
  }
  QueryBuilder countTotal() { _countTotal = true; return this; }

  Future<Map<String, dynamic>> execute() async {
    final body = <String, dynamic>{'filters': _filters, 'countTotal': _countTotal};
    if (_select != null) body['select'] = _select;
    if (_limit != null) body['limit'] = _limit;
    if (_offset != null) body['offset'] = _offset;
    if (_orderBy.isNotEmpty) body['orderBy'] = _orderBy;
    return _c.sendJson('POST', '/v1/db/$_table/query', body: body);
  }
}

class DbService {
  final VortexClient _c;
  DbService(this._c);

  QueryBuilder from(String table) => QueryBuilder(_c, table);

  Future<Map<String, dynamic>> insert(String table, List<Map<String, dynamic>> rows) async {
    return _c.sendJson('POST', '/v1/db/$table', body: {'rows': rows});
  }

  Future<Map<String, dynamic>> update(String table, Map<String, dynamic> updates, List<Map<String, dynamic>> filters) async {
    return _c.sendJson('PATCH', '/v1/db/$table', body: {'updates': updates, 'filters': filters});
  }

  Future<Map<String, dynamic>> delete(String table, List<Map<String, dynamic>> filters) async {
    return _c.sendJson('DELETE', '/v1/db/$table', body: {'filters': filters});
  }

  Future<List<String>> listTables() async {
    final b = await _c.sendJson('GET', '/v1/db/tables');
    return (b['tables'] as List).cast<String>();
  }
}
