from .client import VortexClient


class Functions:
    def __init__(self, client: VortexClient):
        self._c = client

    async def deploy(self, name: str, code: str, description: str = "") -> dict:
        return await self._c._request("POST", "/v1/functions", json={"name": name, "code": code, "description": description})

    async def list(self) -> list:
        return (await self._c._request("GET", "/v1/functions")).get("functions", [])

    async def invoke(self, name: str, data: dict) -> dict:
        return await self._c._request("POST", f"/functions/{name}", json=data)

    async def update(self, name: str, updates: dict) -> dict:
        return await self._c._request("PATCH", f"/v1/functions/{name}", json=updates)

    async def delete(self, name: str) -> dict:
        return await self._c._request("DELETE", f"/v1/functions/{name}")
