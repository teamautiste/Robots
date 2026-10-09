mod sdk;

use axum::{body::Body, extract::{Path, State}, http::{header, StatusCode}, response::{IntoResponse, Response}, routing::{get, post}, Json, Router};
use bytes::Bytes;
use chrono::Utc;
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, env, net::{IpAddr, SocketAddr}, path::PathBuf, sync::{atomic::{AtomicBool, Ordering}, Arc}, time::{Duration, Instant}};
use tokio::sync::broadcast;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};

#[derive(Clone)] struct App { cameras: Arc<Cameras>, db: Arc<Db>, robots: Arc<Robots> }
struct Cameras { items: Mutex<HashMap<String, Entry>> }
struct Entry { device: sdk::camera::Device, status: Camera, stop: Arc<AtomicBool>, frames: broadcast::Sender<Bytes> }
#[derive(Clone, Serialize)] struct Camera { serial: String, model: String, name: String, connected: bool, opened: bool, capturing: bool, width: Option<u32>, height: Option<u32>, fps: Option<f64>, last_error: Option<String> }
#[derive(Clone, Serialize)] struct Assignment { robot_ip: String, camera_serial: String, created_at: String, updated_at: String }
struct Db { connection: Mutex<Connection> }
struct Robots { client: reqwest::Client, url: String, cached: Mutex<Vec<Robot>> }
#[derive(Clone, Serialize)] struct Robot { id: String, ip: String }
#[derive(Deserialize)] struct Config { ips: HashMap<String, String> }
#[derive(Deserialize)] struct Assign { camera_serial: String }
struct ApiError(StatusCode, &'static str, String);
type Result<T> = std::result::Result<T, ApiError>;
impl IntoResponse for ApiError { fn into_response(self) -> Response { (self.0, Json(serde_json::json!({"code": self.1, "error": self.2}))).into_response() } }

impl Cameras {
    fn new() -> Self { Self { items: Mutex::new(HashMap::new()) } }
    fn scan(&self) -> std::result::Result<(), String> {
        let found = sdk::camera::enumerate().map_err(|error| error.to_string())?;
        let mut items = self.items.lock();
        for entry in items.values_mut() { entry.status.connected = false; }
        for device in found { let serial = device.serial.clone(); items.entry(serial.clone()).and_modify(|entry| { entry.device = device.clone(); entry.status.connected = true; }).or_insert_with(|| { let (frames, _) = broadcast::channel(2); Entry { status: Camera { serial: serial.clone(), model: device.model.clone(), name: device.name.clone(), connected: true, opened: false, capturing: false, width: None, height: None, fps: None, last_error: None }, device, stop: Arc::new(AtomicBool::new(false)), frames } }); }
        Ok(())
    }
    fn list(&self) -> Vec<Camera> { self.items.lock().values().map(|entry| entry.status.clone()).collect() }
    fn get(&self, serial: &str) -> Option<Camera> { self.items.lock().get(serial).map(|entry| entry.status.clone()) }
    fn start(self: &Arc<Self>, serial: &str) -> Result<()> {
        let (device, stop, tx) = { let mut items = self.items.lock(); let entry = items.get_mut(serial).ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "camera_not_found", "Cámara no encontrada".into()))?; if !entry.status.connected { return Err(ApiError(StatusCode::CONFLICT, "camera_disconnected", "La cámara está desconectada".into())); } if entry.status.capturing { return Ok(()); } entry.stop.store(false, Ordering::Release); entry.status.opened = true; entry.status.capturing = true; entry.status.last_error = None; (entry.device.clone(), entry.stop.clone(), entry.frames.clone()) };
        let manager = self.clone(); let serial = serial.to_owned();
        std::thread::spawn(move || { let result = capture(device, stop, tx, |width, height, fps, error| manager.update(&serial, width, height, fps, error)); if let Err(error) = result { manager.update(&serial, None, None, None, Some(error)); } if let Some(entry) = manager.items.lock().get_mut(&serial) { entry.status.capturing = false; entry.status.opened = false; } });
        Ok(())
    }
    fn update(&self, serial: &str, width: Option<u32>, height: Option<u32>, fps: Option<f64>, error: Option<String>) { if let Some(entry) = self.items.lock().get_mut(serial) { if width.is_some() { entry.status.width = width; entry.status.height = height; entry.status.fps = fps; } if error.is_some() { entry.status.last_error = error; } } }
    fn stop(&self, serial: &str) -> Result<()> { let items = self.items.lock(); let entry = items.get(serial).ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "camera_not_found", "Cámara no encontrada".into()))?; entry.stop.store(true, Ordering::Release); Ok(()) }
    fn stop_all(&self) { for entry in self.items.lock().values() { entry.stop.store(true, Ordering::Release); } }
    fn receiver(&self, serial: &str) -> Result<broadcast::Receiver<Bytes>> { self.items.lock().get(serial).map(|entry| entry.frames.subscribe()).ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "camera_not_found", "Cámara no encontrada".into())) }
}

fn capture<F>(device: sdk::camera::Device, stop: Arc<AtomicBool>, tx: broadcast::Sender<Bytes>, mut update: F) -> std::result::Result<(), String> where F: FnMut(Option<u32>, Option<u32>, Option<f64>, Option<String>) {
    let mut camera = sdk::camera::Camera::open(device.index).map_err(|error| error.to_string())?; camera.start().map_err(|error| error.to_string())?; let start = Instant::now(); let mut frames = 0u32;
    while !stop.load(Ordering::Acquire) { match camera.frame_jpeg() { Ok((jpeg, width, height)) => { frames += 1; update(Some(width), Some(height), Some(frames as f64 / start.elapsed().as_secs_f64()), None); let _ = tx.send(Bytes::from(jpeg)); }, Err(error) => { update(None, None, None, Some(error.to_string())); std::thread::sleep(Duration::from_millis(100)); } } }
    camera.stop().map_err(|error| error.to_string())
}

impl Db {
    fn open(path: PathBuf) -> std::result::Result<Self, String> { if let Some(parent) = path.parent() { std::fs::create_dir_all(parent).map_err(|error| error.to_string())?; } let connection = Connection::open(path).map_err(|error| error.to_string())?; connection.execute_batch("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_migrations VALUES (1); CREATE TABLE IF NOT EXISTS camera_assignments (robot_ip TEXT PRIMARY KEY NOT NULL, camera_serial TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);").map_err(|error| error.to_string())?; Ok(Self { connection: Mutex::new(connection) }) }
    fn list(&self) -> std::result::Result<Vec<Assignment>, String> { let connection = self.connection.lock(); let mut statement = connection.prepare("SELECT robot_ip,camera_serial,created_at,updated_at FROM camera_assignments ORDER BY robot_ip").map_err(|error| error.to_string())?; let rows = statement.query_map([], |row| Ok(Assignment { robot_ip: row.get(0)?, camera_serial: row.get(1)?, created_at: row.get(2)?, updated_at: row.get(3)? })).map_err(|error| error.to_string())?; let values = rows.collect::<std::result::Result<Vec<_>, _>>().map_err(|error| error.to_string())?; Ok(values) }
    fn get(&self, ip: &str) -> std::result::Result<Option<Assignment>, String> { self.connection.lock().query_row("SELECT robot_ip,camera_serial,created_at,updated_at FROM camera_assignments WHERE robot_ip=?1", [ip], |row| Ok(Assignment { robot_ip: row.get(0)?, camera_serial: row.get(1)?, created_at: row.get(2)?, updated_at: row.get(3)? })).optional().map_err(|error| error.to_string()) }
    fn assign(&self, ip: &str, serial: &str) -> std::result::Result<(), String> { let now = Utc::now().to_rfc3339(); let mut connection = self.connection.lock(); let transaction = connection.transaction().map_err(|error| error.to_string())?; transaction.execute("DELETE FROM camera_assignments WHERE robot_ip=?1 OR camera_serial=?2", params![ip, serial]).map_err(|error| error.to_string())?; transaction.execute("INSERT INTO camera_assignments VALUES (?1,?2,?3,?3)", params![ip, serial, now]).map_err(|error| error.to_string())?; transaction.commit().map_err(|error| error.to_string()) }
    fn remove(&self, ip: &str) -> std::result::Result<(), String> { self.connection.lock().execute("DELETE FROM camera_assignments WHERE robot_ip=?1", [ip]).map(|_| ()).map_err(|error| error.to_string()) }
}

impl Robots {
    fn new() -> Self { let base = env::var("ROBOT_BACKEND_URL").unwrap_or_else(|_| "http://127.0.0.1:5000".into()); let path = env::var("ROBOT_CONFIG_PATH").unwrap_or_else(|_| "/api/config".into()); Self { client: reqwest::Client::builder().timeout(Duration::from_secs(3)).build().unwrap(), url: format!("{}{}", base.trim_end_matches('/'), path), cached: Mutex::new(Vec::new()) } }
    async fn refresh(&self) -> std::result::Result<Vec<Robot>, String> { let config: Config = self.client.get(&self.url).send().await.map_err(|_| "Configuración de robots no disponible".to_owned())?.error_for_status().map_err(|_| "Configuración de robots no disponible".to_owned())?.json().await.map_err(|_| "Configuración de robots inválida".to_owned())?; let mut robots = Vec::new(); for (id, ip) in config.ips { if !id.starts_with("Robot_") || ip.parse::<IpAddr>().is_err() { return Err("Configuración de robots inválida".into()); } robots.push(Robot { id, ip }); } if robots.is_empty() { return Err("Configuración de robots vacía".into()); } robots.sort_by(|a,b| a.id.cmp(&b.id)); *self.cached.lock() = robots.clone(); Ok(robots) }
}

async fn health(State(app): State<App>) -> Json<serde_json::Value> { let cameras = app.cameras.list(); let robots = app.robots.refresh().await; Json(serde_json::json!({"status":"ok","robot_config_available":robots.is_ok(),"cameras_detected":cameras.iter().filter(|camera|camera.connected).count(),"cameras_capturing":cameras.iter().filter(|camera|camera.capturing).count()})) }
async fn robots(State(app): State<App>) -> Json<serde_json::Value> { match app.robots.refresh().await { Ok(robots) => Json(serde_json::json!({"robots":robots,"fresh":true})), Err(error) => Json(serde_json::json!({"robots":app.robots.cached.lock().clone(),"fresh":false,"error":error})) } }
async fn cameras(State(app): State<App>) -> Json<Vec<Camera>> { Json(app.cameras.list()) }
async fn scan(State(app): State<App>) -> Result<Json<Vec<Camera>>> { app.cameras.scan().map_err(|error| ApiError(StatusCode::SERVICE_UNAVAILABLE,"sdk_error",error))?; Ok(Json(app.cameras.list())) }
async fn camera(Path(serial): Path<String>, State(app): State<App>) -> Result<Json<Camera>> { app.cameras.get(&serial).map(Json).ok_or_else(|| ApiError(StatusCode::NOT_FOUND,"camera_not_found","Cámara no encontrada".into())) }
async fn start(Path(serial): Path<String>, State(app): State<App>) -> Result<StatusCode> { app.cameras.start(&serial)?; Ok(StatusCode::NO_CONTENT) }
async fn stop(Path(serial): Path<String>, State(app): State<App>) -> Result<StatusCode> { app.cameras.stop(&serial)?; Ok(StatusCode::NO_CONTENT) }
async fn start_all(State(app): State<App>) -> StatusCode { for camera in app.cameras.list().into_iter().filter(|camera|camera.connected) { let _ = app.cameras.start(&camera.serial); } StatusCode::NO_CONTENT }
async fn stop_all(State(app): State<App>) -> StatusCode { app.cameras.stop_all(); StatusCode::NO_CONTENT }
async fn assignments(State(app): State<App>) -> Result<Json<Vec<Assignment>>> { app.db.list().map(Json).map_err(|error| ApiError(StatusCode::INTERNAL_SERVER_ERROR,"database_error",error)) }
async fn assigned(Path(id): Path<String>, State(app): State<App>) -> Result<Json<serde_json::Value>> { let robot = app.robots.refresh().await.map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE,"robot_config_unavailable","No se pudo validar la configuración".into()))?.into_iter().find(|robot|robot.id==id).ok_or_else(||ApiError(StatusCode::NOT_FOUND,"robot_not_configured","Robot no configurado".into()))?; let assignment = app.db.get(&robot.ip).map_err(|error|ApiError(StatusCode::INTERNAL_SERVER_ERROR,"database_error",error))?; let camera = assignment.as_ref().and_then(|item|app.cameras.get(&item.camera_serial)); Ok(Json(serde_json::json!({"assignment":assignment,"camera":camera}))) }
async fn assign(Path(id): Path<String>, State(app): State<App>, Json(body): Json<Assign>) -> Result<StatusCode> { let robot = app.robots.refresh().await.map_err(|_|ApiError(StatusCode::SERVICE_UNAVAILABLE,"robot_config_unavailable","No se pudo validar la configuración".into()))?.into_iter().find(|robot|robot.id==id).ok_or_else(||ApiError(StatusCode::NOT_FOUND,"robot_not_configured","Robot no configurado".into()))?; if app.cameras.get(&body.camera_serial).is_none() { return Err(ApiError(StatusCode::NOT_FOUND,"camera_not_found","Cámara no encontrada".into())); } app.db.assign(&robot.ip,&body.camera_serial).map_err(|error|ApiError(StatusCode::INTERNAL_SERVER_ERROR,"database_error",error))?; Ok(StatusCode::NO_CONTENT) }
async fn remove(Path(id): Path<String>, State(app): State<App>) -> Result<StatusCode> { let robot = app.robots.refresh().await.map_err(|_|ApiError(StatusCode::SERVICE_UNAVAILABLE,"robot_config_unavailable","No se pudo validar la configuración".into()))?.into_iter().find(|robot|robot.id==id).ok_or_else(||ApiError(StatusCode::NOT_FOUND,"robot_not_configured","Robot no configurado".into()))?; app.db.remove(&robot.ip).map_err(|error|ApiError(StatusCode::INTERNAL_SERVER_ERROR,"database_error",error))?; Ok(StatusCode::NO_CONTENT) }
async fn stream(Path(serial): Path<String>, State(app): State<App>) -> Result<Response> { let stream = BroadcastStream::new(app.cameras.receiver(&serial)?).filter_map(|item| item.ok().map(|jpeg| { let mut data = format!("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: {}\r\n\r\n", jpeg.len()).into_bytes(); data.extend_from_slice(&jpeg); data.extend_from_slice(b"\r\n"); Ok::<Bytes,std::io::Error>(Bytes::from(data)) })); Ok(([(header::CONTENT_TYPE,"multipart/x-mixed-replace; boundary=frame"),(header::CACHE_CONTROL,"no-store")],Body::from_stream(stream)).into_response()) }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let db = PathBuf::from(env::var("CAMERA_DATABASE_PATH").unwrap_or_else(|_| "data/cameras.sqlite3".into()));
    let app = App {
        cameras: Arc::new(Cameras::new()),
        db: Arc::new(Db::open(db).map_err(anyhow::Error::msg)?),
        robots: Arc::new(Robots::new()),
    };
    let _ = app.cameras.scan();
    let router = Router::new()
        .route("/health", get(health))
        .route("/api/robots", get(robots))
        .route("/api/cameras", get(cameras).post(scan))
        .route("/api/cameras/start-all", post(start_all))
        .route("/api/cameras/stop-all", post(stop_all))
        .route("/api/cameras/{serial}", get(camera))
        .route("/api/cameras/{serial}/open", post(start))
        .route("/api/cameras/{serial}/start", post(start))
        .route("/api/cameras/{serial}/stop", post(stop))
        .route("/api/cameras/{serial}/close", post(stop))
        .route("/api/cameras/{serial}/stream", get(stream))
        .route("/api/assignments", get(assignments))
        .route("/api/robots/{id}/camera", get(assigned).put(assign).delete(remove))
        .with_state(app);

    let address: SocketAddr = env::var("CAMERA_BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:5001".into())
        .parse()?;

    println!("  Servicio de Camaras Industriales iRAYPLE");
    println!("  Escuchando en : http://{}", address);
    println!("  Health check  : http://{}/health", address);
    println!("  Listar camaras: http://{}/api/cameras", address);

    axum::serve(tokio::net::TcpListener::bind(address).await?, router).await?;
    Ok(())
}

