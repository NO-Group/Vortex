## Vortex Auth service for Godot.
class_name AuthService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func signup(email: String, password: String) -> Dictionary:
	var resp := _client._await_request("POST", "/v1/auth/signup", {"email": email, "password": password})
	if resp.has("token"):
		_client.set_token(resp["token"])
	return resp

func login(email: String, password: String) -> Dictionary:
	var resp := _client._await_request("POST", "/v1/auth/login", {"email": email, "password": password})
	if resp.has("token"):
		_client.set_token(resp["token"])
	return resp

func me() -> Dictionary:
	return _client._await_request("GET", "/v1/auth/me")

func list_oauth_providers() -> Dictionary:
	return _client._await_request("GET", "/v1/auth/oauth/providers")

func register_device(push_token: String, platform: String, push_service: String = "") -> Dictionary:
	var body := {"token": push_token, "platform": platform}
	if not push_service.is_empty():
		body["pushService"] = push_service
	return _client._await_request("POST", "/v1/notifications/devices", body)

func send_notification(title: String, body: String, data: Dictionary = {}) -> Dictionary:
	var payload := {"title": title, "body": body}
	if not data.is_empty():
		payload["data"] = data
	return _client._await_request("POST", "/v1/notifications", payload)
