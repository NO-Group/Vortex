package org.nogroup.vortex;

import org.json.JSONObject;

import java.io.IOException;
import java.util.Map;

public class StorageService {

    private final VortexClient client;

    StorageService(VortexClient client) {
        this.client = client;
    }

    public JSONObject createBucket(String name, boolean isPublic) throws IOException {
        return client.request("POST", "/v1/storage/buckets",
                new JSONObject().put("name", name).put("isPublic", isPublic));
    }

    public JSONObject listBuckets() throws IOException {
        return client.request("GET", "/v1/storage/buckets", null);
    }

    public JSONObject presignUpload(String path) throws IOException {
        return client.request("POST", "/v1/storage/presign-upload", new JSONObject().put("path", path));
    }

    public String imageUrl(String bucket, String path, Map<String, String> opts) {
        StringBuilder url = new StringBuilder(client.getBaseUrl())
                .append("/v1/storage/public/").append(bucket).append('/').append(path);
        if (opts != null && !opts.isEmpty()) {
            url.append('?');
            boolean first = true;
            for (Map.Entry<String, String> entry : opts.entrySet()) {
                if (!first) url.append('&');
                url.append(entry.getKey()).append('=').append(entry.getValue());
                first = false;
            }
        }
        return url.toString();
    }
}
