"""VCaptcha — Temporal-Spatial Sequence Recall captcha."""

from typing import Any

from .client import VortexClient


class VCaptcha:
    def __init__(self, client: VortexClient):
        self._c = client

    async def challenge(
        self,
        mode: str | None = None,
        grid_size: int | None = None,
        sequence_length: int | None = None,
    ) -> dict[str, Any]:
        """Generate a new VCaptcha challenge."""
        body: dict[str, Any] = {}
        if mode is not None:
            body["mode"] = mode
        if grid_size is not None:
            body["gridSize"] = grid_size
        if sequence_length is not None:
            body["sequenceLength"] = sequence_length
        return await self._c._request("POST", "/v1/vcaptcha/challenge", json=body)

    async def verify(self, challenge_id: str, clicks: list[int]) -> dict[str, Any]:
        """Verify a VCaptcha solution."""
        return await self._c._request(
            "POST",
            "/v1/vcaptcha/verify",
            json={"challengeId": challenge_id, "clicks": clicks},
        )

    async def get_config(self) -> dict[str, Any]:
        """Get current VCaptcha configuration."""
        resp = await self._c._request("GET", "/v1/vcaptcha/config")
        return resp["config"]

    async def update_config(self, **patch: Any) -> dict[str, Any]:
        """Update VCaptcha configuration (admin only)."""
        resp = await self._c._request("PATCH", "/v1/vcaptcha/config", json=patch)
        return resp["config"]

    async def get_stats(self) -> dict[str, Any]:
        """Get challenge statistics (admin only)."""
        resp = await self._c._request("GET", "/v1/vcaptcha/stats")
        return resp["stats"]

    async def cleanup(self) -> dict[str, Any]:
        """Delete expired challenges (admin only)."""
        return await self._c._request("POST", "/v1/vcaptcha/cleanup")
