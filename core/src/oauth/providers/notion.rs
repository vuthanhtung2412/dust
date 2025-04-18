use crate::oauth::{
    connection::{
        Connection, ConnectionProvider, FinalizeResult, Provider, ProviderError, RefreshResult,
    },
    credential::Credential,
    providers::utils::execute_request,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use lazy_static::lazy_static;
use serde_json::json;
use std::env;

lazy_static! {
    static ref OAUTH_NOTION_CLIENT_ID: String = env::var("OAUTH_NOTION_CLIENT_ID").unwrap();
    static ref OAUTH_NOTION_CLIENT_SECRET: String = env::var("OAUTH_NOTION_CLIENT_SECRET").unwrap();
}

pub struct NotionConnectionProvider {}

impl NotionConnectionProvider {
    pub fn new() -> Self {
        NotionConnectionProvider {}
    }

    fn basic_auth(&self) -> String {
        general_purpose::STANDARD.encode(&format!(
            "{}:{}",
            *OAUTH_NOTION_CLIENT_ID, *OAUTH_NOTION_CLIENT_SECRET
        ))
    }
}

#[async_trait]
impl Provider for NotionConnectionProvider {
    fn id(&self) -> ConnectionProvider {
        ConnectionProvider::Notion
    }

    async fn finalize(
        &self,
        _connection: &Connection,
        _related_credentials: Option<Credential>,
        code: &str,
        redirect_uri: &str,
    ) -> Result<FinalizeResult, ProviderError> {
        let body = json!({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        });

        let req = self
            .reqwest_client()
            .post("https://api.notion.com/v1/oauth/token")
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Basic {}", self.basic_auth()))
            .json(&body);

        let raw_json = execute_request(ConnectionProvider::Notion, req)
            .await
            .map_err(|e| self.handle_provider_request_error(e))?;

        let access_token = match raw_json["access_token"].as_str() {
            Some(token) => token,
            None => Err(anyhow!("Missing `access_token` in response from Notion"))?,
        };

        Ok(FinalizeResult {
            redirect_uri: redirect_uri.to_string(),
            code: code.to_string(),
            access_token: access_token.to_string(),
            access_token_expiry: None,
            refresh_token: None,
            raw_json,
        })
    }

    async fn refresh(
        &self,
        _connection: &Connection,
        _related_credentials: Option<Credential>,
    ) -> Result<RefreshResult, ProviderError> {
        Err(ProviderError::ActionNotSupportedError(
            "Notion access tokens do not expire".to_string(),
        ))?
    }

    fn scrubbed_raw_json(&self, raw_json: &serde_json::Value) -> Result<serde_json::Value> {
        let raw_json = match raw_json.clone() {
            serde_json::Value::Object(mut map) => {
                map.remove("access_token");
                serde_json::Value::Object(map)
            }
            _ => Err(anyhow!("Invalid raw_json, not an object"))?,
        };
        Ok(raw_json)
    }
}
