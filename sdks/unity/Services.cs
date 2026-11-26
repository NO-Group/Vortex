using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using Com.NoGroup.Vortex;

namespace Com.NoGroup.Vortex
{
    public sealed class AuthService
    {
        private readonly VortexClient _client;
        public AuthService(VortexClient client) => _client = client;

        public IEnumerator Signup(string email, string password,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/auth/signup",
                $"{{\"email\":\"{JsonReader.Escape(email)}\",\"password\":\"{JsonReader.Escape(password)}\"}}",
                data => { _client.Token = data.Get("token").RawValue; onSuccess?.Invoke(data); },
                onError);
        }

        public IEnumerator Login(string email, string password,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/auth/login",
                $"{{\"email\":\"{JsonReader.Escape(email)}\",\"password\":\"{JsonReader.Escape(password)}\"}}",
                data => { _client.Token = data.Get("token").RawValue; onSuccess?.Invoke(data); },
                onError);
        }

        public IEnumerator Me(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/auth/me", null, onSuccess, onError);
        }

        public IEnumerator ListOAuthProviders(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/auth/oauth/providers", null, onSuccess, onError);
        }

        public IEnumerator RegisterDevice(string pushToken, string platform, string pushService,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var body = $"{{\"token\":\"{JsonReader.Escape(pushToken)}\",\"platform\":\"{JsonReader.Escape(platform)}\"";
            if (!string.IsNullOrEmpty(pushService)) body += $",\"pushService\":\"{JsonReader.Escape(pushService)}\"";
            body += "}";
            return _client.Request("POST", "/v1/notifications/devices", body, onSuccess, onError);
        }

        public IEnumerator SendNotification(string title, string body,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var payload = $"{{\"title\":\"{JsonReader.Escape(title)}\",\"body\":\"{JsonReader.Escape(body)}\"}}";
            return _client.Request("POST", "/v1/notifications", payload, onSuccess, onError);
        }
    }

    public sealed class DatabaseService
    {
        private readonly VortexClient _client;
        public DatabaseService(VortexClient client) => _client = client;

        public QueryBuilder From(string table) => new QueryBuilder(_client, table);

        public IEnumerator Insert(string table, string rowsJson,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", $"/v1/db/{table}", $"{{\"rows\":{rowsJson}}}", onSuccess, onError);
        }

        public IEnumerator ListTables(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/db/tables", null, onSuccess, onError);
        }
    }

    public sealed class QueryBuilder
    {
        private readonly VortexClient _client;
        private readonly string _table;
        private readonly List<string> _filters = new List<string>();
        private readonly List<string> _orderBy = new List<string>();
        private string _select;
        private int _limit = -1;
        private int _offset = -1;
        private bool _countTotal;

        public QueryBuilder(VortexClient client, string table)
        {
            _client = client;
            _table = table;
        }

        public QueryBuilder Select(string cols) { _select = cols; return this; }
        public QueryBuilder Filter(string column, string op, string value)
        {
            _filters.Add($"{{\"column\":\"{JsonReader.Escape(column)}\",\"op\":\"{JsonReader.Escape(op)}\",\"value\":{JsonObject.FromString(value).RawValue}}}");
            return this;
        }
        public QueryBuilder Limit(int n) { _limit = n; return this; }
        public QueryBuilder Offset(int n) { _offset = n; return this; }
        public QueryBuilder OrderBy(string column, string direction = "asc")
        {
            _orderBy.Add($"{{\"column\":\"{JsonReader.Escape(column)}\",\"direction\":\"{JsonReader.Escape(direction)}\"}}");
            return this;
        }
        public QueryBuilder CountTotal() { _countTotal = true; return this; }

        public IEnumerator Execute(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var sb = new StringBuilder("{\"filters\":[");
            sb.Append(string.Join(",", _filters));
            sb.Append("]");
            if (_countTotal) sb.Append(",\"countTotal\":true");
            if (_select != null) sb.Append($",\"select\":{_select}");
            if (_limit >= 0) sb.Append($",\"limit\":{_limit}");
            if (_offset >= 0) sb.Append($",\"offset\":{_offset}");
            if (_orderBy.Count > 0) sb.Append($",\"orderBy\":[{string.Join(",", _orderBy)}]");
            sb.Append("}");
            return _client.Request("POST", $"/v1/db/{_table}/query", sb.ToString(), onSuccess, onError);
        }
    }

    public sealed class StorageService
    {
        private readonly VortexClient _client;
        public StorageService(VortexClient client) => _client = client;

        public IEnumerator CreateBucket(string name, bool isPublic,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/storage/buckets",
                $"{{\"name\":\"{JsonReader.Escape(name)}\",\"isPublic\":{(isPublic ? "true" : "false")}}}", onSuccess, onError);
        }

        public IEnumerator ListBuckets(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/storage/buckets", null, onSuccess, onError);
        }

        public IEnumerator PresignUpload(string path,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/storage/presign-upload",
                $"{{\"path\":\"{JsonReader.Escape(path)}\"}}", onSuccess, onError);
        }
    }

    public sealed class FunctionsService
    {
        private readonly VortexClient _client;
        public FunctionsService(VortexClient client) => _client = client;

        public IEnumerator Deploy(string name, string language, string code, string description,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var body = $"{{\"name\":\"{JsonReader.Escape(name)}\",\"language\":\"{JsonReader.Escape(language)}\",\"code\":\"{JsonReader.Escape(code)}\",\"description\":\"{JsonReader.Escape(description)}\"}}";
            return _client.Request("POST", "/v1/functions", body, onSuccess, onError);
        }

        public IEnumerator List(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/functions", null, onSuccess, onError);
        }

        public IEnumerator Invoke(string name, string dataJson,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", $"/functions/{name}", dataJson, onSuccess, onError);
        }

        public IEnumerator Delete(string name, Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("DELETE", $"/v1/functions/{name}", null, onSuccess, onError);
        }
    }

    public sealed class AppsService
    {
        private readonly VortexClient _client;
        public AppsService(VortexClient client) => _client = client;

        public IEnumerator Create(string name, string title, string description,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var body = $"{{\"name\":\"{JsonReader.Escape(name)}\",\"title\":\"{JsonReader.Escape(title)}\",\"description\":\"{JsonReader.Escape(description)}\"}}";
            return _client.Request("POST", "/v1/apps", body, onSuccess, onError);
        }

        public IEnumerator List(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/apps", null, onSuccess, onError);
        }

        public IEnumerator Delete(string id, Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("DELETE", $"/v1/apps/{id}", null, onSuccess, onError);
        }
    }

    public sealed class BillingService
    {
        private readonly VortexClient _client;
        public BillingService(VortexClient client) => _client = client;

        public IEnumerator Status(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/billing/status", null, onSuccess, onError);
        }

        public IEnumerator ListPlans(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/billing/plans", null, onSuccess, onError);
        }

        public IEnumerator Checkout(string planName, string email, string successUrl, string cancelUrl,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var body = $"{{\"planName\":\"{JsonReader.Escape(planName)}\",\"email\":\"{JsonReader.Escape(email)}\"";
            if (!string.IsNullOrEmpty(successUrl)) body += $",\"successUrl\":\"{JsonReader.Escape(successUrl)}\"";
            if (!string.IsNullOrEmpty(cancelUrl)) body += $",\"cancelUrl\":\"{JsonReader.Escape(cancelUrl)}\"";
            body += "}";
            return _client.Request("POST", "/v1/billing/checkout", body, onSuccess, onError);
        }

        public IEnumerator ListTransactions(int limit,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", $"/v1/billing/transactions?limit={limit}", null, onSuccess, onError);
        }

        public IEnumerator GetSubscription(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/billing/subscription", null, onSuccess, onError);
        }

        public IEnumerator CancelSubscription(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/billing/subscription/cancel", null, onSuccess, onError);
        }

        public IEnumerator GetMe(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/billing/me", null, onSuccess, onError);
        }
    }

    public sealed class AdminService
    {
        private readonly VortexClient _client;
        public AdminService(VortexClient client) => _client = client;

        public IEnumerator Sql(string statement, Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/sql", $"{{\"sql\":\"{JsonReader.Escape(statement)}\"}}", onSuccess, onError);
        }

        public IEnumerator ListPolicies(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/policies", null, onSuccess, onError);
        }

        public IEnumerator CreatePolicy(string table, string policyJson,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("POST", "/v1/policies",
                $"{{\"table\":\"{JsonReader.Escape(table)}\",\"policy\":{policyJson}}}", onSuccess, onError);
        }

        public IEnumerator ListUsers(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/auth/users", null, onSuccess, onError);
        }

        public IEnumerator InsightsOverview(Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            return _client.Request("GET", "/v1/insights/overview", null, onSuccess, onError);
        }
    }
}
