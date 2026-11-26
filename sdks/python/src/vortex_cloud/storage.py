from .client import VortexClient


class Storage:
    def __init__(self, client: VortexClient):
        self._c = client

    async def create_bucket(self, name: str, is_public: bool = False) -> dict:
        return await self._c._request("POST", "/v1/storage/buckets", json={"name": name, "isPublic": is_public})

    async def list_buckets(self) -> list:
        return (await self._c._request("GET", "/v1/storage/buckets")).get("buckets", [])

    async def presign_upload(self, path: str) -> dict:
        return await self._c._request("POST", "/v1/storage/presign-upload", json={"path": path})

    async def list_objects(self, bucket: str, prefix: str = "") -> list:
        return (await self._c._request("GET", "/v1/storage/list", params={"bucket": bucket, "prefix": prefix})).get("objects", [])

    async def delete_object(self, bucket: str, path: str) -> dict:
        return await self._c._request("DELETE", "/v1/storage/object", json={"bucket": bucket, "path": path})

    def image_url(self, bucket: str, path: str, **opts) -> str:
        from urllib.parse import urlencode
        return f"{self._c.base_url}/v1/storage/public/{bucket}/{path}?{urlencode(opts)}"
