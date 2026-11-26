## Vortex Database service for Godot.
class_name DatabaseService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func from(table: String) -> QueryBuilder:
	return QueryBuilder.new(_client, table)

func insert(table: String, rows: Array) -> Dictionary:
	return _client._await_request("POST", "/v1/db/%s" % table, {"rows": rows})

func list_tables() -> Dictionary:
	return _client._await_request("GET", "/v1/db/tables")

## Vortex query builder for Godot.
class_name QueryBuilder
extends RefCounted

var _client: VortexClient
var _table: String
var _filters: Array = []
var _order_by: Array = []
var _select: Array = []
var _limit: int = -1
var _offset: int = -1
var _count_total: bool = false

func _init(client: VortexClient, table: String) -> void:
	_client = client
	_table = table

func select(cols: Array) -> QueryBuilder:
	_select = cols
	return self

func filter(column: String, op: String, value: Variant) -> QueryBuilder:
	_filters.append({"column": column, "op": op, "value": value})
	return self

func limit(n: int) -> QueryBuilder:
	_limit = n
	return self

func offset(n: int) -> QueryBuilder:
	_offset = n
	return self

func order_by(column: String, direction: String = "asc") -> QueryBuilder:
	_order_by.append({"column": column, "direction": direction})
	return self

func count_total() -> QueryBuilder:
	_count_total = true
	return self

func execute() -> Dictionary:
	var body := {"filters": _filters}
	if _count_total:
		body["countTotal"] = true
	if not _select.is_empty():
		body["select"] = _select
	if _limit >= 0:
		body["limit"] = _limit
	if _offset >= 0:
		body["offset"] = _offset
	if not _order_by.is_empty():
		body["orderBy"] = _order_by
	return _client._await_request("POST", "/v1/db/%s/query" % _table, body)
