from .client import VortexClient


class Auth:
    def __init__(self, client: VortexClient):
        self._c = client

    async def signup(self, email: str, password: str, metadata: dict | None = None) -> dict:
        return await self._c._request("POST", "/v1/auth/signup", json={"email": email, "password": password, **({"metadata": metadata} if metadata else {})})

    async def login(self, email: str, password: str) -> dict:
        return await self._c._request("POST", "/v1/auth/login", json={"email": email, "password": password})

    async def request_magic_link(self, email: str) -> dict:
        return await self._c._request("POST", "/v1/auth/magic-link", json={"email": email})

    async def verify_magic_link(self, token: str) -> dict:
        return await self._c._request("POST", "/v1/auth/magic-link/verify", json={"token": token})

    async def me(self) -> dict:
        return await self._c._request("GET", "/v1/auth/me")

    async def list_oauth_providers(self) -> list:
        return (await self._c._request("GET", "/v1/auth/oauth/providers")).get("providers", [])

    async def list_oauth_accounts(self) -> list:
        return (await self._c._request("GET", "/v1/auth/oauth/accounts")).get("accounts", [])

    async def register_device(self, token: str, platform: str, push_service: str | None = None) -> dict:
        return await self._c._request("POST", "/v1/notifications/devices", json={"token": token, "platform": platform, **({"pushService": push_service} if push_service else {})})

    async def send_notification(self, title: str, body: str, data: dict | None = None) -> dict:
        return await self._c._request("POST", "/v1/notifications", json={"title": title, "body": body, **({"data": data} if data else {})})
