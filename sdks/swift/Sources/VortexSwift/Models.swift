import Foundation

public struct AuthSession: Codable {
    public let token: String
    public let expiresIn: Int
    public let user: AuthUser
}

public struct AuthUser: Codable {
    public let id: String
    public let email: String
    public let role: String
    public let metadata: [String: String]?

    public init(id: String, email: String, role: String, metadata: [String: String]? = nil) {
        self.id = id
        self.email = email
        self.role = role
        self.metadata = metadata
    }
}
