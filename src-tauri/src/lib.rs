use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Returns the app's local data directory path.
fn app_data_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut path = app.path().app_local_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    path.push("attachments");
    let _ = fs::create_dir_all(&path);
    path
}

#[derive(serde::Serialize)]
struct AttachResult {
    name: String,
    size: u64,
}

/// Copies a file from `source_path` into the app's attachments directory.
/// Returns the stored filename and the file size.
#[tauri::command]
fn attach_file(app: tauri::AppHandle, source_path: String) -> Result<AttachResult, String> {
    let src = PathBuf::from(&source_path);
    let file_name = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");
    let dest_name = format!("{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        file_name
    );
    let dest = app_data_dir(&app).join(&dest_name);
    fs::copy(&src, &dest).map_err(|e| format!("{}", e))?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    Ok(AttachResult { name: dest_name, size })
}

/// Checks whether a file exists at the given path.
#[tauri::command]
fn file_exists(path: String) -> bool {
    PathBuf::from(&path).exists()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![attach_file, file_exists])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

