package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;

public class FunctionsService {

    private final VortexClient client;

    FunctionsService(VortexClient client) {
        this.client = client;
    }

    public JSONObject deploy(String name, String language, String code, String description) throws IOException {
        return client.request("POST", "/v1/functions", new JSONObject()
                .put("name", name)
                .put("language", language)
                .put("code", code)
                .put("description", description));
    }

    public JSONObject list() throws IOException {
        return client.request("GET", "/v1/functions", null);
    }

    public JSONObject invoke(String name, JSONObject data) throws IOException {
        return client.request("POST", "/functions/" + name, data);
    }

    public JSONObject get(String name) throws IOException {
        return client.request("GET", "/v1/functions/" + name, null);
    }

    public void delete(String name) throws IOException {
        client.request("DELETE", "/v1/functions/" + name, null);
    }
}
