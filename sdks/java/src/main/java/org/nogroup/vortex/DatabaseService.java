package org.nogroup.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class DatabaseService {

    private final VortexClient client;

    DatabaseService(VortexClient client) {
        this.client = client;
    }

    public QueryBuilder from(String table) {
        return new QueryBuilder(client, table);
    }

    public JSONObject insert(String table, JSONArray rows) throws IOException {
        return client.request("POST", "/v1/db/" + table, new JSONObject().put("rows", rows));
    }

    public JSONObject listTables() throws IOException {
        return client.request("GET", "/v1/db/tables", null);
    }
}
