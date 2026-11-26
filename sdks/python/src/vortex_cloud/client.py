import httpx

from .errors import VortexError


class VortexClient:
    def __init__(self, url: str, token: str | None = None, timeout: float = 30.0):
        self.base_url = url.rstrip("/")
        self._token = token
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout)
        from .auth import Auth
        from .database import Database
        from .storage import Storage
        from .functions import Functions
        from .apps import Apps
        from .billing import Billing
        from .admin import Admin
        self.auth = Auth(self)
        self.database = Database(self)
        self.storage = Storage(self)
        self.functions = Functions(self)
        self.apps = Apps(self)
        self.billing = Billing(self)
        self.admin = Admin(self)

    @property
    def token(self) -> str | None:
        return self._token

    def set_token(self, token: str) -> None:
        self._token = token

    async def _request(self, method: str, path: str, json=None, params=None) -> dict:
        headers = {}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        resp = await self._client.request(method, path, json=json, params=params, headers=headers)
        if resp.status_code >= 400:
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            error = body.get("error", {})
            raise VortexError(
                message=error.get("message", resp.text),
                status=resp.status_code,
                code=error.get("code", "error"),
            )
        return resp.json()

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()
