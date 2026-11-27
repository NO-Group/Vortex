//! Vortex BaaS Rust SDK
//!
//! ```rust
//! use vortex_sdk::VortexClient;
//!
//! #[tokio::main]
//! async fn main() {
//!     let vortex = VortexClient::new("https://your-vortex.example.com");
//!     let session = vortex.auth().signup("user@example.com", "password").await.unwrap();
//! }
//! ```

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;

mod auth;
mod database;
mod storage;
mod functions;
mod apps;
mod billing;
mod admin;
mod vcaptcha;

pub use auth::Auth;
pub use database::Database;
pub use storage::Storage;
pub use functions::Functions;
pub use apps::Apps;
pub use billing::Billing;
pub use admin::Admin;
pub use vcaptcha::VCaptcha;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    pub expires_in: i64,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub role: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

pub struct VortexClient {
    base_url: String,
    token: Option<String>,
    http: Client,
    auth: Auth,
    database: Database,
    storage: Storage,
    functions: Functions,
    apps: Apps,
    billing: Billing,
    admin: Admin,
    vcaptcha: VCaptcha,
}

impl VortexClient {
    pub fn new(base_url: &str) -> Self {
        let http = Client::new();
        let client = VortexClient {
            base_url: base_url.trim_end_matches('/').to_string(),
            token: None,
            http: http.clone(),
            auth: Auth::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            database: Database::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            storage: Storage::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            functions: Functions::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            apps: Apps::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            billing: Billing::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            admin: Admin::new(base_url.trim_end_matches('/').to_string(), http.clone()),
            vcaptcha: VCaptcha::new(base_url.trim_end_matches('/').to_string(), http.clone()),
        };
        client
    }

    pub fn set_token(&mut self, token: &str) {
        self.token = Some(token.to_string());
        self.auth.set_token(token);
        self.database.set_token(token);
        self.storage.set_token(token);
        self.functions.set_token(token);
        self.apps.set_token(token);
        self.billing.set_token(token);
        self.admin.set_token(token);
        self.vcaptcha.set_token(token);
    }

    pub fn auth(&self) -> &Auth { &self.auth }
    pub fn database(&self) -> &Database { &self.database }
    pub fn storage(&self) -> &Storage { &self.storage }
    pub fn functions(&self) -> &Functions { &self.functions }
    pub fn apps(&self) -> &Apps { &self.apps }
    pub fn billing(&self) -> &Billing { &self.billing }
    pub fn admin(&self) -> &Admin { &self.admin }
    pub fn vcaptcha(&self) -> &VCaptcha { &self.vcaptcha }
}
