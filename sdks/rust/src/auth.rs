use crate::{Client, Session, User};
use serde::{Deserialize, Serialize};
use serde_json::json;

pub struct Auth {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Auth {
    pub fn new(base_url: String, http: Client) -> Self {
        Self { base_url, http, token: None }
    }

    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub async fn signup(&self, email: &str, password: &str) -> Result<Session, reqwest::Error> {
        let url = format!("{}/v1/auth/signup", self.base_url);
        let mut req = self.http.post(url).json(&json!({"email": email, "password": password}));
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    pub async fn login(&self, email: &str, password: &str) -> Result<Session, reqwest::Error> {
        let url = format!("{}/v1/auth/login", self.base_url);
        let mut req = self.http.post(url).json(&json!({"email": email, "password": password}));
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req.send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    pub async fn me(&self) -> Result<User, reqwest::Error> {
        let url = format!("{}/v1/auth/me", self.base_url);
        let req = self.http.get(url).bearer_auth(self.token.as_deref().unwrap_or(""));
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_oauth_providers(&self) -> Result<Vec<serde_json::Value>, reqwest::Error> {
        let url = format!("{}/v1/auth/oauth/providers", self.base_url);
        let resp = self.http.get(url).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }
}
