## Vortex Billing service for Godot.
class_name BillingService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func status() -> Dictionary:
	return _client._await_request("GET", "/v1/billing/status")

func list_plans() -> Dictionary:
	return _client._await_request("GET", "/v1/billing/plans")

func checkout(plan_name: String, email: String, success_url: String = "", cancel_url: String = "") -> Dictionary:
	var body := {"planName": plan_name, "email": email}
	if not success_url.is_empty():
		body["successUrl"] = success_url
	if not cancel_url.is_empty():
		body["cancelUrl"] = cancel_url
	return _client._await_request("POST", "/v1/billing/checkout", body)

func list_transactions(limit: int = 50) -> Dictionary:
	return _client._await_request("GET", "/v1/billing/transactions?limit=%d" % limit)

func get_subscription() -> Dictionary:
	return _client._await_request("GET", "/v1/billing/subscription")

func cancel_subscription() -> Dictionary:
	return _client._await_request("POST", "/v1/billing/subscription/cancel")

func get_me() -> Dictionary:
	return _client._await_request("GET", "/v1/billing/me")
