use serde_json::{json, Value};
use reqwest::Client;

pub struct Database {
    base_url: String,
    http: Client,
    token: Option<String>,
}

impl Database {
    pub fn new(base_url: String, http: Client) -> Self { Self { base_url, http, token: None } }
    pub fn set_token(&mut self, token: &str) { self.token = Some(token.to_string()); }

    pub fn from(&self, table: &str) -> QueryBuilder {
        QueryBuilder { db: self, table: table.to_string(), filters: vec![], limit: None, offset: None, order_by: vec![], count: false, select: None }
    }

    pub async fn insert(&self, table: &str, rows: Vec<Value>) -> Result<Value, reqwest::Error> {
        let url = format!("{}/v1/db/{}", self.base_url, table);
        let mut req = self.http.post(url).json(&json!({"rows": rows}));
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }

    pub async fn list_tables(&self) -> Result<Vec<String>, reqwest::Error> {
        let url = format!("{}/v1/db/tables", self.base_url);
        let mut req = self.http.get(url);
        if let Some(t) = &self.token { req = req.bearer_auth(t); }
        let resp = req.send().await?.error_for_status()?.json::<Value>().await?;
        Ok(resp["tables"].as_array().unwrap_or(&vec![]).iter().map(|v| v.as_str().unwrap_or("").to_string()).collect())
    }
}

pub struct QueryBuilder<'a> {
    db: &'a Database,
    table: String,
    filters: Vec<Value>,
    limit: Option<i64>,
    offset: Option<i64>,
    order_by: Vec<Value>,
    count: bool,
    select: Option<Vec<String>>,
}

impl<'a> QueryBuilder<'a> {
    pub fn select(mut self, cols: Vec<String>) -> Self { self.select = Some(cols); self }
    pub fn filter(mut self, column: &str, op: &str, value: Value) -> Self {
        self.filters.push(json!({"column": column, "op": op, "value": value}));
        self
    }
    pub fn limit(mut self, n: i64) -> Self { self.limit = Some(n); self }
    pub fn offset(mut self, n: i64) -> Self { self.offset = Some(n); self }
    pub fn order_by(mut self, column: &str, direction: &str) -> Self {
        self.order_by.push(json!({"column": column, "direction": direction}));
        self
    }
    pub fn count_total(mut self) -> Self { self.count = true; self }

    pub async fn execute(&self) -> Result<Value, reqwest::Error> {
        let mut body = json!({"filters": self.filters});
        if self.count { body["countTotal"] = json!(true); }
        if let Some(s) = &self.select { body["select"] = json!(s); }
        if let Some(l) = self.limit { body["limit"] = json!(l); }
        if let Some(o) = self.offset { body["offset"] = json!(o); }
        if !self.order_by.is_empty() { body["orderBy"] = json!(self.order_by); }

        let url = format!("{}/v1/db/{}/query", self.db.base_url, self.table);
        let mut req = self.db.http.post(url).json(&body);
        if let Some(t) = &self.db.token { req = req.bearer_auth(t); }
        Ok(req.send().await?.error_for_status()?.json().await?)
    }
}
