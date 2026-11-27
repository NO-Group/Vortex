using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Com.NoGroup.Vortex
{
    /// <summary>
    /// Vortex BaaS Unity SDK.
    ///
    /// ```csharp
    /// var vortex = new VortexClient("https://your-vortex.example.com");
    /// var coroutine = vortex.Auth.Signup("user@example.com", "password",
    ///     data => { Debug.Log(data["user"]["id"].AsString()); });
    /// StartCoroutine(coroutine);
    /// ```
    /// Responses are returned as <see cref="JsonObject"/> (a minimal JSON reader).
    /// </summary>
    public sealed class VortexClient
    {
        public string BaseUrl { get; }
        public string Token { get; set; }

        public AuthService Auth { get; }
        public DatabaseService Database { get; }
        public StorageService Storage { get; }
        public FunctionsService Functions { get; }
        public AppsService Apps { get; }
        public BillingService Billing { get; }
        public AdminService Admin { get; }

        public VortexClient(string baseUrl)
        {
            BaseUrl = baseUrl.TrimEnd('/');
            Auth = new AuthService(this);
            Database = new DatabaseService(this);
            Storage = new StorageService(this);
            Functions = new FunctionsService(this);
            Apps = new AppsService(this);
            Billing = new BillingService(this);
            Admin = new AdminService(this);
        }

        /// <summary>Issue an HTTP request and parse the JSON response.</summary>
        public IEnumerator Request(string method, string path, string body,
            Action<JsonObject> onSuccess, Action<int, string, string> onError)
        {
            var headers = new Dictionary<string, string> { { "Accept", "application/json" } };
            if (!string.IsNullOrEmpty(body))
            {
                headers["Content-Type"] = "application/json";
            }
            if (!string.IsNullOrEmpty(Token))
            {
                headers["Authorization"] = "Bearer " + Token;
            }

            using var request = UnityWebRequest.SendRequest(BaseUrl + path, method, body ?? string.Empty, headers);
            yield return request.SendWebRequest();

            if (request.result == UnityWebRequest.Result.Success)
            {
                string text = request.downloadHandler.text;
                try
                {
                    onSuccess?.Invoke(JsonObject.Parse(text));
                }
                catch (Exception e)
                {
                    onError?.Invoke(-1, "parse", e.Message);
                }
            }
            else
            {
                string text = request.downloadHandler != null ? request.downloadHandler.text : "";
                var err = JsonError.Parse(text, request.responseCode);
                onError?.Invoke(request.responseCode, err.code, err.message);
            }
        }

        public string ImageUrl(string bucket, string path, Dictionary<string, string> opts = null)
        {
            var url = $"{BaseUrl}/v1/storage/public/{bucket}/{path}";
            if (opts != null && opts.Count > 0)
            {
                var qs = new StringBuilder();
                bool first = true;
                foreach (var kv in opts)
                {
                    if (!first) qs.Append('&');
                    qs.Append($"{kv.Key}={kv.Value}");
                    first = false;
                }
                url += "?" + qs;
            }
            return url;
        }
    }

    /// <summary>Minimal JSON object reader for Unity (no external deps).</summary>
    public sealed class JsonObject
    {
        private readonly Dictionary<string, JsonObject> _obj = new Dictionary<string, JsonObject>();
        private readonly List<JsonObject> _arr = new List<JsonObject>();
        public bool IsObject { get; private set; }
        public bool IsArray { get; private set; }

        /// <summary>Raw scalar value for string/number/bool/null nodes.</summary>
        public string RawValue { get; internal set; }

        public static JsonObject Parse(string json) => JsonReader.Parse(json);

        public bool Has(string key) => _obj.ContainsKey(key);
        public JsonObject Get(string key) => _obj.TryGetValue(key, out var v) ? v : new JsonObject();
        public JsonObject GetAt(int i) => _arr.Count > i ? _arr[i] : new JsonObject();

        public int Count => _arr.Count;

        internal void Set(string key, JsonObject value) => _obj[key] = value;
        internal void Add(JsonObject value) => _arr.Add(value);

        public string AsString(string key)
        {
            var v = Get(key);
            return v.IsObject || v.IsArray ? null : v.RawValue;
        }

        public string AsString() => RawValue ?? "";
        public double AsNumber(string key) => double.TryParse(AsString(key), out var n) ? n : 0;
        public bool AsBool(string key) => AsString(key) == "true";

        public static JsonObject FromString(string s)
        {
            var node = new JsonObject();
            node.RawValue = s;
            return node;
        }
    }

    /// <summary>Parsed error from a Vortex response.</summary>
    public struct JsonError
    {
        public string code;
        public string message;

        public static JsonError Parse(string body, int status)
        {
            try
            {
                var json = JsonObject.Parse(body);
                var error = json.Get("error");
                return new JsonError
                {
                    code = error.AsString("code") ?? "error",
                    message = error.AsString("message") ?? $"HTTP {status}"
                };
            }
            catch
            {
                return new JsonError { code = "error", message = $"HTTP {status}" };
            }
        }
    }

    internal static class JsonReader
    {
        private static int _i;

        public static JsonObject Parse(string s)
        {
            _i = 0;
            return ParseValue(s);
        }

        private static void SkipWs(string s)
        {
            while (_i < s.Length && char.IsWhiteSpace(s[_i])) _i++;
        }

        private static JsonObject ParseValue(string s)
        {
            SkipWs(s);
            if (_i >= s.Length) return new JsonObject();
            char c = s[_i];
            if (c == '{') return ParseObject(s);
            if (c == '[') return ParseArray(s);
            if (c == '"')
            {
                var node = new JsonObject();
                node.RawValue = ParseString(s);
                return node;
            }
            // number/bool/null — capture as raw string
            int start = _i;
            while (_i < s.Length && s[_i] != ',' && s[_i] != '}' && s[_i] != ']' && !char.IsWhiteSpace(s[_i])) _i++;
            var scalar = new JsonObject();
            scalar.RawValue = s.Substring(start, _i - start);
            return scalar;
        }

        private static JsonObject ParseObject(string s)
        {
            var node = new JsonObject { IsObject = true };
            _i++; // skip {
            SkipWs(s);
            if (_i < s.Length && s[_i] == '}') { _i++; return node; }
            while (_i < s.Length)
            {
                SkipWs(s);
                string key = ParseString(s);
                SkipWs(s);
                if (_i < s.Length && s[_i] == ':') _i++;
                var value = ParseValue(s);
                node.Set(key, value);
                SkipWs(s);
                if (_i < s.Length && s[_i] == ',') _i++;
                if (_i < s.Length && s[_i] == '}') { _i++; break; }
            }
            return node;
        }

        private static JsonObject ParseArray(string s)
        {
            var node = new JsonObject { IsArray = true };
            _i++; // skip [
            SkipWs(s);
            if (_i < s.Length && s[_i] == ']') { _i++; return node; }
            while (_i < s.Length)
            {
                var value = ParseValue(s);
                node.Add(value);
                SkipWs(s);
                if (_i < s.Length && s[_i] == ',') _i++;
                if (_i < s.Length && s[_i] == ']') { _i++; break; }
            }
            return node;
        }

        private static string ParseString(string s)
        {
            var sb = new StringBuilder();
            _i++; // skip opening quote
            while (_i < s.Length && s[_i] != '"')
            {
                if (s[_i] == '\\' && _i + 1 < s.Length)
                {
                    _i++;
                    switch (s[_i])
                    {
                        case 'n': sb.Append('\n'); break;
                        case 't': sb.Append('\t'); break;
                        case 'r': sb.Append('\r'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        default: sb.Append(s[_i]); break;
                    }
                }
                else
                {
                    sb.Append(s[_i]);
                }
                _i++;
            }
            if (_i < s.Length) _i++; // skip closing quote
            return sb.ToString();
        }

        public static string Escape(string s)
        {
            if (string.IsNullOrEmpty(s)) return s ?? "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
        }

        public static string GetStringValue(JsonObject node) => node.RawValue ?? "";
    }
}
