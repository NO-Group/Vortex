from .client import VortexClient


class Admin:
    def __init__(self, client: VortexClient):
        self._c = client

    async def sql(self, statement: str) -> dict:
        return await self._c._request("POST", "/v1/sql", json={"sql": statement})

    async def list_policies(self) -> list:
        return (await self._c._request("GET", "/v1/policies")).get("policies", [])

    async def create_policy(self, **kwargs) -> dict:
        return await self._c._request("POST", "/v1/policies", json=kwargs)

    async def preview_policy(self, **kwargs) -> dict:
        return await self._c._request("POST", "/v1/policies/preview", json=kwargs)

    async def list_users(self) -> list:
        return (await self._c._request("GET", "/v1/auth/users")).get("users", [])

    async def update_user(self, user_id: str, **updates) -> dict:
        return await self._c._request("PATCH", f"/v1/auth/users/{user_id}", json=updates)

    async def delete_user(self, user_id: str) -> dict:
        return await self._c._request("DELETE", f"/v1/auth/users/{user_id}")

    async def query_log(self, limit: int = 50) -> list:
        return (await self._c._request("GET", "/v1/insights/queries", params={"limit": limit})).get("queries", [])

    async def insights_overview(self) -> dict:
        return await self._c._request("GET", "/v1/insights/overview")
