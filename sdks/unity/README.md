# com.nogroup.vortex — Unity SDK for Vortex BaaS

## Install

Copy the `.cs` files into your Unity project under `Assets/Plugins/VortexSDK/`.

## Quick Start

```csharp
using Com.NoGroup.Vortex;
using UnityEngine;

public class VortexDemo : MonoBehaviour
{
    void Start()
    {
        var vortex = new VortexClient("https://your-vortex.example.com");
        StartCoroutine(vortex.Auth.Signup("user@example.com", "password",
            data => {
                Debug.Log("User ID: " + data.Get("user").Get("id").RawValue);
            },
            (status, code, msg) => {
                Debug.LogError($"Error {status}: {code} — {msg}");
            }));
    }
}
```

## Services

- `Auth` — Signup, Login, Me, OAuth, RegisterDevice, SendNotification
- `Database` — QueryBuilder (Filter, Limit, Offset, OrderBy, CountTotal), Insert, ListTables
- `Storage` — CreateBucket, ListBuckets, PresignUpload
- `Functions` — Deploy, List, Invoke, Delete
- `Apps` — Create, List, Delete
- `Billing` — Status, Plans, Checkout, Transactions, Subscription
- `Admin` — Sql, Policies, Users, Insights

## Notes

- All calls return coroutines — use `StartCoroutine` or a job/async wrapper.
- Responses are parsed with a minimal built-in JSON reader (`JsonObject`) — no external dependencies.
