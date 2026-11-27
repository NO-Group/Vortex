package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;

public class AdminService {

    private final VortexClient client;

    AdminService(VortexClient client) {
        this.client = client;
    }

    public JSONObject sql(String statement) throws IOException {
        return client.request("POST", "/v1/sql", new JSONObject().put("sql", statement));
    }

    public JSONObject listPolicies() throws IOException {
        return client.request("GET", "/v1/policies", null);
    }

    public JSONObject createPolicy(String table, JSONObject policy) throws IOException {
        return client.request("POST", "/v1/policies",
                new JSONObject().put("table", table).put("policy", policy));
    }

    public JSONObject listUsers() throws IOException {
        return client.request("GET", "/v1/auth/users", null);
    }

    public JSONObject insightsOverview() throws IOException {
        return client.request("GET", "/v1/insights/overview", null);
    }
}
