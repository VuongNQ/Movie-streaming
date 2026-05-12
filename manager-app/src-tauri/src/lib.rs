use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct StreamValidationResult {
    link: String,
    is_supported: bool,
}

#[tauri::command]
fn validate_stream_link(link: &str) -> StreamValidationResult {
    let lower_link = link.to_lowercase();
    let supported = (lower_link.starts_with("http://") || lower_link.starts_with("https://"))
        && (lower_link.ends_with(".m3u8")
            || lower_link.contains("hls")
            || lower_link.contains("playlist"));

    StreamValidationResult {
        link: link.to_string(),
        is_supported: supported,
    }
}

#[tauri::command]
fn build_google_oauth_redirect() -> String {
    "https://accounts.google.com/o/oauth2/v2/auth".to_string()
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
