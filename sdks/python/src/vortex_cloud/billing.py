from .client import VortexClient


class Billing:
    def __init__(self, client: VortexClient):
        self._c = client

    async def status(self) -> dict:
        return await self._c._request("GET", "/v1/billing/status")

    async def list_plans(self) -> list:
        return (await self._c._request("GET", "/v1/billing/plans")).get("plans", [])

    async def get_plan(self, name: str) -> dict:
        return await self._c._request("GET", f"/v1/billing/plans/{name}")

    async def checkout(self, plan_name: str, email: str, success_url: str | None = None, cancel_url: str | None = None) -> dict:
        body = {"planName": plan_name, "email": email}
        if success_url: body["successUrl"] = success_url
        if cancel_url: body["cancelUrl"] = cancel_url
        return await self._c._request("POST", "/v1/billing/checkout", json=body)

    async def list_transactions(self, limit: int = 50) -> list:
        return (await self._c._request("GET", "/v1/billing/transactions", params={"limit": limit})).get("transactions", [])

    async def get_subscription(self) -> dict | None:
        return await self._c._request("GET", "/v1/billing/subscription")

    async def cancel_subscription(self) -> dict:
        return await self._c._request("POST", "/v1/billing/subscription/cancel")

    async def get_me(self) -> dict:
        return await self._c._request("GET", "/v1/billing/me")
