use std::{fs, sync::Mutex};
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
enum AppError {
    #[error("database error: {0}")] Database(#[from] rusqlite::Error),
    #[error("io error: {0}")] Io(#[from] std::io::Error),
    #[error("serialization error: {0}")] Json(#[from] serde_json::Error),
}
type AppResult<T> = Result<T, String>;
struct Db(Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Project { id: String, name: String, color: String, created_at: String, updated_at: String }
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Attachment { id: String, document_id: String, original_name: String, stored_name: String, relative_path: String, mime_type: String, size: i64, created_at: String, kind: String }
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document { id: String, project_id: String, title: String, content: String, planned_date: Option<String>, planned_time: Option<String>, status: String, tags: Vec<String>, attachments: Vec<Attachment>, created_at: String, updated_at: String }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentPatch { title: Option<String>, content: Option<String>, planned_date: Option<String>, planned_time: Option<String>, status: Option<String>, tags: Option<Vec<String>> }
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectPatch { name: Option<String>, color: Option<String> }

fn init_db(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL); INSERT INTO schema_version(version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version); CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT, title TEXT NOT NULL, content TEXT NOT NULL, planned_date TEXT, planned_time TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL); CREATE TABLE IF NOT EXISTS document_tags (document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(document_id, tag_id)); CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, relative_path TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL, kind TEXT NOT NULL);")?;
    seed_if_empty(conn)?;
    Ok(())
}

fn seed_if_empty(conn: &Connection) -> Result<(), AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))?;
    if count > 0 { return Ok(()); }
    let now = Utc::now().to_rfc3339();
    let projects = [("product", "产品迭代", "#5f9d95"), ("client", "客户项目", "#b47eb2"), ("growth", "个人成长", "#d79661")];
    for (id, name, color) in projects { conn.execute("INSERT INTO projects VALUES (?1,?2,?3,?4,?5)", params![id,name,color,now,now])?; }
    conn.execute("INSERT INTO documents (id,project_id,title,content,planned_date,planned_time,status,created_at,updated_at) VALUES (?1,'product','首页信息架构梳理',?2,'2026-08-26','09:42','进行中',?3,?3)", params![Uuid::new_v4().to_string(), "# 首页信息架构梳理\n\n> 目标：让用户在 5 秒内理解 DailyTime 能解决什么问题。\n\n- [x] 明确首屏核心价值\n- [ ] 补充用户场景入口", now])?;
    Ok(())
}
fn fallback<T>(result: Result<T, AppError>) -> AppResult<T> { result.map_err(|e| e.to_string()) }
fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> { Ok(Project { id: row.get(0)?, name: row.get(1)?, color: row.get(2)?, created_at: row.get(3)?, updated_at: row.get(4)? }) }
fn document_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Document> { Ok(Document { id: row.get(0)?, project_id: row.get(1)?, title: row.get(2)?, content: row.get(3)?, planned_date: row.get(4)?, planned_time: row.get(5)?, status: row.get(6)?, tags: Vec::new(), attachments: Vec::new(), created_at: row.get(7)?, updated_at: row.get(8)? }) }

#[tauri::command]
fn list_projects(db: State<Db>) -> AppResult<Vec<Project>> {
    fallback((|| {
        let conn = db.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id,name,color,created_at,updated_at FROM projects ORDER BY created_at")?;
        let rows = stmt.query_map([], project_from_row)?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })())
}
#[tauri::command]
fn create_project(db: State<Db>, name: String) -> AppResult<Project> { fallback((|| { let id=Uuid::new_v4().to_string(); let now=Utc::now().to_rfc3339(); let project=Project{id:id.clone(),name,color:"#8ca69b".into(),created_at:now.clone(),updated_at:now}; db.0.lock().unwrap().execute("INSERT INTO projects VALUES (?1,?2,?3,?4,?5)",params![project.id,project.name,project.color,project.created_at,project.updated_at])?; Ok(project) })()) }
#[tauri::command]
fn update_project(db: State<Db>, id: String, patch: ProjectPatch) -> AppResult<Project> { fallback((|| { let conn=db.0.lock().unwrap(); let current=conn.query_row("SELECT id,name,color,created_at,updated_at FROM projects WHERE id=?1",[&id],project_from_row)?; let project=Project{id:current.id,name:patch.name.unwrap_or(current.name),color:patch.color.unwrap_or(current.color),created_at:current.created_at,updated_at:Utc::now().to_rfc3339()}; conn.execute("UPDATE projects SET name=?2,color=?3,updated_at=?4 WHERE id=?1",params![project.id,project.name,project.color,project.updated_at])?; Ok(project) })()) }
#[tauri::command]
fn list_documents(db: State<Db>) -> AppResult<Vec<Document>> {
    fallback((|| {
        let conn = db.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id,project_id,title,content,planned_date,planned_time,status,created_at,updated_at FROM documents ORDER BY COALESCE(planned_date,'0000-00-00') DESC, COALESCE(planned_time,'00:00') DESC")?;
        let rows = stmt.query_map([], document_from_row)?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    })())
}
#[tauri::command]
fn create_document(db: State<Db>, project_id: String) -> AppResult<Document> { fallback((|| { let id=Uuid::new_v4().to_string(); let now=Utc::now().to_rfc3339(); let doc=Document{id:id.clone(),project_id,title:"未命名便笺".into(),content:"# 未命名便笺\n\n开始记录这项工作的背景、思考和下一步。\n\n## 下一步\n\n- [ ] ".into(),planned_date:Some(Utc::now().format("%Y-%m-%d").to_string()),planned_time:Some(Utc::now().format("%H:%M").to_string()),status:"未开始".into(),tags:Vec::new(),attachments:Vec::new(),created_at:now.clone(),updated_at:now}; db.0.lock().unwrap().execute("INSERT INTO documents (id,project_id,title,content,planned_date,planned_time,status,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",params![doc.id,doc.project_id,doc.title,doc.content,doc.planned_date,doc.planned_time,doc.status,doc.created_at,doc.updated_at])?; Ok(doc) })()) }
#[tauri::command]
fn update_document(db: State<Db>, id: String, patch: DocumentPatch) -> AppResult<Document> { fallback((|| { let conn=db.0.lock().unwrap(); let mut doc=conn.query_row("SELECT id,project_id,title,content,planned_date,planned_time,status,created_at,updated_at FROM documents WHERE id=?1",[&id],document_from_row)?; if let Some(v)=patch.title{doc.title=v}; if let Some(v)=patch.content{doc.content=v}; if let Some(v)=patch.planned_date{doc.planned_date=Some(v)}; if let Some(v)=patch.planned_time{doc.planned_time=Some(v)}; if let Some(v)=patch.status{doc.status=v}; if let Some(v)=patch.tags{doc.tags=v}; doc.updated_at=Utc::now().to_rfc3339(); conn.execute("UPDATE documents SET title=?2,content=?3,planned_date=?4,planned_time=?5,status=?6,updated_at=?7 WHERE id=?1",params![doc.id,doc.title,doc.content,doc.planned_date,doc.planned_time,doc.status,doc.updated_at])?; Ok(doc) })()) }
#[tauri::command]
fn delete_document(db: State<Db>, id: String) -> AppResult<()> { fallback((|| { db.0.lock().unwrap().execute("DELETE FROM documents WHERE id=?1",[&id])?; Ok(()) })()) }
#[tauri::command]
fn add_attachment() -> AppResult<Attachment> { Err("附件原生存储将在 Rust 工具链可用后启用".into()) }
#[tauri::command]
fn export_backup() -> AppResult<()> { Err("备份原生实现将在 Rust 工具链可用后启用".into()) }
#[tauri::command]
fn import_backup() -> AppResult<()> { Err("备份原生实现将在 Rust 工具链可用后启用".into()) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
 pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let primary_path = data_dir.join("dailytime.sqlite");
            let conn = match (|| -> Result<Connection, AppError> {
                fs::create_dir_all(&data_dir)?;
                let conn = Connection::open(&primary_path)?;
                init_db(&conn)?;
                Ok(conn)
            })() {
                Ok(conn) => conn,
                Err(primary_error) => {
                    #[cfg(debug_assertions)]
                    {
                        let fallback_dir = std::env::temp_dir().join("DailyTime-dev");
                        fs::create_dir_all(&fallback_dir)?;
                        let fallback_path = fallback_dir.join("dailytime.sqlite");
                        eprintln!("DailyTime: cannot write {} ({primary_error}); using {}", primary_path.display(), fallback_path.display());
                        let conn = Connection::open(fallback_path)?;
                        init_db(&conn)?;
                        conn
                    }
                    #[cfg(not(debug_assertions))]
                    {
                        return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, format!("无法写入本地数据库 {}：{}", primary_path.display(), primary_error)).into());
                    }
                }
            };
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_projects, create_project, update_project, list_documents, create_document, update_document, delete_document, add_attachment, export_backup, import_backup])
        .run(tauri::generate_context!())
        .expect("error while running DailyTime");
}
