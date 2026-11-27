import Foundation

public final class AuthService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func signup(email: String, password: String, metadata: [String: Any]? = nil) async throws -> AuthSession {
        var body: [String: Any] = ["email": email, "password": password]
        if let metadata = metadata { body["metadata"] = metadata }
        let session = try await client.request("POST", "/v1/auth/signup", body: body) as AuthSession
        client.setToken(session.token)
        return session
    }

    public func login(email: String, password: String) async throws -> AuthSession {
        let session = try await client.request("POST", "/v1/auth/login",
            body: ["email": email, "password": password]) as AuthSession
        client.setToken(session.token)
        return session
    }

    public func me() async throws -> AuthUser {
        try await client.request("GET", "/v1/auth/me")
    }

    public func listOAuthProviders() async throws -> JSONValue {
        try await client.request("GET", "/v1/auth/oauth/providers")
    }

    public func registerDevice(token: String, platform: String, pushService: String? = nil) async throws -> JSONValue {
        var body: [String: Any] = ["token": token, "platform": platform]
        if let pushService = pushService { body["pushService"] = pushService }
        return try await client.request("POST", "/v1/notifications/devices", body: body)
    }

    public func sendNotification(title: String, body: String, data: [String: Any]? = nil) async throws -> JSONValue {
        var payload: [String: Any] = ["title": title, "body": body]
        if let data = data { payload["data"] = data }
        return try await client.request("POST", "/v1/notifications", body: payload)
    }
}

public final class DatabaseService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func from(_ table: String) -> QueryBuilder {
        QueryBuilder(client: client, table: table)
    }

    public func insert(_ table: String, rows: [[String: Any]]) async throws -> JSONValue {
        try await client.request("POST", "/v1/db/\(table)", body: ["rows": rows])
    }

    public func listTables() async throws -> JSONValue {
        try await client.request("GET", "/v1/db/tables")
    }
}

public final class QueryBuilder {
    private let client: VortexClient
    private let table: String
    private var filters: [[String: Any]] = []
    private var orderBy: [[String: Any]] = []
    private var selectColumns: [String]?
    private var limitValue: Int?
    private var offsetValue: Int?
    private var countTotal: Bool = false

    public init(client: VortexClient, table: String) {
        self.client = client
        self.table = table
    }

    @discardableResult
    public func select(_ columns: String...) -> QueryBuilder {
        selectColumns = columns
        return self
    }

    @discardableResult
    public func filter(_ column: String, _ op: String, _ value: Any) -> QueryBuilder {
        filters.append(["column": column, "op": op, "value": value])
        return self
    }

    @discardableResult
    public func limit(_ n: Int) -> QueryBuilder {
        limitValue = n
        return self
    }

    @discardableResult
    public func offset(_ n: Int) -> QueryBuilder {
        offsetValue = n
        return self
    }

    @discardableResult
    public func orderBy(_ column: String, direction: String = "asc") -> QueryBuilder {
        orderBy.append(["column": column, "direction": direction])
        return self
    }

    @discardableResult
    public func countTotal() -> QueryBuilder {
        countTotal = true
        return self
    }

    public func execute() async throws -> JSONValue {
        var body: [String: Any] = ["filters": filters]
        if countTotal { body["countTotal"] = true }
        if let cols = selectColumns { body["select"] = cols }
        if let limit = limitValue { body["limit"] = limit }
        if let offset = offsetValue { body["offset"] = offset }
        if !orderBy.isEmpty { body["orderBy"] = orderBy }
        return try await client.request("POST", "/v1/db/\(table)/query", body: body)
    }
}

public final class StorageService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func createBucket(_ name: String, isPublic: Bool = false) async throws -> JSONValue {
        try await client.request("POST", "/v1/storage/buckets",
            body: ["name": name, "isPublic": isPublic])
    }

    public func listBuckets() async throws -> JSONValue {
        try await client.request("GET", "/v1/storage/buckets")
    }

    public func presignUpload(_ path: String) async throws -> JSONValue {
        try await client.request("POST", "/v1/storage/presign-upload", body: ["path": path])
    }

    public func imageURL(bucket: String, path: String, opts: [String: String] = [:]) -> String {
        let base = "\(client.baseURL)/v1/storage/public/\(bucket)/\(path)"
        if opts.isEmpty { return base }
        let qs = opts.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return "\(base)?\(qs)"
    }
}

public final class FunctionsService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func deploy(_ name: String, language: String, code: String, description: String = "") async throws -> JSONValue {
        try await client.request("POST", "/v1/functions", body: [
            "name": name, "language": language, "code": code, "description": description
        ])
    }

    public func list() async throws -> JSONValue {
        try await client.request("GET", "/v1/functions")
    }

    public func invoke(_ name: String, data: [String: Any]) async throws -> JSONValue {
        try await client.request("POST", "/functions/\(name)", body: data)
    }

    public func delete(_ name: String) async throws {
        try await client.request("DELETE", "/v1/functions/\(name)")
    }
}

public final class AppsService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func create(_ name: String, title: String, description: String = "") async throws -> JSONValue {
        try await client.request("POST", "/v1/apps", body: [
            "name": name, "title": title, "description": description
        ])
    }

    public func list() async throws -> JSONValue {
        try await client.request("GET", "/v1/apps")
    }

    public func delete(_ id: String) async throws {
        try await client.request("DELETE", "/v1/apps/\(id)")
    }
}

public final class BillingService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func status() async throws -> JSONValue {
        try await client.request("GET", "/v1/billing/status")
    }

    public func listPlans() async throws -> JSONValue {
        try await client.request("GET", "/v1/billing/plans")
    }

    public func checkout(_ planName: String, email: String, successURL: String? = nil, cancelURL: String? = nil) async throws -> JSONValue {
        var body: [String: Any] = ["planName": planName, "email": email]
        if let url = successURL { body["successUrl"] = url }
        if let url = cancelURL { body["cancelUrl"] = url }
        return try await client.request("POST", "/v1/billing/checkout", body: body)
    }

    public func listTransactions(limit: Int = 50) async throws -> JSONValue {
        try await client.request("GET", "/v1/billing/transactions?limit=\(limit)")
    }

    public func getSubscription() async throws -> JSONValue {
        try await client.request("GET", "/v1/billing/subscription")
    }

    public func cancelSubscription() async throws -> JSONValue {
        try await client.request("POST", "/v1/billing/subscription/cancel")
    }

    public func getMe() async throws -> JSONValue {
        try await client.request("GET", "/v1/billing/me")
    }
}

public final class AdminService {
    private let client: VortexClient
    public init(client: VortexClient) { self.client = client }

    public func sql(_ statement: String) async throws -> JSONValue {
        try await client.request("POST", "/v1/sql", body: ["sql": statement])
    }

    public func listPolicies() async throws -> JSONValue {
        try await client.request("GET", "/v1/policies")
    }

    public func createPolicy(_ table: String, policy: [String: Any]) async throws -> JSONValue {
        try await client.request("POST", "/v1/policies", body: ["table": table, "policy": policy])
    }

    public func listUsers() async throws -> JSONValue {
        try await client.request("GET", "/v1/auth/users")
    }

    public func insightsOverview() async throws -> JSONValue {
        try await client.request("GET", "/v1/insights/overview")
    }
}
