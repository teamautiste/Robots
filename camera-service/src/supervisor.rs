use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use chrono::Local;
use parking_lot::Mutex;
use serde_json::{json, Value};
use std::{collections::VecDeque, env, net::SocketAddr, path::PathBuf, process::Stdio, sync::{atomic::{AtomicBool, Ordering}, Arc}, time::Duration};
use tokio::{io::{AsyncBufReadExt, AsyncRead, BufReader}, process::Command};

const MAX_LOG_LINES: usize = 300;

struct Running { pid: u32, started_at: String }

struct Supervisor {
    service_dir: PathBuf,
    health_url: String,
    stop_all_url: String,
    running: Mutex<Option<Running>>,
    stopping: AtomicBool,
    last_exit: Mutex<Option<String>>,
    logs: Mutex<VecDeque<String>>,
    http: reqwest::Client,
}

type App = Arc<Supervisor>;

impl Supervisor {
    fn log(&self, line: impl Into<String>) {
        let line = format!("[{}] {}", Local::now().format("%H:%M:%S"), line.into());
        println!("{line}");
        let mut logs = self.logs.lock();
        logs.push_back(line);
        while logs.len() > MAX_LOG_LINES { logs.pop_front(); }
    }

    async fn health(&self) -> Option<Value> {
        let response = self.http.get(&self.health_url).timeout(Duration::from_millis(1200)).send().await.ok()?;
        if !response.status().is_success() { return None; }
        response.json().await.ok()
    }
}

fn pipe_logs(app: App, reader: impl AsyncRead + Unpin + Send + 'static) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let line = line.trim_end().to_owned();
            if !line.is_empty() { app.log(line); }
        }
    });
}

/// ¿Hay un camera-service.exe vivo? Sirve para detectar un servicio colgado
/// (no responde /health) o lanzado a mano fuera del supervisor.
async fn service_process_alive() -> bool {
    #[cfg(windows)]
    let output = {
        let mut c = Command::new("tasklist");
        c.args(["/FI", "IMAGENAME eq camera-service.exe", "/NH"]).creation_flags(0x0800_0000);
        c.output().await
    };
    #[cfg(not(windows))]
    let output = Command::new("pgrep").args(["-x", "camera-service"]).output().await;
    match output {
        Ok(out) => {
            let text = String::from_utf8_lossy(&out.stdout).to_lowercase();
            if cfg!(windows) { text.contains("camera-service.exe") } else { out.status.success() }
        }
        Err(_) => false,
    }
}

async fn status(State(app): State<App>) -> Json<Value> {
    let health = app.health().await;
    let (managed, pid, started_at) = match &*app.running.lock() {
        Some(r) => (true, Some(r.pid), Some(r.started_at.clone())),
        None => (false, None, None),
    };
    let state = if app.stopping.load(Ordering::Acquire) { "stopping" }
        else if health.is_some() { "running" }
        else if managed { "starting" }
        else if service_process_alive().await { "unresponsive" }
        else { "stopped" };
    Json(json!({
        "state": state,
        "healthy": health.is_some(),
        "managed": managed,
        "pid": pid,
        "started_at": started_at,
        "last_exit": app.last_exit.lock().clone(),
        "health": health,
    }))
}

async fn logs(State(app): State<App>) -> Json<Value> {
    Json(json!({ "lines": app.logs.lock().iter().cloned().collect::<Vec<_>>() }))
}

async fn start(State(app): State<App>) -> (StatusCode, Json<Value>) {
    if app.running.lock().is_some() || app.health().await.is_some() {
        return (StatusCode::CONFLICT, Json(json!({"error": "already_running", "message": "El servicio ya está en ejecución"})));
    }
    if service_process_alive().await {
        return (StatusCode::CONFLICT, Json(json!({"error": "unresponsive", "message": "Hay un servicio de cámaras que no responde; detenlo primero"})));
    }
    let mut command = Command::new("cargo");
    command.args(["run", "--release", "--bin", "camera-service"])
        .current_dir(&app.service_dir)
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .env("CARGO_TERM_COLOR", "never");
    #[cfg(windows)]
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let message = format!("No se pudo ejecutar cargo: {error}");
            app.log(&message);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "spawn_failed", "message": message})));
        }
    };
    let pid = child.id().unwrap_or_default();
    app.log(format!("Iniciando servicio de cámaras (cargo run --release, PID {pid}) en {}", app.service_dir.display()));
    if let Some(out) = child.stdout.take() { pipe_logs(app.clone(), out); }
    if let Some(err) = child.stderr.take() { pipe_logs(app.clone(), err); }
    *app.running.lock() = Some(Running { pid, started_at: Local::now().to_rfc3339() });
    *app.last_exit.lock() = None;

    let waiter = app.clone();
    tokio::spawn(async move {
        let result = child.wait().await;
        let message = match result {
            Ok(status) if waiter.stopping.load(Ordering::Acquire) => format!("Detenido ({status})"),
            Ok(status) => format!("El servicio terminó inesperadamente ({status})"),
            Err(error) => format!("Error esperando el proceso: {error}"),
        };
        waiter.log(&message);
        *waiter.last_exit.lock() = Some(message);
        *waiter.running.lock() = None;
    });
    (StatusCode::ACCEPTED, Json(json!({"ok": true, "pid": pid})))
}

async fn kill_tree(pid: Option<u32>) {
    #[cfg(windows)]
    let mut command = {
        let mut c = Command::new("taskkill");
        match pid {
            Some(pid) => c.args(["/T", "/F", "/PID", &pid.to_string()]),
            None => c.args(["/F", "/IM", "camera-service.exe"]),
        };
        c.creation_flags(0x0800_0000);
        c
    };
    #[cfg(not(windows))]
    let mut command = {
        let mut c = Command::new("pkill");
        match pid {
            Some(pid) => c.args(["-KILL", "-P", &pid.to_string()]),
            None => c.args(["-KILL", "-x", "camera-service"]),
        };
        c
    };
    let _ = command.stdout(Stdio::null()).stderr(Stdio::null()).status().await;
    #[cfg(not(windows))]
    if let Some(pid) = pid { let _ = Command::new("kill").args(["-KILL", &pid.to_string()]).status().await; }
}

async fn stop(State(app): State<App>) -> (StatusCode, Json<Value>) {
    let pid = app.running.lock().as_ref().map(|r| r.pid);
    let healthy = app.health().await.is_some();
    if pid.is_none() && !healthy && !service_process_alive().await {
        return (StatusCode::CONFLICT, Json(json!({"error": "not_running", "message": "El servicio no está en ejecución"})));
    }
    if app.stopping.swap(true, Ordering::AcqRel) {
        return (StatusCode::CONFLICT, Json(json!({"error": "stopping", "message": "El servicio ya se está deteniendo"})));
    }
    app.log("Deteniendo servicio de cámaras…");
    // Primero se piden detener las capturas para liberar las cámaras; si el
    // servicio está colgado no se espera más de 2 s.
    if healthy {
        let _ = app.http.post(&app.stop_all_url).timeout(Duration::from_secs(2)).send().await;
        tokio::time::sleep(Duration::from_millis(1200)).await;
    }
    // Se termina el árbol de procesos (cargo + camera-service). Si no lo inició
    // este supervisor, o quedó un proceso huérfano, se termina por nombre.
    if pid.is_some() { kill_tree(pid).await; }
    kill_tree(None).await;

    let deadline = tokio::time::Instant::now() + Duration::from_secs(8);
    let mut stopped = false;
    while tokio::time::Instant::now() < deadline {
        if app.running.lock().is_none() && !service_process_alive().await { stopped = true; break; }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
    app.stopping.store(false, Ordering::Release);
    if !stopped {
        let message = "No se pudo terminar camera-service.exe; ciérralo desde el Administrador de tareas".to_owned();
        app.log(&message);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "kill_failed", "message": message})));
    }
    if pid.is_none() {
        let message = "Detenido (proceso iniciado fuera del supervisor)".to_owned();
        app.log(&message);
        *app.last_exit.lock() = Some(message);
    }
    (StatusCode::OK, Json(json!({"ok": true})))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let service_dir = env::var("CAMERA_SERVICE_DIR").map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")));
    dotenvy::from_path(service_dir.join(".env")).ok();

    let service_port = env::var("CAMERA_BIND_ADDR").ok()
        .and_then(|addr| addr.parse::<SocketAddr>().ok())
        .map(|addr| addr.port())
        .unwrap_or(5001);
    let base = format!("http://127.0.0.1:{service_port}");
    let app: App = Arc::new(Supervisor {
        service_dir,
        health_url: format!("{base}/health"),
        stop_all_url: format!("{base}/api/cameras/stop-all"),
        running: Mutex::new(None),
        stopping: AtomicBool::new(false),
        last_exit: Mutex::new(None),
        logs: Mutex::new(VecDeque::new()),
        http: reqwest::Client::new(),
    });

    let router = Router::new()
        .route("/status", get(status))
        .route("/logs", get(logs))
        .route("/start", post(start))
        .route("/stop", post(stop))
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(app.clone());

    let address: SocketAddr = env::var("CAMERA_SUPERVISOR_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:5002".into())
        .parse()?;
    println!("  Supervisor del servicio de cámaras");
    println!("  Escuchando en : http://{address}");
    println!("  Carpeta       : {}", app.service_dir.display());
    println!("  Servicio      : {base}");

    axum::serve(tokio::net::TcpListener::bind(address).await?, router).await?;
    Ok(())
}
