## Vortex Storage service for Godot.
class_name StorageService
extends RefCounted

var _client: VortexClient

func _init(client: VortexClient) -> void:
	_client = client

func create_bucket(name: String, is_public: bool = false) -> Dictionary:
	return _client._await_request("POST", "/v1/storage/buckets", {"name": name, "isPublic": is_public})

func list_buckets() -> Dictionary:
	return _client._await_request("GET", "/v1/storage/buckets")

func presign_upload(path: String) -> Dictionary:
	return _client._await_request("POST", "/v1/storage/presign-upload", {"path": path})

func image_url(bucket: String, path: String, opts: Dictionary = {}) -> String:
	var url := "%s/v1/storage/public/%s/%s" % [_client.base_url, bucket, path]
	if opts.is_empty():
		return url
	var parts: Array = []
	for key in opts:
		parts.append("%s=%s" % [key, opts[key]])
	return "%s?%s" % [url, "&".join(parts)]
