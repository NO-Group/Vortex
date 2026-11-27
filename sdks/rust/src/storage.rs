use serde_json::{json, Value};
use reqwest::Client;

pub struct Storage {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Storage {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn create_bucket(&self, name: &str, is_public: bool) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/storage/buckets", self.base_url);
        let mut req = self.http.post(url).json(&json!({ "name": name, "isPublic": is_public }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_buckets(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/storage/buckets", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn presign_upload(&self, path: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/storage/presign-upload", self.base_url);
        let mut req = self.http.post(url).json(&json!({ "path": path }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    /// Build a public image URL with optional transforms.
    pub fn image_url(&self, bucket: &str, path: &str, opts: &[(&str, &str)]) -> String {
        let mut url = format!("{}/v1/storage/public/{}/{}", self.base_url, bucket, path);
        if !opts.is_empty() {
            let qs: Vec<String> = opts.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
            url.push('?');
            url.push_str(&qs.join("&"));
        }
        url
    }
}
