use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct StreamValidationResult {
    link: String,
    is_supported: bool,
}

#[tauri::command]
fn validate_stream_link(link: &str) -> StreamValidationResult {
    let is_supported = link
        .parse::<http::Uri>()
        .ok()
        .and_then(|uri| {
            let scheme = uri.scheme_str()?;
            if scheme != "http" && scheme != "https" {
                return None;
            }

            Some(
                uri.path()
                    .to_lowercase()
                    .ends_with(".m3u8")
                    || uri.path().to_lowercase().ends_with(".mpd"),
            )
        })
        .unwrap_or(false);

    StreamValidationResult {
        link: link.to_string(),
        is_supported,
    }
}

#[tauri::command]
fn build_google_oauth_redirect() -> String {
    let client_id = std::env::var("GOOGLE_OAUTH_CLIENT_ID").unwrap_or_default();
    let redirect_uri = std::env::var("GOOGLE_OAUTH_REDIRECT_URI")
        .unwrap_or_else(|_| "http://localhost/oauth/callback".to_string());

    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=token&scope=openid%20email%20profile",
        client_id, redirect_uri
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            validate_stream_link,
            build_google_oauth_redirect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
