use serde_json::{json, Value};
use reqwest::Client;

pub struct Billing {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Billing {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn status(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/billing/status", self.base_url);
        Ok(self.http.get(url).send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_plans(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/billing/plans", self.base_url);
        let resp = self.http.get(url).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    pub async fn checkout(&self, plan_name: &str, email: &str, success_url: Option<&str>, cancel_url: Option<&str>) -> Result<Value, reqwest::Error> {
        let mut body = json!({"planName": plan_name, "email": email});
        if let Some(u) = success_url { body["successUrl"] = json!(u); }
        if let Some(u) = cancel_url { body["cancelUrl"] = json!(u); }
        let url = format!("{}/v1/billing/checkout", self.base_url);
        let mut req = self.http.post(url).json(&body);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_transactions(&self, limit: i64) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/billing/transactions?limit={}", self.base_url, limit);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn get_me(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/billing/me", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn cancel_subscription(&self) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/billing/subscription/cancel", self.base_url);
        let mut req = self.http.post(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }
}
