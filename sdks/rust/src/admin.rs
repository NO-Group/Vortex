use serde_json::{json, Value};
use reqwest::Client;

pub struct Admin {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Admin {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    /// Run a raw SQL statement (admin only).
    pub async fn sql(&self, statement: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/sql", self.base_url);
        let mut req = self.http.post(url).json(&json!({ "sql": statement }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_policies(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/policies", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn create_policy(&self, table: &str, policy: Value) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/policies", self.base_url);
        let mut req = self.http.post(url).json(&json!({ "table": table, "policy": policy }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_users(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/auth/users", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn insights_overview(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/insights/overview", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }
}
