use serde_json::{json, Value};
use reqwest::Client;

pub struct Apps {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Apps {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn create(&self, name: &str, title: &str, description: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/apps", self.base_url);
        let mut req = self.http.post(url).json(&json!({
            "name": name,
            "title": title,
            "description": description
        }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/apps", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn get(&self, id: &str) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/apps/{}", self.base_url, id);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn delete(&self, id: &str) -> Result<(), reqwest::Error> {
        let url = format!("{}/v1/apps/{}", self.base_url, id);
        let mut req = self.http.delete(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        req.send().await?.error_for_status()?;
        Ok(())
    }
}
