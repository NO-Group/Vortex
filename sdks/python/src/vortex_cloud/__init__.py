"""Vortex BaaS Python SDK.

```python
from vortex_cloud import VortexClient

vortex = VortexClient(url="https://your-vortex.example.com")
session = await vortex.auth.signup(email="user@example.com", password="password")
notes = await vortex.database.from("notes").filter("owner_id", "eq", session.user.id).limit(10).execute()
```
"""
from .client import VortexClient
from .errors import VortexError

__all__ = ["VortexClient", "VortexError"]
__version__ = "1.0.0"
