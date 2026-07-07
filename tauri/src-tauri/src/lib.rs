mod sys;
pub mod utils;

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, AtomicI32, Ordering},
    Mutex,
    OnceLock,
};
use std::time::Instant;

static BACKEND_EXIT_CODE: AtomicI32 = AtomicI32::new(0);
static BACKEND_HAS_EXITED: AtomicBool = AtomicBool::new(false);
static BACKEND_IS_READY: AtomicBool = AtomicBool::new(false);
static BACKEND_IS_MIGRATING: AtomicBool = AtomicBool::new(false);
static BACKEND_START_REQUESTED: AtomicBool = AtomicBool::new(false);
static RUST_STARTED_AT: OnceLock<Instant> = OnceLock::new();

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    path::BaseDirectory,
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

const DEFAULT_PORT: u16 = 6722;
const DEFAULT_HOST: &str = "127.0.0.1";
const MIGRATION_START_MARKER: &str = "[GT_AI_GATEWAY_MIGRATION_START]";
const MIGRATION_END_MARKER: &str = "[GT_AI_GATEWAY_MIGRATION_END]";

fn rust_log(message: impl std::fmt::Display) {
    let elapsed_ms = RUST_STARTED_AT.get_or_init(Instant::now).elapsed().as_millis();
    println!("RUST +{}ms: {}", elapsed_ms, message);
}

/// 存储后端实际使用的 URL，供前端通过 Tauri 命令查询
struct BackendUrl(String);

/// 存储 root token，供前端自动登录
struct AuthToken(String);

struct BackendLaunchConfig {
    db_path: PathBuf,
    log_dir: PathBuf,
    port: u16,
    host: String,
    root_token: String,
}

struct BackendProcessState {
    platform_state: Mutex<Option<sys::platform::PlatformState>>,
}


/// Tauri 命令：返回后端服务的实际 URL
#[tauri::command]
fn get_backend_url(state: tauri::State<BackendUrl>) -> String {
    let url = state.0.clone();
    rust_log(format!("get_backend_url called, url={}", url));
    url
}

/// Tauri 命令：返回 root token，供前端自动登录
#[tauri::command]
fn get_auth_token(state: tauri::State<AuthToken>) -> String {
    let token = state.0.clone();
    rust_log(format!("get_auth_token called, token={:.8}...", token));
    token
}

#[tauri::command]
fn exit_app() {
    std::process::exit(1);
}

#[tauri::command]
fn show_splash_window(app: tauri::AppHandle) -> Result<(), String> {
    rust_log("show_splash_window invoked");
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.show().map_err(|e| e.to_string())?;
        let _ = splash.set_focus();
        rust_log("splashscreen window shown");
        Ok(())
    } else {
        rust_log("splashscreen window not found when showing splash");
        Err("splashscreen window not found".to_string())
    }
}

#[tauri::command]
async fn open_main_window(app: tauri::AppHandle) -> Result<(), String> {
    rust_log("open_main_window invoked");
    if let Some(splash) = app.get_webview_window("splashscreen") {
        rust_log("closing splashscreen window");
        let _ = splash.close();
    } else {
        rust_log("splashscreen window not found when opening main window");
    }
    tauri::async_runtime::spawn_blocking(move || {
        show_main_window(&app)
    }).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_backend_status() -> Result<(), i32> {
    let code = BACKEND_EXIT_CODE.load(Ordering::SeqCst);
    let has_exited = BACKEND_HAS_EXITED.load(Ordering::SeqCst);
    if has_exited && !BACKEND_IS_READY.load(Ordering::SeqCst) {
        Err(code)
    } else if code != 0 {
        Err(code)
    } else {
        Ok(())
    }
}

#[tauri::command]
fn is_backend_ready() -> bool {
    BACKEND_IS_READY.load(Ordering::SeqCst)
}

#[tauri::command]
fn is_backend_migrating() -> bool {
    BACKEND_IS_MIGRATING.load(Ordering::SeqCst)
}

#[tauri::command]
async fn start_backend(app: tauri::AppHandle) -> Result<(), String> {
    rust_log("start_backend invoked");
    tauri::async_runtime::spawn_blocking(move || start_backend_process(&app))
        .await
        .map_err(|e| e.to_string())?
}

fn start_backend_process(app: &tauri::AppHandle) -> Result<(), String> {
    if BACKEND_START_REQUESTED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        rust_log("start_backend ignored because backend start was already requested");
        return Ok(());
    }

    BACKEND_EXIT_CODE.store(0, Ordering::SeqCst);
    BACKEND_HAS_EXITED.store(false, Ordering::SeqCst);
    BACKEND_IS_READY.store(false, Ordering::SeqCst);
    BACKEND_IS_MIGRATING.store(false, Ordering::SeqCst);

    let launch_config = app.state::<BackendLaunchConfig>();
    let db_path = launch_config.db_path.clone();
    let log_dir = launch_config.log_dir.clone();
    let port = launch_config.port;
    let host = launch_config.host.clone();
    let root_token = launch_config.root_token.clone();

    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("failed to get exe path: {}", e))?
        .parent()
        .ok_or_else(|| "exe has no parent dir".to_string())?
        .to_path_buf();

    let (mut cmd, migration_dir) = sys::platform::get_command(&exe_dir);

    rust_log(format!("starting backend, exe_dir={:?}", exe_dir));
    rust_log(format!("backend data db_path={:?}", db_path));
    rust_log(format!("backend log_dir={:?}", log_dir));
    rust_log(format!("backend port={}", port));
    rust_log(format!("backend migration_dir={:?}", migration_dir));

    cmd.env("DB_PATH", db_path.to_str().unwrap())
        .env("PORT", port.to_string())
        .env("HOST", &host)
        .env("LOG_DIR", log_dir.to_str().unwrap())
        .env("ROOT_TOKEN", &root_token)
        .arg("--desktop-mode")
        .env("MIGRATION_DIR", migration_dir);

    let mut platform_state = sys::platform::setup_command(&mut cmd);
    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            BACKEND_START_REQUESTED.store(false, Ordering::SeqCst);
            return Err(format!("failed to spawn backend sidecar: {}", e));
        }
    };
    let stdout = child.stdout.take();

    sys::platform::post_spawn(&mut platform_state, &mut child);

    let process_state = app.state::<BackendProcessState>();
    let mut stored_platform_state = process_state
        .platform_state
        .lock()
        .map_err(|e| e.to_string())?;
    *stored_platform_state = Some(platform_state);
    drop(stored_platform_state);

    watch_backend_stdout(app.clone(), child, stdout);
    rust_log("backend process spawned");
    Ok(())
}

fn watch_backend_stdout(
    app_handle: tauri::AppHandle,
    mut child: std::process::Child,
    stdout: Option<std::process::ChildStdout>,
) {
    std::thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        use tauri::Emitter;

        rust_log("STDOUT_READER_THREAD_STARTED");

        // 持续读取 stdout，直到进程退出管道关闭（这同时充当了 drain 的作用，防止子进程被阻塞）
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            for line in reader.lines() {
                if let Ok(line_str) = line {
                    rust_log(format!("BACKEND_STDOUT: {}", line_str));
                    if line_str.contains(MIGRATION_START_MARKER) {
                        BACKEND_IS_MIGRATING.store(true, Ordering::SeqCst);
                        let _ = app_handle.emit("backend-migration-start", ());
                    }
                    if line_str.contains(MIGRATION_END_MARKER) {
                        BACKEND_IS_MIGRATING.store(false, Ordering::SeqCst);
                        let _ = app_handle.emit("backend-migration-end", line_str.clone());
                    }
                    // 检测到成功启动的关键日志
                    if line_str.contains("Server listening on") {
                        BACKEND_IS_READY.store(true, Ordering::SeqCst);
                        let _ = app_handle.emit("backend-ready", ());
                    }
                } else if let Err(e) = line {
                    rust_log(format!("STDOUT READ ERROR: {:?}", e));
                }
            }
        }

        // stdout 结束后（意味着子进程已经退出），收集退出码
        if let Ok(status) = child.wait() {
            if let Some(code) = status.code() {
                BACKEND_EXIT_CODE.store(code, Ordering::SeqCst);
                BACKEND_HAS_EXITED.store(true, Ordering::SeqCst);
                if !BACKEND_IS_READY.load(Ordering::SeqCst) || code != 0 {
                    let _ = app_handle.emit("backend-error", code);
                }
            } else {
                BACKEND_EXIT_CODE.store(1, Ordering::SeqCst);
                BACKEND_HAS_EXITED.store(true, Ordering::SeqCst);
                if !BACKEND_IS_READY.load(Ordering::SeqCst) {
                    let _ = app_handle.emit("backend-error", 1);
                }
            }
        }
    });
}

#[tauri::command]
fn log_to_rust(msg: String) {
    rust_log(format!("FRONTEND_LOG: {}", msg));
}

struct AppConfig {
    port: u16,
    host: String,
    root_token: String,
}


/// 生成随机 token（UUID v4）
fn generate_random_token() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// 从 app_data_dir/config.json 读取配置。
/// 若文件不存在或缺少 root_token，自动生成并写入。
fn read_config(app_data_dir: &Path) -> AppConfig {
    let config_path = app_data_dir.join("config.json");

    let mut port = DEFAULT_PORT;
    let mut host = DEFAULT_HOST.to_string();
    let mut root_token = String::new();
    let mut need_write = false;

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(p) = json["port"].as_u64() {
                    if p > 0 && p <= 65535 {
                        port = p as u16;
                    }
                }
                if let Some(h) = json["host"].as_str() {
                    if !h.is_empty() {
                        host = h.to_string();
                    }
                }
                if let Some(t) = json["root_token"].as_str() {
                    if !t.is_empty() {
                        root_token = t.to_string();
                    }
                }
            }
        }
    } else {
        need_write = true;
    }

    // 若 root_token 为空，自动生成一个 UUID
    if root_token.is_empty() {
        root_token = generate_random_token();
        need_write = true;
    }

    // 将配置写回文件（确保 root_token 持久化）
    if need_write {
        let config_json = serde_json::json!({
            "port": port,
            "host": host,
            "root_token": root_token
        });
        let _ = fs::write(
            &config_path,
            serde_json::to_string_pretty(&config_json).unwrap(),
        );
    }

    AppConfig { port, host, root_token }
}


fn show_main_window(app: &tauri::AppHandle) {
    rust_log("show_main_window called");
    sys::platform::set_dock_visibility(app, true);
    if let Some(window) = app.get_webview_window("main") {
        rust_log("main window already exists, showing it");
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    let result = tauri::WebviewWindowBuilder::new(
        app,
        "main",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("GT AI Gateway")
    .inner_size(1280.0, 800.0)
    .resizable(true)
    .build();

    match result {
        Ok(_) => rust_log("main window created successfully"),
        Err(e) => rust_log(format!("FAILED to create main window: {:?}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = RUST_STARTED_AT.set(Instant::now());
    rust_log("run started");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_backend_url, get_auth_token, exit_app, show_splash_window, start_backend, open_main_window, check_backend_status, is_backend_ready, is_backend_migrating, log_to_rust])
        .setup(|app| {
            rust_log("setup started");
            rust_log(format!(
                "splashscreen window exists in setup={}",
                app.get_webview_window("splashscreen").is_some(),
            ));

            let app_data_dir = app
                .path()
                .data_dir()
                .expect("failed to get data dir")
                .join("GtCoder")
                .join("AiGateway");

            let log_dir = app_data_dir.join("logs");
            fs::create_dir_all(&app_data_dir)?;
            fs::create_dir_all(&log_dir)?;

            let db_path = app_data_dir.join("gateway.db");
            let config = read_config(&app_data_dir);

            rust_log(format!("data_dir={:?}", app_data_dir));
            rust_log(format!("log_dir={:?}", log_dir));
            rust_log(format!("db_path={:?}", db_path));
            rust_log(format!("port={}", config.port));
            rust_log("backend launch deferred until splash is visible");

            app.manage(BackendLaunchConfig {
                db_path: db_path.clone(),
                log_dir: log_dir.clone(),
                port: config.port,
                host: config.host.clone(),
                root_token: config.root_token.clone(),
            });
            app.manage(BackendProcessState {
                platform_state: Mutex::new(None),
            });

            // 存储后端 URL 和 auth token，供前端查询。如果配置为 0.0.0.0，前端连接应使用 127.0.0.1
            let backend_url = utils::generate_client_url(&config.host, config.port);
            app.manage(BackendUrl(backend_url));
            app.manage(AuthToken(config.root_token.clone()));

            // 把 app_data_dir 存入 managed state，供菜单事件回调使用
            app.manage(app_data_dir.clone());

            // 托盘菜单
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let open_config_item = MenuItem::with_id(app, "open_config", "打开配置目录", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &open_config_item, &quit_item])?;

            let tray_icon_path = app
                .path()
                .resolve("icons/tray-icon@2x.png", BaseDirectory::Resource);
            let tray_icon = tray_icon_path
                .ok()
                .and_then(|path| Image::from_path(path).ok())
                .unwrap_or_else(|| app.default_window_icon().unwrap().clone());

            TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("GT AI Gateway")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        show_main_window(app);
                    }
                    "open_config" => {
                        let dir = app.state::<std::path::PathBuf>().inner().clone();
                        let _ = open::that(dir);
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            rust_log("setup finished");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    sys::platform::set_dock_visibility(window.app_handle(), false);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                // Prevent the app from completely exiting when the last window closes
                api.prevent_exit();
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { has_visible_windows, .. } => {
                if !has_visible_windows {
                    if BACKEND_IS_READY.load(Ordering::SeqCst) {
                        show_main_window(app_handle);
                    } else if let Some(splash) = app_handle.get_webview_window("splashscreen") {
                        let _ = splash.show();
                        let _ = splash.set_focus();
                    }
                }
            }
            _ => {}
        });
}
