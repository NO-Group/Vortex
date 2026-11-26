using System.Net.Http.Headers;
using System.Text.Json;

namespace NoGroup.Vortex;

/// <summary>
/// Vortex BaaS .NET SDK.
///
/// ```csharp
/// var vortex = new VortexClient("https://your-vortex.example.com");
/// var session = await vortex.Auth.SignupAsync("user@example.com", "password");
/// var notes = await vortex.Database.From("notes").Filter("owner_id", "eq", session.User.Id).Limit(10).ExecuteAsync();
/// ```
/// </summary>
public sealed class VortexClient : IDisposable
{
    private readonly HttpClient _http;
    public string Token { get; set; }
    public string BaseUrl { get; }

    public VortexClient(string baseUrl)
    {
        BaseUrl = baseUrl.TrimEnd('/');
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        _http.BaseAddress = new Uri(BaseUrl + "/");
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string path, object? body)
    {
        var req = new HttpRequestMessage(method, path);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body is not null)
        {
            req.Content = JsonContent.Create(body);
        }
        if (!string.IsNullOrEmpty(Token))
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        }
        return req;
    }

    private async Task<T> RequestAsync<T>(HttpMethod method, string path, object? body)
    {
        var resp = await _http.SendAsync(BuildRequest(method, path, body));
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();

        if (!resp.IsSuccessStatusCode)
        {
            var error = json.GetProperty("error");
            throw new VortexException(
                (int)resp.StatusCode,
                error.GetProperty("code").GetString()!,
                error.GetProperty("message").GetString()!);
        }

        return json.Deserialize<T>(JsonSerializerOptions.Default)!;
    }

    private async Task RequestAsync(HttpMethod method, string path, object? body)
    {
        var resp = await _http.SendAsync(BuildRequest(method, path, body));
        if (!resp.IsSuccessStatusCode)
        {
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var error = json.GetProperty("error");
            throw new VortexException(
                (int)resp.StatusCode,
                error.GetProperty("code").GetString()!,
                error.GetProperty("message").GetString()!);
        }
    }

    public AuthService Auth => new(this);
    public DatabaseService Database => new(this);
    public StorageService Storage => new(this);
    public FunctionsService Functions => new(this);
    public AppsService Apps => new(this);
    public BillingService Billing => new(this);
    public AdminService Admin => new(this);

    public void Dispose() => _http.Dispose();
}

public sealed class VortexException : Exception
{
    public int Status { get; }
    public string Code { get; }

    public VortexException(int status, string code, string message) : base(message)
    {
        Status = status;
        Code = code;
    }
}

public sealed class AuthService
{
    private readonly VortexClient _client;
    public AuthService(VortexClient client) => _client = client;

    public async Task<AuthSession> SignupAsync(string email, string password, object? metadata = null)
    {
        var body = new Dictionary<string, object> { ["email"] = email, ["password"] = password };
        if (metadata is not null) body["metadata"] = metadata;
        var session = await _client.RequestAsync<AuthSession>(HttpMethod.Post, "v1/auth/signup", body);
        _client.Token = session.Token;
        return session;
    }

    public async Task<AuthSession> LoginAsync(string email, string password)
    {
        var session = await _client.RequestAsync<AuthSession>(HttpMethod.Post, "v1/auth/login",
            new Dictionary<string, object> { ["email"] = email, ["password"] = password });
        _client.Token = session.Token;
        return session;
    }

    public Task<AuthUser> MeAsync() =>
        _client.RequestAsync<AuthUser>(HttpMethod.Get, "v1/auth/me", null);

    public Task<JsonElement> ListOAuthProvidersAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/auth/oauth/providers", null);

    public Task RegisterDeviceAsync(string token, string platform, string? pushService = null)
    {
        var body = new Dictionary<string, object> { ["token"] = token, ["platform"] = platform };
        if (pushService is not null) body["pushService"] = pushService;
        return _client.RequestAsync(HttpMethod.Post, "v1/notifications/devices", body);
    }

    public Task SendNotificationAsync(string title, string body, object? data = null)
    {
        var payload = new Dictionary<string, object> { ["title"] = title, ["body"] = body };
        if (data is not null) payload["data"] = data;
        return _client.RequestAsync(HttpMethod.Post, "v1/notifications", payload);
    }
}

public sealed class DatabaseService
{
    private readonly VortexClient _client;
    public DatabaseService(VortexClient client) => _client = client;

    public QueryBuilder From(string table) => new(_client, table);

    public Task<JsonElement> InsertAsync(string table, object rows) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, $"v1/db/{table}", new Dictionary<string, object> { ["rows"] = rows });

    public Task<JsonElement> ListTablesAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/db/tables", null);
}

public sealed class QueryBuilder
{
    private readonly VortexClient _client;
    private readonly string _table;
    private readonly List<object> _filters = new();
    private List<object>? _orderBy;
    private List<string>? _select;
    private int? _limit;
    private int? _offset;
    private bool _countTotal;

    public QueryBuilder(VortexClient client, string table)
    {
        _client = client;
        _table = table;
    }

    public QueryBuilder Select(params string[] cols) { _select = cols.ToList(); return this; }
    public QueryBuilder Filter(string column, string op, object value)
    {
        _filters.Add(new Dictionary<string, object> { ["column"] = column, ["op"] = op, ["value"] = value });
        return this;
    }
    public QueryBuilder Limit(int n) { _limit = n; return this; }
    public QueryBuilder Offset(int n) { _offset = n; return this; }
    public QueryBuilder OrderBy(string column, string direction = "asc")
    {
        _orderBy ??= new List<object>();
        _orderBy.Add(new Dictionary<string, object> { ["column"] = column, ["direction"] = direction });
        return this;
    }
    public QueryBuilder CountTotal() { _countTotal = true; return this; }

    public Task<JsonElement> ExecuteAsync()
    {
        var body = new Dictionary<string, object> { ["filters"] = _filters };
        if (_countTotal) body["countTotal"] = true;
        if (_select is not null) body["select"] = _select;
        if (_limit is not null) body["limit"] = _limit;
        if (_offset is not null) body["offset"] = _offset;
        if (_orderBy is not null) body["orderBy"] = _orderBy;
        return _client.RequestAsync<JsonElement>(HttpMethod.Post, $"v1/db/{_table}/query", body);
    }
}

public sealed class StorageService
{
    private readonly VortexClient _client;
    public StorageService(VortexClient client) => _client = client;

    public Task<JsonElement> CreateBucketAsync(string name, bool isPublic = false) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/storage/buckets",
            new Dictionary<string, object> { ["name"] = name, ["isPublic"] = isPublic });

    public Task<JsonElement> ListBucketsAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/storage/buckets", null);

    public Task<JsonElement> PresignUploadAsync(string path) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/storage/presign-upload",
            new Dictionary<string, object> { ["path"] = path });

    public string ImageUrl(string bucket, string path, IDictionary<string, string>? opts = null)
    {
        var url = $"{_client.BaseUrl}/v1/storage/public/{bucket}/{path}";
        if (opts is not null && opts.Count > 0)
        {
            var qs = string.Join("&", opts.Select(kv => $"{kv.Key}={kv.Value}"));
            url += "?" + qs;
        }
        return url;
    }
}

public sealed class FunctionsService
{
    private readonly VortexClient _client;
    public FunctionsService(VortexClient client) => _client = client;

    public Task<JsonElement> DeployAsync(string name, string language, string code, string description = "") =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/functions", new Dictionary<string, object>
        {
            ["name"] = name, ["language"] = language, ["code"] = code, ["description"] = description
        });

    public Task<JsonElement> ListAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/functions", null);

    public Task<JsonElement> InvokeAsync(string name, object data) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, $"functions/{name}", data);

    public Task DeleteAsync(string name) =>
        _client.RequestAsync(HttpMethod.Delete, $"v1/functions/{name}", null);
}

public sealed class AppsService
{
    private readonly VortexClient _client;
    public AppsService(VortexClient client) => _client = client;

    public Task<JsonElement> CreateAsync(string name, string title, string description = "") =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/apps", new Dictionary<string, object>
        {
            ["name"] = name, ["title"] = title, ["description"] = description
        });

    public Task<JsonElement> ListAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/apps", null);

    public Task DeleteAsync(string id) =>
        _client.RequestAsync(HttpMethod.Delete, $"v1/apps/{id}", null);
}

public sealed class BillingService
{
    private readonly VortexClient _client;
    public BillingService(VortexClient client) => _client = client;

    public Task<JsonElement> StatusAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/billing/status", null);

    public Task<JsonElement> ListPlansAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/billing/plans", null);

    public Task<JsonElement> CheckoutAsync(string planName, string email, string? successUrl = null, string? cancelUrl = null)
    {
        var body = new Dictionary<string, object> { ["planName"] = planName, ["email"] = email };
        if (successUrl is not null) body["successUrl"] = successUrl;
        if (cancelUrl is not null) body["cancelUrl"] = cancelUrl;
        return _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/billing/checkout", body);
    }

    public Task<JsonElement> ListTransactionsAsync(int limit = 50) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, $"v1/billing/transactions?limit={limit}", null);

    public Task<JsonElement> GetSubscriptionAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/billing/subscription", null);

    public Task<JsonElement> CancelSubscriptionAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/billing/subscription/cancel", null);

    public Task<JsonElement> GetMeAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/billing/me", null);
}

public sealed class AdminService
{
    private readonly VortexClient _client;
    public AdminService(VortexClient client) => _client = client;

    public Task<JsonElement> SqlAsync(string statement) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/sql", new Dictionary<string, object> { ["sql"] = statement });

    public Task<JsonElement> ListPoliciesAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/policies", null);

    public Task<JsonElement> CreatePolicyAsync(string table, object policy) =>
        _client.RequestAsync<JsonElement>(HttpMethod.Post, "v1/policies", new Dictionary<string, object> { ["table"] = table, ["policy"] = policy });

    public Task<JsonElement> ListUsersAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/auth/users", null);

    public Task<JsonElement> InsightsOverviewAsync() =>
        _client.RequestAsync<JsonElement>(HttpMethod.Get, "v1/insights/overview", null);
}

public sealed class AuthSession
{
    public string Token { get; set; } = "";
    public int ExpiresIn { get; set; }
    public AuthUser User { get; set; } = new();
}

public sealed class AuthUser
{
    public string Id { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
    public Dictionary<string, object>? Metadata { get; set; }
}
