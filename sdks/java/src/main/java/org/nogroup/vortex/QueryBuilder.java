package org.nogroup.vortex;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class QueryBuilder {

    private final VortexClient client;
    private final String table;
    private final List<JSONObject> filters = new ArrayList<>();
    private final List<JSONObject> orderBy = new ArrayList<>();
    private List<String> select;
    private Integer limit;
    private Integer offset;
    private boolean countTotal;

    QueryBuilder(VortexClient client, String table) {
        this.client = client;
        this.table = table;
    }

    public QueryBuilder select(String... cols) {
        this.select = List.of(cols);
        return this;
    }

    public QueryBuilder filter(String column, String op, Object value) {
        filters.add(new JSONObject().put("column", column).put("op", op).put("value", value));
        return this;
    }

    public QueryBuilder limit(int n) {
        this.limit = n;
        return this;
    }

    public QueryBuilder offset(int n) {
        this.offset = n;
        return this;
    }

    public QueryBuilder orderBy(String column, String direction) {
        orderBy.add(new JSONObject().put("column", column).put("direction", direction));
        return this;
    }

    public QueryBuilder orderBy(String column) {
        return orderBy(column, "asc");
    }

    public QueryBuilder countTotal() {
        this.countTotal = true;
        return this;
    }

    public JSONObject execute() throws IOException {
        JSONObject body = new JSONObject().put("filters", new JSONArray(filters));
        if (countTotal) body.put("countTotal", true);
        if (select != null) body.put("select", new JSONArray(select));
        if (limit != null) body.put("limit", limit);
        if (offset != null) body.put("offset", offset);
        if (!orderBy.isEmpty()) body.put("orderBy", new JSONArray(orderBy));
        return client.request("POST", "/v1/db/" + table + "/query", body);
    }
}
