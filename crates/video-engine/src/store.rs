//! VideoStore: `video.db` in the video directory (architecture design §5.1). Only the engine that holds the write lock writes it.
//!
//! A transaction's entities, versions, idempotency records, receipt, undo records and outbox are committed in one SQLite transaction (§5.2).
//! Commits use conditional updates on `revision` and `owner_generation`, so an old owner cannot write even if it is still alive.

use std::path::Path;

use rusqlite::{Connection, OpenFlags, OptionalExtension, params};
use serde_json::Value;

use crate::error::{EngineResult, ErrorBody, MessageRef, msg};
use crate::model::{AssetRevision, Id, SCHEMA_VERSION, VIDEO_FORMAT};
use crate::receipt::{HistoryEntry, TransactionReceipt, VideoEvent};
use crate::state::{EntityChange, EntityKind, VideoState};

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  event_seq INTEGER NOT NULL,
  owner_generation INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
  video_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  parent_id TEXT,
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (video_id, entity_id)
);
CREATE TABLE IF NOT EXISTS document_versions (
  video_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (video_id, document_id, revision)
);
CREATE TABLE IF NOT EXISTS asset_versions (
  video_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (video_id, asset_id, revision)
);
CREATE TABLE IF NOT EXISTS bundle_versions (
  video_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (video_id, bundle_id, revision)
);
CREATE TABLE IF NOT EXISTS dependency_edges (
  video_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  from_revision TEXT NOT NULL,
  to_id TEXT NOT NULL,
  to_revision TEXT NOT NULL,
  kind TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  label TEXT NOT NULL,
  base_revision INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  event_seq INTEGER NOT NULL,
  undo_of TEXT,
  undo_depth INTEGER NOT NULL,
  base_label TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  label_ref TEXT,
  base_label_ref TEXT,
  UNIQUE (video_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS receipts (transaction_id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS undo_records (
  transaction_id TEXT PRIMARY KEY,
  changes TEXT NOT NULL,
  undone_by TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  video_id TEXT NOT NULL,
  event_seq INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (video_id, event_seq)
);
"#;

/// The format identifier from before the rename to "video".
const LEGACY_FORMAT: &str = "cuccut.movie";
/// Upgrade an old layout to the current format: tables and columns are renamed, and the keys and entity kinds in the stored JSON (entities, receipts, events, undo records) are renamed.
/// Quotes inside JSON strings are escaped, so a quoted key only matches the real key. Document bodies are user content and are not touched.
const LEGACY_UPGRADE: &str = r#"
ALTER TABLE movies RENAME TO videos;
ALTER TABLE entities RENAME COLUMN movie_id TO video_id;
ALTER TABLE document_versions RENAME COLUMN movie_id TO video_id;
ALTER TABLE asset_versions RENAME COLUMN movie_id TO video_id;
ALTER TABLE bundle_versions RENAME COLUMN movie_id TO video_id;
ALTER TABLE dependency_edges RENAME COLUMN movie_id TO video_id;
ALTER TABLE transactions RENAME COLUMN movie_id TO video_id;
ALTER TABLE outbox RENAME COLUMN movie_id TO video_id;
UPDATE entities SET kind = 'video' WHERE kind = 'movie';
UPDATE entities SET body = replace(replace(replace(body, '"movieId":', '"videoId":'), '"movieRevision":', '"videoRevision":'), '"kind":"movie"', '"kind":"video"');
UPDATE receipts SET body = replace(replace(replace(body, '"movieId":', '"videoId":'), '"movieRevision":', '"videoRevision":'), '"kind":"movie"', '"kind":"video"');
UPDATE outbox SET body = replace(replace(replace(body, '"movieId":', '"videoId":'), '"movieRevision":', '"videoRevision":'), '"kind":"movie"', '"kind":"video"');
UPDATE undo_records SET changes = replace(replace(replace(changes, '"movieId":', '"videoId":'), '"movieRevision":', '"videoRevision":'), '"kind":"movie"', '"kind":"video"');
"#;

pub struct Store {
    conn: Connection,
    /// Whether `transactions` has the tag reference columns. They were added later: a writable open adds them; a read-only open of an old database that lacks them reads as having no references.
    label_refs: bool,
}

/// The tag reference columns (command and protocol spec §3.1) are optional fields; old databases get them added, and schemaVersion is not changed (video format spec §1.4).
const LABEL_REF_COLUMNS: [&str; 2] = ["label_ref", "base_label_ref"];

fn missing_label_ref_columns(conn: &Connection) -> EngineResult<Vec<&'static str>> {
    let mut stmt = conn.prepare("SELECT name FROM pragma_table_info('transactions')")?;
    let present = stmt.query_map([], |r| r.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
    Ok(LABEL_REF_COLUMNS.into_iter().filter(|c| !present.iter().any(|p| p == c)).collect())
}

fn ref_json(message_ref: Option<&MessageRef>) -> Option<String> {
    message_ref.map(json)
}

/// A reference that cannot be read is treated as absent and shown as the stored text, so one piece of bad data does not block the history.
fn parse_ref(column: Option<String>) -> Option<MessageRef> {
    column.and_then(|c| serde_json::from_str(&c).ok())
}

/// The result of a video claiming its owning project (architecture design §5.1; video format spec §1.3).
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", tag = "outcome")]
pub enum ProjectClaim {
    /// The database has no owning project yet (a video from before the upgrade, or a newly created video): record the project passed in; the videoId does not change.
    Adopted,
    /// Already belongs to this project.
    Unchanged,
    /// Belongs to another project: this is a copy, or it was moved to another project. Replace it with a new videoId and record the old one in `previousVideoIds`.
    #[serde(rename_all = "camelCase")]
    Reassigned { previous_video_id: Id, video_id: Id },
}

/// The owning-project and previous-videoId keys in the meta table. They are not part of the video's revision content: writing them creates no new version and does not enter undo history.
const META_PROJECT_ID: &str = "projectId";
const META_PREVIOUS_VIDEO_IDS: &str = "previousVideoIds";

/// The undo record of a transaction: the before and after state of each entity, and whether it has been undone.
pub struct UndoRecord {
    pub changes: Vec<EntityChange>,
    pub undone_by: Option<Id>,
    /// 0 is a forward change, 1 is an undo, 2 is a redo, ...
    pub undo_depth: i64,
    /// The label of a forward change; undo and redo add a prefix in front of it.
    pub base_label: String,
    pub base_label_ref: Option<MessageRef>,
}

/// One step on the undo stack.
#[derive(Clone, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoStep {
    pub transaction_id: Id,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_ref: Option<MessageRef>,
}

/// Everything a transaction writes.
pub struct CommitRecord<'a> {
    pub video_id: &'a str,
    pub base_revision: i64,
    pub generation: i64,
    pub state: &'a VideoState,
    pub changes: &'a [EntityChange],
    pub touched_sequences: &'a [Id],
    pub new_asset_versions: Vec<(Id, AssetRevision)>,
    pub new_document_versions: &'a [DocumentBody],
    pub idempotency_key: &'a str,
    pub payload_hash: &'a str,
    pub receipt: &'a TransactionReceipt,
    pub event: &'a VideoEvent,
    pub undo_of: Option<&'a str>,
    pub undo_depth: i64,
    pub base_label: &'a str,
    pub base_label_ref: Option<&'a MessageRef>,
}

/// The body of one document version, written in the same SQLite transaction as the document header that references it.
#[derive(Clone, Debug, PartialEq)]
pub struct DocumentBody {
    pub document_id: Id,
    pub revision: String,
    pub content_hash: String,
    pub body: String,
}

fn json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).expect("能序列化")
}

impl Store {
    fn configure(conn: &Connection) -> EngineResult<()> {
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(())
    }

    /// The tag reference columns in a query; an old read-only database lacks these columns and they are read as NULL.
    fn ref_column(&self, column: &'static str) -> &'static str {
        if self.label_refs { column } else { "NULL" }
    }

    /// The database of a newly created video. The caller already holds the write lock.
    pub fn create(path: &Path, state: &VideoState, now: &str) -> EngineResult<Store> {
        let mut conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "FULL")?;
        Store::configure(&conn)?;
        let tx = conn.transaction()?;
        tx.execute_batch(SCHEMA)?;
        tx.execute(
            "INSERT INTO meta (key, value) VALUES ('format', ?1), ('schemaVersion', ?2)",
            params![VIDEO_FORMAT, SCHEMA_VERSION.to_string()],
        )?;
        tx.execute(
            "INSERT INTO videos (id, revision, event_seq, owner_generation, created_at, updated_at) VALUES (?1, 0, 0, 0, ?2, ?2)",
            params![state.id, now],
        )?;
        for (id, row) in state.entities() {
            tx.execute(
                "INSERT INTO entities (video_id, entity_id, kind, parent_id, revision, body) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                params![state.id, id, row.kind.as_str(), row.parent, json(&row.body)],
            )?;
        }
        tx.commit()?;
        Ok(Store { conn, label_refs: true })
    }

    /// Portable package import (video format spec §8): attaches the revision numbers from the package (for the video and each sequence) to a database just created with [`Store::create`], and writes the versions of documents and assets.
    pub fn import_versions(&mut self, state: &VideoState, documents: &[DocumentBody]) -> EngineResult<()> {
        let tx = self.conn.transaction()?;
        tx.execute("UPDATE videos SET revision = ?1 WHERE id = ?2", params![state.revision, state.id])?;
        tx.execute(
            "UPDATE entities SET revision = ?1 WHERE video_id = ?2",
            params![state.revision, state.id],
        )?;
        for (id, sequence) in &state.sequences {
            tx.execute(
                "UPDATE entities SET revision = ?1 WHERE video_id = ?2 AND entity_id = ?3",
                params![sequence.revision, state.id, id],
            )?;
        }
        for asset in state.assets.values() {
            for rev in asset.revisions.values() {
                tx.execute(
                    "INSERT INTO asset_versions (video_id, asset_id, revision, content_hash, byte_length, media_type, body)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        state.id,
                        asset.id,
                        rev.revision,
                        rev.content_hash,
                        rev.byte_length as i64,
                        rev.media_type,
                        json(rev)
                    ],
                )?;
            }
        }
        for doc in documents {
            tx.execute(
                "INSERT INTO document_versions (video_id, document_id, revision, content_hash, body) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![state.id, doc.document_id, doc.revision, doc.content_hash, doc.body],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Upgrade a database file in the old layout in place to the current format (the caller holds the old lock, and renames afterwards). A database that is already upgraded is left alone.
    pub fn upgrade_legacy(path: &Path) -> EngineResult<()> {
        let mut conn = Connection::open(path)?;
        Store::configure(&conn)?;
        let format: Option<String> = conn
            .query_row("SELECT value FROM meta WHERE key = 'format'", [], |r| r.get(0))
            .optional()
            .map_err(|_| ErrorBody::unsupported_video(msg!("engine.notCuccutVideo", "Not a CucCut video")))?;
        match format.as_deref() {
            Some(LEGACY_FORMAT) => {
                let tx = conn.transaction()?;
                tx.execute_batch(LEGACY_UPGRADE)?;
                tx.execute("UPDATE meta SET value = ?1 WHERE key = 'format'", [VIDEO_FORMAT])?;
                tx.commit()?;
            }
            Some(VIDEO_FORMAT) => {}
            _ => return Err(ErrorBody::unsupported_video(msg!("engine.notCuccutVideo", "Not a CucCut video"))),
        }
        // When the last connection closes, SQLite merges the WAL back into the main file, so only one file is left when renaming.
        conn.close().map_err(|(_, e)| e)?;
        Ok(())
    }

    pub fn open(path: &Path, read_only: bool) -> EngineResult<Store> {
        if !path.is_file() {
            return Err(ErrorBody::unsupported_video(msg!("engine.noVideoDb", "The directory has no video.db")));
        }
        let conn = if read_only {
            Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?
        } else {
            let conn = Connection::open(path)?;
            conn.pragma_update(None, "journal_mode", "WAL")?;
            conn.pragma_update(None, "synchronous", "FULL")?;
            conn
        };
        Store::configure(&conn)?;
        let mut store = Store { conn, label_refs: false };
        store.check_format()?;
        store.label_refs = store.add_label_ref_columns(read_only)?;
        Ok(store)
    }

    /// Add the tag reference columns, and return whether they can be read. A read-only open does not change the database: when an old database lacks the columns, it reads as having no references.
    fn add_label_ref_columns(&self, read_only: bool) -> EngineResult<bool> {
        let conn = &self.conn;
        let missing = missing_label_ref_columns(conn)?;
        if read_only {
            return Ok(missing.is_empty());
        }
        for column in missing {
            conn.execute_batch(&format!("ALTER TABLE transactions ADD COLUMN {column} TEXT"))?;
        }
        Ok(true)
    }

    fn check_format(&self) -> EngineResult<()> {
        let get = |key: &str| -> EngineResult<Option<String>> {
            Ok(self
                .conn
                .query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0))
                .optional()?)
        };
        let format = get("format").map_err(|_| ErrorBody::unsupported_video(msg!("engine.notCuccutVideo", "Not a CucCut video")))?;
        if format.as_deref() != Some(VIDEO_FORMAT) {
            return Err(ErrorBody::unsupported_video(msg!("engine.notCuccutVideo", "Not a CucCut video")));
        }
        let version = get("schemaVersion")?.unwrap_or_default();
        schema_version_supported(&version)
    }

    /// Read the video's working state and the current owner generation.
    pub fn load(&self) -> EngineResult<(VideoState, i64)> {
        let (id, revision, event_seq, generation): (String, i64, i64, i64) = self
            .conn
            .query_row("SELECT id, revision, event_seq, owner_generation FROM videos LIMIT 1", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })
            .optional()?
            .ok_or_else(|| ErrorBody::unsupported_video(msg!("engine.videoRecordMissing", "The video record is missing")))?;
        let mut state = VideoState {
            id: id.clone(),
            name: String::new(),
            root_sequence_id: String::new(),
            revision,
            event_seq,
            sequences: Default::default(),
            tracks: Default::default(),
            items: Default::default(),
            assets: Default::default(),
            documents: Default::default(),
            checkpoints: Default::default(),
            protections: Default::default(),
            transitions: Default::default(),
            markers: Default::default(),
            ducking: Default::default(),
        };
        let mut stmt = self
            .conn
            .prepare("SELECT entity_id, kind, parent_id, revision, body FROM entities WHERE video_id = ?1")?;
        let rows = stmt.query_map([&id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, String>(4)?,
            ))
        })?;
        let mut sequence_revisions = Vec::new();
        for row in rows {
            let (entity_id, kind, parent, entity_revision, body) = row?;
            let kind = EntityKind::parse(&kind).ok_or_else(|| ErrorBody::unsupported_video(msg!("engine.unknownEntityKind", "Unknown entity kind {kind}", kind)))?;
            let body: Value =
                serde_json::from_str(&body).map_err(|e| ErrorBody::unsupported_video(msg!(
                    "engine.entityCorrupt",
                    "Entity {id} is corrupt: {error}",
                    id = entity_id,
                    error = e.to_string()
                )))?;
            state.put(&entity_id, kind, parent.as_deref(), Some(body))?;
            if kind == EntityKind::Sequence {
                sequence_revisions.push((entity_id, entity_revision));
            }
        }
        for (seq_id, rev) in sequence_revisions {
            if let Some(seq) = state.sequences.get_mut(&seq_id) {
                seq.revision = rev;
            }
        }
        state.id = id;
        Ok((state, generation))
    }

    /// The largest version number ever stored for a document, including versions written by undone transactions (their bodies stay in the database for redo and history reads).
    /// New versions are numbered above it: reusing an existing number would make `INSERT OR IGNORE` keep the old body.
    pub fn max_document_revision(&self, video_id: &str, document_id: &str) -> EngineResult<u64> {
        let mut stmt = self
            .conn
            .prepare("SELECT revision FROM document_versions WHERE video_id = ?1 AND document_id = ?2")?;
        let revisions = stmt.query_map(params![video_id, document_id], |r| r.get::<_, String>(0))?;
        let mut max = 0;
        for revision in revisions {
            if let Ok(n) = revision?.parse::<u64>() {
                max = max.max(n);
            }
        }
        Ok(max)
    }

    /// The body of one document version (JSON text).
    pub fn document_body(&self, video_id: &str, document_id: &str, revision: &str) -> EngineResult<Option<String>> {
        Ok(self
            .conn
            .query_row(
                "SELECT body FROM document_versions WHERE video_id = ?1 AND document_id = ?2 AND revision = ?3",
                params![video_id, document_id, revision],
                |r| r.get(0),
            )
            .optional()?)
    }

    /// Increment the owner generation (ownerGeneration, architecture design §2.3) when write ownership is acquired.
    pub fn bump_generation(&mut self, video_id: &str) -> EngineResult<i64> {
        let tx = self.conn.transaction()?;
        tx.execute(
            "UPDATE videos SET owner_generation = owner_generation + 1 WHERE id = ?1",
            [video_id],
        )?;
        let generation = tx.query_row("SELECT owner_generation FROM videos WHERE id = ?1", [video_id], |r| r.get(0))?;
        tx.commit()?;
        Ok(generation)
    }

    /// Idempotency record: the payload digest for the same key, and the original receipt.
    pub fn find_by_key(&self, video_id: &str, key: &str) -> EngineResult<Option<(String, TransactionReceipt)>> {
        let row: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT t.payload_hash, r.body FROM transactions t JOIN receipts r ON r.transaction_id = t.transaction_id
                 WHERE t.video_id = ?1 AND t.idempotency_key = ?2",
                params![video_id, key],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        row.map(|(hash, body)| {
            let receipt = serde_json::from_str(&body).map_err(|e| ErrorBody::storage(msg!("engine.receiptCorrupt", "The receipt is corrupt: {error}", error = e.to_string())))?;
            Ok((hash, receipt))
        })
        .transpose()
    }

    pub fn undo_record(&self, transaction_id: &str) -> EngineResult<Option<UndoRecord>> {
        let row: Option<(String, Option<String>, i64, String, Option<String>)> = self
            .conn
            .query_row(
                &format!(
                    "SELECT u.changes, u.undone_by, t.undo_depth, t.base_label, {} FROM undo_records u JOIN transactions t ON t.transaction_id = u.transaction_id
                 WHERE u.transaction_id = ?1",
                    self.ref_column("t.base_label_ref")
                ),
                [transaction_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
            )
            .optional()?;
        row.map(|(changes, undone_by, undo_depth, base_label, base_label_ref)| {
            let changes = serde_json::from_str(&changes).map_err(|e| ErrorBody::storage(msg!("engine.undoRecordCorrupt", "The undo record is corrupt: {error}", error = e.to_string())))?;
            Ok(UndoRecord {
                changes,
                undone_by,
                undo_depth,
                base_label,
                base_label_ref: parse_ref(base_label_ref),
            })
        })
        .transpose()
    }

    /// Atomically commit one transaction. If the conditional update fails, the version or the owner has changed, and the whole transaction is rolled back.
    pub fn commit(&mut self, record: &CommitRecord<'_>) -> EngineResult<()> {
        let tx = self.conn.transaction()?;
        let state = record.state;
        let updated = tx.execute(
            "UPDATE videos SET revision = ?1, event_seq = ?2, updated_at = ?3
             WHERE id = ?4 AND revision = ?5 AND owner_generation = ?6",
            params![
                state.revision,
                state.event_seq,
                record.receipt.committed_at,
                record.video_id,
                record.base_revision,
                record.generation
            ],
        )?;
        if updated != 1 {
            return Err(ErrorBody::writer_unavailable(msg!(
                "engine.writerMoved",
                "Write access to the video has moved, or the revision was changed elsewhere"
            )));
        }
        let rows = state.entities();
        for change in record.changes {
            match rows.get(&change.id) {
                Some(row) => {
                    tx.execute(
                        "INSERT INTO entities (video_id, entity_id, kind, parent_id, revision, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                         ON CONFLICT (video_id, entity_id) DO UPDATE SET kind = ?3, parent_id = ?4, revision = ?5, body = ?6",
                        params![
                            record.video_id,
                            change.id,
                            row.kind.as_str(),
                            row.parent,
                            state.revision,
                            json(&row.body)
                        ],
                    )?;
                }
                None => {
                    tx.execute(
                        "DELETE FROM entities WHERE video_id = ?1 AND entity_id = ?2",
                        params![record.video_id, change.id],
                    )?;
                }
            }
        }
        for seq in record.touched_sequences {
            tx.execute(
                "UPDATE entities SET revision = ?1 WHERE video_id = ?2 AND entity_id = ?3",
                params![state.revision, record.video_id, seq],
            )?;
        }
        for (asset_id, rev) in &record.new_asset_versions {
            tx.execute(
                "INSERT OR IGNORE INTO asset_versions (video_id, asset_id, revision, content_hash, byte_length, media_type, body)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    record.video_id,
                    asset_id,
                    rev.revision,
                    rev.content_hash,
                    rev.byte_length as i64,
                    rev.media_type,
                    json(rev)
                ],
            )?;
        }
        for doc in record.new_document_versions {
            tx.execute(
                "INSERT OR IGNORE INTO document_versions (video_id, document_id, revision, content_hash, body)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![record.video_id, doc.document_id, doc.revision, doc.content_hash, doc.body],
            )?;
        }
        let receipt = record.receipt;
        tx.execute(
            "INSERT INTO transactions (transaction_id, video_id, idempotency_key, payload_hash, actor, label, base_revision, revision, event_seq, undo_of, undo_depth, base_label, committed_at, label_ref, base_label_ref)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                receipt.transaction_id,
                record.video_id,
                record.idempotency_key,
                record.payload_hash,
                json(&receipt.actor),
                receipt.label,
                record.base_revision,
                state.revision,
                state.event_seq,
                record.undo_of,
                record.undo_depth,
                record.base_label,
                receipt.committed_at,
                ref_json(receipt.label_ref.as_ref()),
                ref_json(record.base_label_ref)
            ],
        )?;
        tx.execute(
            "INSERT INTO receipts (transaction_id, body) VALUES (?1, ?2)",
            params![receipt.transaction_id, json(receipt)],
        )?;
        tx.execute(
            "INSERT INTO undo_records (transaction_id, changes, undone_by) VALUES (?1, ?2, NULL)",
            params![receipt.transaction_id, json(&record.changes)],
        )?;
        if let Some(original) = record.undo_of {
            let marked = tx.execute(
                "UPDATE undo_records SET undone_by = ?1 WHERE transaction_id = ?2 AND undone_by IS NULL",
                params![receipt.transaction_id, original],
            )?;
            if marked != 1 {
                return Err(ErrorBody::undo_unavailable(original, msg!("engine.alreadyUndone", "This change has already been undone")));
            }
        }
        tx.execute(
            "INSERT INTO outbox (video_id, event_seq, body) VALUES (?1, ?2, ?3)",
            params![record.video_id, state.event_seq, json(record.event)],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// One operator's undo stack (command and protocol spec §8.2, "undo in order"):
    /// undo = the latest forward change or redo that has not been undone; redo = the latest undo after the latest forward change that has not been redone.
    /// It considers only this operator's own transactions: a user's undo does not erase an agent's changes.
    pub fn undo_steps(&self, video_id: &str, actor: &str) -> EngineResult<(Option<UndoStep>, Option<UndoStep>)> {
        let step = |sql: &str| -> EngineResult<Option<UndoStep>> {
            Ok(self
                .conn
                .query_row(
                    &sql.replace("{base_label_ref}", self.ref_column("t.base_label_ref")),
                    params![video_id, actor],
                    |r| {
                        Ok(UndoStep {
                            transaction_id: r.get(0)?,
                            label: r.get(1)?,
                            label_ref: parse_ref(r.get(2)?),
                        })
                    },
                )
                .optional()?)
        };
        let undo = step(
            "SELECT t.transaction_id, t.base_label, {base_label_ref} FROM transactions t JOIN undo_records u ON u.transaction_id = t.transaction_id
             WHERE t.video_id = ?1 AND t.actor = ?2 AND t.undo_depth % 2 = 0 AND u.undone_by IS NULL AND u.changes != '[]'
             ORDER BY t.revision DESC LIMIT 1",
        )?;
        let redo = step(
            "SELECT t.transaction_id, t.base_label, {base_label_ref} FROM transactions t JOIN undo_records u ON u.transaction_id = t.transaction_id
             WHERE t.video_id = ?1 AND t.actor = ?2 AND t.undo_depth % 2 = 1 AND u.undone_by IS NULL
               AND t.revision > (SELECT COALESCE(MAX(f.revision), 0) FROM transactions f JOIN undo_records fu ON fu.transaction_id = f.transaction_id
                                 WHERE f.video_id = ?1 AND f.actor = ?2 AND f.undo_depth = 0 AND fu.changes != '[]')
             ORDER BY t.revision DESC LIMIT 1",
        )?;
        Ok((undo, redo))
    }

    /// All content digests mentioned in the database (the hex after `sha256:`), for the GC of `blobs/` to decide references ([`crate::gc`]).
    ///
    /// Err on the side of more: every version of an asset (not only the current one) and code bundle versions, plus the digests appearing in current entities and in undo record bodies.
    /// Not filtered by storage mode: when `collectAssets` collects a linked asset it produces no new version, and the row in `asset_versions` still says `linked`; the real storage mode exists only in entities and undo records. Extra digests collected (linked assets, documents) have no matching entry in `blobs/`, which does not affect the result.
    /// Not filtered by videoId: a video whose identity was changed when it claimed a project has only this one video in the database.
    pub fn referenced_content_hashes(&self) -> EngineResult<std::collections::HashSet<String>> {
        let mut hashes = std::collections::HashSet::new();
        for sql in [
            "SELECT content_hash FROM asset_versions",
            "SELECT content_hash FROM bundle_versions",
            "SELECT body FROM asset_versions",
            "SELECT body FROM bundle_versions",
            "SELECT body FROM entities",
            "SELECT changes FROM undo_records",
        ] {
            let mut stmt = self.conn.prepare(sql)?;
            let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
            for text in rows {
                crate::gc::collect_hashes(&text?, &mut hashes);
            }
        }
        Ok(hashes)
    }

    /// The video's id (the `videos` table has only one row).
    pub fn video_id(&self) -> EngineResult<Id> {
        self.conn
            .query_row("SELECT id FROM videos LIMIT 1", [], |r| r.get(0))
            .optional()?
            .ok_or_else(|| ErrorBody::unsupported_video(msg!("engine.videoRecordMissing", "The video record is missing")))
    }

    /// The project the video belongs to; empty if it has not been claimed yet.
    pub fn project_id(&self) -> EngineResult<Option<Id>> {
        Ok(self
            .conn
            .query_row("SELECT value FROM meta WHERE key = ?1", [META_PROJECT_ID], |r| r.get(0))
            .optional()?)
    }

    /// The videoIds this video has used before, oldest first (one is appended each time it is treated as a copy and given a new identity).
    pub fn previous_video_ids(&self) -> EngineResult<Vec<Id>> {
        let text: Option<String> = self
            .conn
            .query_row("SELECT value FROM meta WHERE key = ?1", [META_PREVIOUS_VIDEO_IDS], |r| r.get(0))
            .optional()?;
        match text {
            None => Ok(Vec::new()),
            Some(text) => serde_json::from_str(&text).map_err(|e| ErrorBody::storage(msg!(
                "engine.previousVideoIdsCorrupt",
                "previousVideoIds is corrupt: {error}",
                error = e.to_string()
            ))),
        }
    }

    /// Claim the owning project (the caller holds the write lock). If there is no owning project, record the one passed in; if it is the same, do nothing;
    /// if it is different, switch the video to `new_video_id`: the videoId in all tables, the video entity's own id, and the JSON that references it in receipts, events and undo records are all rewritten together. Revision numbers, event sequence numbers, the owner generation and history are unchanged. It all happens in one SQLite transaction, so after a crash either all of it is done or none of it is.
    pub fn claim_project(&mut self, video_id: &str, project_id: &str, new_video_id: &str) -> EngineResult<ProjectClaim> {
        if project_id.is_empty() || project_id.chars().count() > 128 {
            return Err(ErrorBody::invalid_operation(msg!("engine.projectIdLength", "projectId must be 1–128 characters")));
        }
        let tx = self.conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let current: Option<String> = tx
            .query_row("SELECT value FROM meta WHERE key = ?1", [META_PROJECT_ID], |r| r.get(0))
            .optional()?;
        let outcome = match current.as_deref() {
            None => ProjectClaim::Adopted,
            Some(existing) if existing == project_id => return Ok(ProjectClaim::Unchanged),
            Some(_) => {
                let mut previous: Vec<Id> = match tx
                    .query_row("SELECT value FROM meta WHERE key = ?1", [META_PREVIOUS_VIDEO_IDS], |r| {
                        r.get::<_, String>(0)
                    })
                    .optional()?
                {
                    None => Vec::new(),
                    Some(text) => serde_json::from_str(&text).map_err(|e| ErrorBody::storage(msg!(
                "engine.previousVideoIdsCorrupt",
                "previousVideoIds is corrupt: {error}",
                error = e.to_string()
            )))?,
                };
                previous.push(video_id.to_string());
                let quoted = |id: &str| format!("\"{id}\"");
                let (old, new) = (quoted(video_id), quoted(new_video_id));
                let renamed = tx.execute("UPDATE videos SET id = ?1 WHERE id = ?2", params![new_video_id, video_id])?;
                if renamed != 1 {
                    return Err(ErrorBody::storage(msg!("engine.videoIdMismatch", "The video record does not match videoId")));
                }
                for table in [
                    "entities",
                    "document_versions",
                    "asset_versions",
                    "bundle_versions",
                    "dependency_edges",
                    "transactions",
                    "outbox",
                ] {
                    tx.execute(
                        &format!("UPDATE {table} SET video_id = ?1 WHERE video_id = ?2"),
                        params![new_video_id, video_id],
                    )?;
                }
                // The video itself is also an entity, and its entity id is the videoId; when read, `state.id` is taken from it.
                tx.execute(
                    "UPDATE entities SET entity_id = ?1 WHERE entity_id = ?2",
                    params![new_video_id, video_id],
                )?;
                tx.execute(
                    "UPDATE entities SET parent_id = ?1 WHERE parent_id = ?2",
                    params![new_video_id, video_id],
                )?;
                // The places in stored JSON that reference the videoId (the `videoId` of receipts and events, and the `id` of the video entity in undo records). Quotes inside JSON strings are escaped, so a quoted id only matches the real value. Document bodies are user content and are not touched.
                for (table, column) in [
                    ("entities", "body"),
                    ("receipts", "body"),
                    ("outbox", "body"),
                    ("undo_records", "changes"),
                ] {
                    tx.execute(
                        &format!("UPDATE {table} SET {column} = replace({column}, ?1, ?2) WHERE instr({column}, ?1) > 0"),
                        params![old, new],
                    )?;
                }
                tx.execute(
                    "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
                    params![META_PREVIOUS_VIDEO_IDS, json(&previous)],
                )?;
                ProjectClaim::Reassigned {
                    previous_video_id: video_id.to_string(),
                    video_id: new_video_id.to_string(),
                }
            }
        };
        tx.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
            params![META_PROJECT_ID, project_id],
        )?;
        tx.commit()?;
        Ok(outcome)
    }

    /// Events in the outbox after `after`, in sequence-number order (for resending after a disconnect and for crash recovery).
    pub fn events_after(&self, video_id: &str, after: i64, limit: i64) -> EngineResult<Vec<VideoEvent>> {
        let mut stmt = self
            .conn
            .prepare("SELECT body FROM outbox WHERE video_id = ?1 AND event_seq > ?2 ORDER BY event_seq LIMIT ?3")?;
        let rows = stmt.query_map(params![video_id, after, limit], |r| r.get::<_, String>(0))?;
        rows.map(|row| serde_json::from_str(&row?).map_err(|e| ErrorBody::storage(msg!("engine.eventCorrupt", "The event is corrupt: {error}", error = e.to_string()))))
            .collect()
    }

    pub fn history(&self, video_id: &str, limit: i64) -> EngineResult<Vec<HistoryEntry>> {
        let mut stmt = self.conn.prepare(&format!(
            "SELECT t.transaction_id, t.idempotency_key, t.label, t.actor, t.revision, t.committed_at, t.undo_of, u.undone_by, u.changes, t.undo_depth, {}
             FROM transactions t LEFT JOIN undo_records u ON u.transaction_id = t.transaction_id
             WHERE t.video_id = ?1 ORDER BY t.revision DESC LIMIT ?2",
            self.ref_column("t.label_ref")
        ))?;
        let rows = stmt.query_map(params![video_id, limit], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, Option<String>>(7)?,
                r.get::<_, Option<String>>(8)?,
                r.get::<_, i64>(9)?,
                r.get::<_, Option<String>>(10)?,
            ))
        })?;
        rows.map(|row| {
            let (transaction_id, command_id, label, actor, revision, committed_at, undo_of, undone_by, changes, undo_depth, label_ref) =
                row?;
            let has_changes = changes.is_some_and(|c| c != "[]");
            Ok(HistoryEntry {
                transaction_id,
                command_id,
                label,
                label_ref: parse_ref(label_ref),
                actor: serde_json::from_str(&actor).map_err(|e| ErrorBody::storage(msg!(
                    "engine.transactionCorrupt",
                    "The transaction record is corrupt: {error}",
                    error = e.to_string()
                )))?,
                video_revision: revision.to_string(),
                committed_at,
                undo_of,
                undo_available: undone_by.is_none() && has_changes,
                undone_by,
                undo_depth,
            })
        })
        .collect()
    }
}

/// The version gate (video format spec §1.4): only the current version is accepted. Videos at versions 1–2 use the old element model; no compatibility is kept for them, so opening is refused with the reason given, without rewriting. Higher versions were written by a newer CucCut, and are refused too.
pub fn schema_version_supported(version: &str) -> EngineResult<()> {
    match version.parse::<u32>() {
        Ok(v) if v == SCHEMA_VERSION => Ok(()),
        Ok(v @ 1..SCHEMA_VERSION) => Err(ErrorBody::unsupported_video(msg!(
            "engine.schemaRetired",
            "Video format version {version} is no longer supported: from version {current}, picture elements use a new element model and older videos can no longer be opened; import again from the original project",
            version = v,
            current = SCHEMA_VERSION
        ))
        .recovery(msg!("engine.schemaRetiredRecovery", "Import this video again from the original project"))
        .details(serde_json::json!({ "schemaVersion": v, "supported": [SCHEMA_VERSION], "reason": "element-model" }))),
        _ => Err(ErrorBody::unsupported_video(msg!(
            "engine.schemaTooNew",
            "Video format version {version} is not supported; open it with a newer CucCut",
            version
        ))
            .details(serde_json::json!({ "schemaVersion": version, "supported": [SCHEMA_VERSION] }))),
    }
}
