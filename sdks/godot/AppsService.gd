## Vortex Apps service for Godot.
class_name AppsService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func create(name: String, title: String, description: String = "") -> Dictionary:
	return _client._await_request("POST", "/v1/apps", {
		"name": name,
		"title": title,
		"description": description,
	})

func list() -> Dictionary:
	return _client._await_request("GET", "/v1/apps")

func delete(app_id: String) -> Dictionary:
	return _client._await_request("DELETE", "/v1/apps/%s" % app_id)
