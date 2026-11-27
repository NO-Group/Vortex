from .client import VortexClient


class Apps:
    def __init__(self, client: VortexClient):
        self._c = client

    async def create(self, name: str, title: str) -> dict:
        return await self._c._request("POST", "/v1/apps", json={"name": name, "title": title})

    async def list(self) -> list:
        return (await self._c._request("GET", "/v1/apps")).get("apps", [])

    async def upload_file(self, app: str, path: str, content: str) -> dict:
        return await self._c._request("POST", f"/v1/apps/{app}/files", json={"path": path, "content": content})

    async def delete(self, app: str) -> dict:
        return await self._c._request("DELETE", f"/v1/apps/{app}")
