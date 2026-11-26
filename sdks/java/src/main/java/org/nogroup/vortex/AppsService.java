package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;

public class AppsService {

    private final VortexClient client;

    AppsService(VortexClient client) {
        this.client = client;
    }

    public JSONObject create(String name, String title, String description) throws IOException {
        return client.request("POST", "/v1/apps", new JSONObject()
                .put("name", name)
                .put("title", title)
                .put("description", description));
    }

    public JSONObject list() throws IOException {
        return client.request("GET", "/v1/apps", null);
    }

    public JSONObject get(String id) throws IOException {
        return client.request("GET", "/v1/apps/" + id, null);
    }

    public void delete(String id) throws IOException {
        client.request("DELETE", "/v1/apps/" + id, null);
    }
}
