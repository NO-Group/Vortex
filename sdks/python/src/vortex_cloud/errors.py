"""Vortex BaaS Python SDK exceptions."""


class VortexError(Exception):
    """Raised when a Vortex API request fails."""

    def __init__(self, message, status=None, code=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code

    def __repr__(self):
        return f"VortexError(status={self.status}, code={self.code!r}, message={self.message!r})"
