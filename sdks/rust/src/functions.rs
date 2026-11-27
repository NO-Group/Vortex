use serde_json::{json, Value};
use reqwest::Client;

pub struct Functions {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Functions {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn deploy(&self, name: &str, language: &str, code: &str, description: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/functions", self.base_url);
        let mut req = self.http.post(url).json(&json!({
            "name": name,
            "language": language,
            "code": code,
            "description": description
        }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/functions", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn invoke(&self, name: &str, data: Value) -> Result<Value, reqwest::Error> {
        let url = format!("{}/functions/{}", self.base_url, name);
        let mut req = self.http.post(url).json(&data);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn get(&self, name: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/functions/{}", self.base_url, name);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn delete(&self, name: &str) -> Result<(), reqwest::Error> {
        let url = format!("{}/v1/functions/{}", self.base_url, name);
        let mut req = self.http.delete(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        req.send().await?.error_for_status()?;
        Ok(())
    }
}
