## Vortex BaaS Godot SDK.
##
## ```gdscript
## var vortex = VortexClient.new("https://your-vortex.example.com")
## var session = await vortex.auth.signup("user@example.com", "password")
## var notes = await vortex.database.from("notes").filter("owner_id", "eq", session.user.id).limit(10).execute()
## ```
class_name VortexClient
extends RefCounted

var base_url: String = ""
var token: String = ""

var _http := HTTPRequest.new()

func _init(base_url: String) -> void:
	base_url = base_url.trim_suffix("/")
	_http = HTTPRequest.new()
	_http.timeout = 30.0

func set_token(new_token: String) -> void:
	token = new_token

func _request(method: String, path: String, body: Variant = null) -> Dictionary:
	var url := "%s%s" % [base_url, path]
	var headers := {"Accept": "application/json"}
	var body_string := ""
	if body != null:
		headers["Content-Type"] = "application/json"
		body_string = JSON.stringify(body)
	if not token.is_empty():
		headers["Authorization"] = "Bearer %s" % token

	var response := _http.request(url, method, headers, body_string)
	if _http.get_response_code() >= 400:
		var data: Dictionary = JSON.parse_string(_http.get_response_body_as_string())
		var error: Dictionary = data.get("error", {"code": "error", "message": "Request failed"})
		push_error("Vortex error %s: %s" % [error["code"], error["message"]])
		return {}
	var result: Dictionary = JSON.parse_string(_http.get_response_body_as_string())
	return result

func _await_request(method: String, path: String, body: Variant = null) -> Dictionary:
	await _http.request_async(method, "%s%s" % [base_url, path], {
		"Accept": "application/json",
		**({"Content-Type": "application/json"} if body != null else {}),
		**({"Authorization": "Bearer %s" % token} if not token.is_empty() else {}),
	}, JSON.stringify(body) if body != null else "")
	if _http.get_response_code() >= 400:
		var data: Dictionary = JSON.parse_string(_http.get_response_body_as_string())
		var error: Dictionary = data.get("error", {"code": "error", "message": "Request failed"})
		push_error("Vortex error %s: %s" % [error["code"], error["message"]])
		return {}
	return JSON.parse_string(_http.get_response_body_as_string())

func auth() -> AuthService:
	return AuthService.new(self)

func database() -> DatabaseService:
	return DatabaseService.new(self)

func storage() -> StorageService:
	return StorageService.new(self)

func functions() -> FunctionsService:
	return FunctionsService.new(self)

func apps() -> AppsService:
	return AppsService.new(self)

func billing() -> BillingService:
	return BillingService.new(self)

func admin() -> AdminService:
	return AdminService.new(self)
