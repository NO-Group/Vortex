package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;

public class AuthService {

    private final VortexClient client;

    AuthService(VortexClient client) {
        this.client = client;
    }

    public AuthSession signup(String email, String password) throws IOException {
        JSONObject body = new JSONObject().put("email", email).put("password", password);
        JSONObject data = client.request("POST", "/v1/auth/signup", body);
        AuthSession session = AuthSession.fromJson(data);
        client.setToken(session.getToken());
        return session;
    }

    public AuthSession signup(String email, String password, JSONObject metadata) throws IOException {
        JSONObject body = new JSONObject().put("email", email).put("password", password)
                .put("metadata", metadata);
        JSONObject data = client.request("POST", "/v1/auth/signup", body);
        AuthSession session = AuthSession.fromJson(data);
        client.setToken(session.getToken());
        return session;
    }

    public AuthSession login(String email, String password) throws IOException {
        JSONObject data = client.request("POST", "/v1/auth/login",
                new JSONObject().put("email", email).put("password", password));
        AuthSession session = AuthSession.fromJson(data);
        client.setToken(session.getToken());
        return session;
    }

    public JSONObject me() throws IOException {
        return client.request("GET", "/v1/auth/me", null);
    }

    public JSONObject listOAuthProviders() throws IOException {
        return client.request("GET", "/v1/auth/oauth/providers", null);
    }

    public JSONObject registerDevice(String pushToken, String platform, String pushService) throws IOException {
        JSONObject body = new JSONObject().put("token", pushToken).put("platform", platform);
        if (pushService != null) body.put("pushService", pushService);
        return client.request("POST", "/v1/notifications/devices", body);
    }

    public JSONObject sendNotification(String title, String body, JSONObject data) throws IOException {
        JSONObject payload = new JSONObject().put("title", title).put("body", body);
        if (data != null) payload.put("data", data);
        return client.request("POST", "/v1/notifications", payload);
    }
}

class AuthSession {
    private String token;
    private int expiresIn;
    private AuthUser user;

    public String getToken() { return token; }
    public int getExpiresIn() { return expiresIn; }
    public AuthUser getUser() { return user; }

    static AuthSession fromJson(JSONObject data) {
        AuthSession s = new AuthSession();
        s.token = data.optString("token", "");
        s.expiresIn = data.optInt("expiresIn", 0);
        s.user = AuthUser.fromJson(data.optJSONObject("user"));
        return s;
    }
}

class AuthUser {
    private String id;
    private String email;
    private String role;

    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getRole() { return role; }

    static AuthUser fromJson(JSONObject data) {
        AuthUser u = new AuthUser();
        if (data != null) {
            u.id = data.optString("id", "");
            u.email = data.optString("email", "");
            u.role = data.optString("role", "");
        }
        return u;
    }
}
