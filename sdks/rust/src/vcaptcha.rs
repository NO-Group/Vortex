use serde_json::{json, Value};
use reqwest::Client;

pub struct VCaptcha {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl VCaptcha {
    pub fn new(base_url: String, http: Client) -> Self {
        Self { base_url, http, token: None }
    }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn challenge(&self, mode: &str, grid_size: i64, seq_len: i64) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/vcaptcha/challenge", self.base_url);
        let mut req = self.http.post(url).json(&json!({
            "mode": mode,
            "gridSize": grid_size,
            "sequenceLength": seq_len
        }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn verify(&self, challenge_id: &str, clicks: &[i64]) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/vcaptcha/verify", self.base_url);
        let mut req = self.http.post(url).json(&json!({
            "challengeId": challenge_id,
            "clicks": clicks
        }));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn get_config(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/vcaptcha/config", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn get_stats(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/vcaptcha/stats", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn cleanup(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/vcaptcha/cleanup", self.base_url);
        let mut req = self.http.post(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }
}
