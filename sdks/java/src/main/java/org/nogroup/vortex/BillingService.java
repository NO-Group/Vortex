package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;

public class BillingService {

    private final VortexClient client;

    BillingService(VortexClient client) {
        this.client = client;
    }

    public JSONObject status() throws IOException {
        return client.request("GET", "/v1/billing/status", null);
    }

    public JSONObject listPlans() throws IOException {
        return client.request("GET", "/v1/billing/plans", null);
    }

    public JSONObject checkout(String planName, String email, String successUrl, String cancelUrl) throws IOException {
        JSONObject body = new JSONObject().put("planName", planName).put("email", email);
        if (successUrl != null) body.put("successUrl", successUrl);
        if (cancelUrl != null) body.put("cancelUrl", cancelUrl);
        return client.request("POST", "/v1/billing/checkout", body);
    }

    public JSONObject listTransactions(int limit) throws IOException {
        return client.request("GET", "/v1/billing/transactions?limit=" + limit, null);
    }

    public JSONObject getSubscription() throws IOException {
        return client.request("GET", "/v1/billing/subscription", null);
    }

    public JSONObject cancelSubscription() throws IOException {
        return client.request("POST", "/v1/billing/subscription/cancel", null);
    }

    public JSONObject getMe() throws IOException {
        return client.request("GET", "/v1/billing/me", null);
    }
}
