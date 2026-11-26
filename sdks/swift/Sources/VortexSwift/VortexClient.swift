import Foundation

/// Vortex BaaS Swift SDK.
///
/// ```swift
/// let vortex = VortexClient(baseURL: "https://your-vortex.example.com")
/// let session = await vortex.auth.signup(email: "user@example.com", password: "password")
/// let notes = await vortex.database.from("notes")
///     .filter("owner_id", "eq", session.user.id)
///     .limit(10)
///     .execute()
/// ```
public final class VortexClient {
    public private(set) var token: String?
    public let baseURL: String

    private let session: URLSession
    private let decoder = JSONDecoder()

    public init(baseURL: String) {
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
    }

    func setToken(_ token: String) {
        self.token = token
    }

    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        body: [String: Any]? = nil
    ) async throws -> T {
        var req = URLRequest(url: URL(string: baseURL + path)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw VortexError(status: -1, code: "network", message: "Invalid response")
        }
        if http.statusCode >= 400 {
            let err = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])??["error"] as? [String: Any]
            throw VortexError(
                status: http.statusCode,
                code: err?["code"] as? String ?? "error",
                message: err?["message"] as? String ?? "Request failed"
            )
        }
        return try decoder.decode(T.self, from: data)
    }

    func request(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> JSONValue {
        let data = try await requestRaw(method, path, body: body)
        return try JSONSerialization.jsonObject(with: data) as! JSONValue
    }

    private func requestRaw(
        _ method: String,
        _ path: String,
        body: [String: Any]? = nil
    ) async throws -> Data {
        var req = URLRequest(url: URL(string: baseURL + path)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw VortexError(status: -1, code: "network", message: "Invalid response")
        }
        if http.statusCode >= 400 {
            let err = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])??["error"] as? [String: Any]
            throw VortexError(
                status: http.statusCode,
                code: err?["code"] as? String ?? "error",
                message: err?["message"] as? String ?? "Request failed"
            )
        }
        return data
    }

    public var auth: AuthService { AuthService(client: self) }
    public var database: DatabaseService { DatabaseService(client: self) }
    public var storage: StorageService { StorageService(client: self) }
    public var functions: FunctionsService { FunctionsService(client: self) }
    public var apps: AppsService { AppsService(client: self) }
    public var billing: BillingService { BillingService(client: self) }
    public var admin: AdminService { AdminService(client: self) }
}

public struct VortexError: Error {
    public let status: Int
    public let code: String
    public let message: String

    public init(status: Int, code: String, message: String) {
        self.status = status
        self.code = code
        self.message = message
    }
}

public typealias JSONValue = Any
