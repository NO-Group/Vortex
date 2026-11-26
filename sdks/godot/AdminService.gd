## Vortex Admin service for Godot.
class_name AdminService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func sql(statement: String) -> Dictionary:
	return _client._await_request("POST", "/v1/sql", {"sql": statement})

func list_policies() -> Dictionary:
	return _client._await_request("GET", "/v1/policies")

func create_policy(table: String, policy: Dictionary) -> Dictionary:
	return _client._await_request("POST", "/v1/policies", {"table": table, "policy": policy})

func list_users() -> Dictionary:
	return _client._await_request("GET", "/v1/auth/users")

func insights_overview() -> Dictionary:
	return _client._await_request("GET", "/v1/insights/overview")
