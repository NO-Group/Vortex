## Vortex Functions service for Godot.
class_name FunctionsService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func deploy(name: String, language: String, code: String, description: String = "") -> Dictionary:
	return _client._await_request("POST", "/v1/functions", {
		"name": name,
		"language": language,
		"code": code,
		"description": description,
	})

func list() -> Dictionary:
	return _client._await_request("GET", "/v1/functions")

func invoke(name: String, data: Dictionary) -> Dictionary:
	return _client._await_request("POST", "/functions/%s" % name, data)

func delete(name: String) -> Dictionary:
	return _client._await_request("DELETE", "/v1/functions/%s" % name)
