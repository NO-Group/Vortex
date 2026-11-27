package org.nogroup.vortex;

import okhttp3.*;

import java.io.IOException;

/**
 * Vortex BaaS Java/Kotlin SDK.
 *
 * <pre>{@code
 * VortexClient vortex = new VortexClient("https://your-vortex.example.com");
 * AuthSession session = vortex.auth().signup("user@example.com", "password");
 * JsonNode notes = vortex.database().from("notes")
 *     .filter("owner_id", "eq", session.getUser().getId())
 *     .limit(10)
 *     .execute();
 * }</pre>
 */
public class VortexClient {

    private final String baseUrl;
    private final OkHttpClient http;
    private volatile String token;

    public VortexClient(String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.http = new OkHttpClient.Builder()
                .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build();
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getToken() {
        return token;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Execute an HTTP request and return the parsed JSON response.
     * Throws {@link VortexException} on non-2xx responses.
     */
    private org.json.JSONObject request(String method, String path, org.json.JSONObject body) throws IOException {
        RequestBody reqBody = null;
        Request.Builder builder = new Request.Builder()
                .url(baseUrl + path)
                .addHeader("Accept", "application/json");

        if (body != null) {
            reqBody = RequestBody.create(body.toString(), MediaType.parse("application/json"));
            builder.addHeader("Content-Type", "application/json");
        }
        if (token != null) {
            builder.addHeader("Authorization", "Bearer " + token);
        }
        builder.method(method, reqBody);

        try (Response resp = http.newCall(builder.build()).execute()) {
            String respBody = resp.body() != null ? resp.body().string() : "{}";
            org.json.JSONObject data = new org.json.JSONObject(respBody);

            if (!resp.isSuccessful()) {
                org.json.JSONObject error = data.optJSONObject("error");
                throw new VortexException(resp.code(),
                        error != null ? error.optString("code", "error") : "error",
                        error != null ? error.optString("message", "Request failed") : "Request failed");
            }
            return data;
        }
    }

    public AuthService auth() { return new AuthService(this); }
    public DatabaseService database() { return new DatabaseService(this); }
    public StorageService storage() { return new StorageService(this); }
    public FunctionsService functions() { return new FunctionsService(this); }
    public AppsService apps() { return new AppsService(this); }
    public BillingService billing() { return new BillingService(this); }
    public AdminService admin() { return new AdminService(this); }
}

class VortexException extends RuntimeException {
    private final int status;
    private final String code;

    public VortexException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() { return status; }
    public String getCode() { return code; }
}
