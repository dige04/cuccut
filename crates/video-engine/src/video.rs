//! An open video: the write lock, working state, and transactions (architecture design §2.3, §5.2; command and protocol spec §3, §8).
//!
//! Write order: parse operations → idempotency and version checks → prepare imports outside the transaction → execute on a copy → validate overlaps →
//! compare with the working state to get the change set → atomic commit → replace the working state. If any step fails, the working state and storage both stay unchanged.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use editor_semantics::Rate;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::error::{EngineResult, ErrorBody, MessageRef, Text, kinds, msg};
use crate::ids::{new_id, new_transaction_id, now_rfc3339};
use crate::import::{
    DIRECTORY_MEDIA_TYPE, PreparedAsset, blob_rel_path, hash_file, hash_tree, link_locator, locate_linked, prepare_import, publish_tree,
    publish_verified,
};
use crate::model::*;
use crate::ops::{EditContext, EditOperation, apply_operation, check_overlaps, parse_operation};
use crate::receipt::*;
use crate::state::{EntityChange, EntityKind, Placed, SequenceEntity, VideoState};
use crate::store::{CommitRecord, DocumentBody, ProjectClaim, Store, UndoRecord, UndoStep};
use crate::task_guard::TaskProtection;

pub const DB_FILE: &str = "video.db";
pub const LOCK_FILE: &str = "video.lock";
/// Directory layout before the rename to “video”: `movie.db`, `movie.lock`, format identifier `cuccut.movie`. Upgraded in place once when opened.
const LEGACY_DB_FILE: &str = "movie.db";
const LEGACY_LOCK_FILE: &str = "movie.lock";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpenMode {
    Write,
    ReadOnly,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOptions {
    pub name: String,
    pub fps: Rate,
    pub width: u32,
    pub height: u32,
}

/// An edit transaction (command and protocol spec §3.1). The actor is constructed by the Runtime from the authenticated connection.
#[derive(Clone, Debug, PartialEq)]
pub struct VideoTransaction {
    pub command_id: Id,
    pub expected_revision: Revision,
    pub label: Option<String>,
    /// The message reference the caller gives for the change name; it is used only together with a non-empty `label`. The engine does not recognize its keys and stores it as is (command and protocol spec §3.1).
    pub label_ref: Option<MessageRef>,
    pub operations: Vec<Value>,
    pub actor: Actor,
    pub task_id: Option<Id>,
}

/// The undo target: either the specified transaction, or the next step on this actor's undo stack.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UndoTarget {
    Transaction(Id),
    Undo,
    Redo,
}

/// An undo request: compensates the transaction that is the target.
#[derive(Clone, Debug, PartialEq)]
pub struct UndoRequest {
    pub command_id: Id,
    pub target: UndoTarget,
    pub expected_revision: Option<Revision>,
    pub actor: Actor,
}

/// The one step this actor can currently undo and redo.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub undo: Option<UndoStep>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redo: Option<UndoStep>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Committed {
    pub receipt: TransactionReceipt,
    /// An idempotent replay request produces no new event.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event: Option<VideoEvent>,
}

/// An asset version that cannot be read right now (`videos.assetStatus`).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingAsset {
    pub asset_id: Id,
    pub revision: Revision,
    /// `missing`, `changed`, or `outside-project`.
    pub reason: String,
    /// The path registered for a linked asset; assets imported into the video have none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub volume: Option<String>,
}

pub struct Video {
    dir: PathBuf,
    store: Store,
    state: VideoState,
    generation: i64,
    mode: OpenMode,
    ffprobe: PathBuf,
    // The write lock is not released while held. The kernel releases it when the process exits.
    _lock: Option<WriteLock>,
}

/// The write lock (`flock`) being held. On drop, it is explicitly unlocked before the file is closed.
///
/// `flock` is attached to the open file description, so closing alone releases it only after every fd that refers to it is closed. When another thread in the same process is spawning child processes
/// (ffprobe, ffmpeg; posix_spawn, like fork, first copies the whole fd table, and only closes the close-on-exec fds at exec), the copies held by the child processes keep the lock for a little longer, and reopening right away collides with the `VIDEO_LOCKED` left by itself. An explicit unlock does not wait for these copies.
pub(crate) struct WriteLock(File);

impl Drop for WriteLock {
    fn drop(&mut self) {
        let _ = self.0.unlock();
    }
}

/// Takes the write lock on the video directory (`path` is the lock file), and writes the holder information for other processes to report (acceptance C03).
pub(crate) fn acquire_lock(path: &Path) -> EngineResult<WriteLock> {
    let mut file = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(path)?;
    match file.try_lock() {
        Ok(()) => {
            // Wrapped first: if writing the holder information fails and returns early, the lock is still explicitly unlocked.
            let mut lock = WriteLock(file);
            let holder = json!({ "pid": std::process::id(), "acquiredAt": now_rfc3339() });
            lock.0.set_len(0)?;
            lock.0.seek(SeekFrom::Start(0))?;
            lock.0.write_all(holder.to_string().as_bytes())?;
            lock.0.sync_all()?;
            Ok(lock)
        }
        Err(fs::TryLockError::WouldBlock) => {
            let mut text = String::new();
            let _ = file.read_to_string(&mut text);
            let holder = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
            Err(ErrorBody::video_locked(holder))
        }
        Err(fs::TryLockError::Error(e)) => Err(e.into()),
    }
}

/// A directory in the old layout (only `movie.db`) is upgraded in place: the old lock is held while the database is rewritten, then the database (together with `-wal`, `-shm`) and the lock file are renamed.
/// The rewrite checks the format identifier and the rename checks whether `video.db` exists; both steps can be redone. If it fails midway, the next open continues from there.
fn upgrade_legacy_dir(dir: &Path) -> EngineResult<()> {
    let legacy = dir.join(LEGACY_DB_FILE);
    if dir.join(DB_FILE).exists() || !legacy.is_file() {
        return Ok(());
    }
    let lock = acquire_lock(&dir.join(LEGACY_LOCK_FILE))?;
    Store::upgrade_legacy(&legacy)?;
    for suffix in ["-wal", "-shm", ""] {
        let from = dir.join(format!("{LEGACY_DB_FILE}{suffix}"));
        if from.exists() {
            fs::rename(&from, dir.join(format!("{DB_FILE}{suffix}")))?;
        }
    }
    drop(lock);
    fs::rename(dir.join(LEGACY_LOCK_FILE), dir.join(LOCK_FILE))?;
    Ok(())
}

/// Claims the owning project without opening the video (preprocessing when the Runtime opens a project): takes the write lock, claims, and releases immediately; does not read the working state and does not increment the owner generation.
/// If the video is open elsewhere, returns `VIDEO_LOCKED` and the claim is left for next time.
pub fn claim_project_dir(dir: &Path, project_id: &str) -> EngineResult<(Id, ProjectClaim)> {
    upgrade_legacy_dir(dir)?;
    let db = dir.join(DB_FILE);
    if !db.is_file() {
        return Err(ErrorBody::not_found(kinds::video(), &dir.display().to_string()));
    }
    let _lock = acquire_lock(&dir.join(LOCK_FILE))?;
    let mut store = Store::open(&db, false)?;
    let video_id = store.video_id()?;
    let claim = store.claim_project(&video_id, project_id, &new_id("video"))?;
    let current = match &claim {
        ProjectClaim::Reassigned { video_id, .. } => video_id.clone(),
        _ => video_id,
    };
    Ok((current, claim))
}

/// Recursively sorts by key. Does not depend on whether serde_json's Map keeps insertion order (that depends on a Cargo feature).
fn canonical(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let sorted: BTreeMap<&String, Value> = map.iter().map(|(k, v)| (k, canonical(v))).collect();
            Value::Object(sorted.into_iter().map(|(k, v)| (k.clone(), v)).collect())
        }
        Value::Array(items) => Value::Array(items.iter().map(canonical).collect()),
        other => other.clone(),
    }
}

/// JSON text with sorted keys.
pub fn canonical_json(value: &Value) -> String {
    canonical(value).to_string()
}

pub fn sha256_text(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!("sha256:{hex}")
}

/// The canonical payload digest: sha256 of the key-sorted JSON. Requests that are the same but have a different key order get the same digest (acceptance T06, C05).
pub fn payload_hash(payload: &Value) -> String {
    sha256_text(&canonical_json(payload))
}

/// Where a version of an asset is right now, and whether it can be used.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedAsset {
    pub path: PathBuf,
    pub storage: &'static str,
    pub media_type: String,
    pub byte_length: u64,
    pub name: String,
}

/// One version of a document: the document header and body.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentContent {
    pub document: DocumentRecord,
    pub revision: Revision,
    pub body: Value,
}

fn with_operation_index(mut err: ErrorBody, index: usize) -> ErrorBody {
    match &mut err.details {
        Value::Object(map) => {
            map.entry("operationIndex").or_insert(json!(index));
        }
        Value::Null => err.details = json!({ "operationIndex": index }),
        other => err.details = json!({ "operationIndex": index, "detail": other.clone() }),
    }
    err
}

/// The default change name for an operation (command and protocol spec §3.1): English with a reference; the UI regenerates it in the reader's language.
/// Each branch has one literal `msg!`; the English is checked against the translations by `tools/rust-messages.test.ts`.
fn operation_label(op: &EditOperation) -> Text {
    match op {
        EditOperation::ImportAsset { .. } => msg!("engine.labelImportAssets", "Import assets"),
        EditOperation::CollectAssets { .. } => msg!("engine.labelCollectAssets", "Collect assets"),
        EditOperation::RemoveAssets { .. } => msg!("engine.labelCleanUpAssets", "Clean up assets"),
        EditOperation::RelinkAsset { .. } => msg!("engine.labelRelinkAsset", "Relink asset"),
        EditOperation::InsertItems { .. } | EditOperation::AddItem { .. } => msg!("engine.labelAddClip", "Add clip"),
        EditOperation::PutDocument { .. } => msg!("engine.labelWriteDocument", "Write document"),
        EditOperation::MoveItem { .. } | EditOperation::MoveItems { .. } => msg!("engine.labelMoveClips", "Move clips"),
        EditOperation::TrimItem { .. } => msg!("engine.labelTrimClip", "Trim clip"),
        EditOperation::SplitItem { .. } => msg!("engine.labelSplitClip", "Split clip"),
        EditOperation::JoinItems { .. } => msg!("engine.labelJoinClips", "Join clips"),
        EditOperation::AddCuts { .. } => msg!("engine.labelAddCuts", "Cut out sections"),
        EditOperation::RestoreCut { .. } => msg!("engine.labelRestoreCut", "Restore cut"),
        EditOperation::ProposeCuts { .. } => msg!("engine.labelSuggestCuts", "Suggest cuts"),
        EditOperation::AcceptCutSuggestions { .. } => msg!("engine.labelAcceptSuggestedCuts", "Accept suggested cuts"),
        EditOperation::DeleteItems { .. } => msg!("engine.labelDeleteClips", "Delete clips"),
        EditOperation::RemoveRange { .. } => msg!("engine.labelDeleteTimeRange", "Delete time range"),
        EditOperation::AddTrack { .. } => msg!("engine.labelAddTrack", "Add track"),
        EditOperation::DeleteTrack { .. } => msg!("engine.labelDeleteTrack", "Delete track"),
        EditOperation::UpdateTrack { .. } => msg!("engine.labelEditTrack", "Edit track"),
        EditOperation::ArrangeItem { .. } => msg!("engine.labelChangeStackingOrder", "Change stacking order"),
        EditOperation::MoveTrack { .. } => msg!("engine.labelMoveTrack", "Move track"),
        EditOperation::UpdateItem { .. } => msg!("engine.labelEditClip", "Edit clip"),
        EditOperation::SetTransform { .. } => msg!("engine.labelAdjustPositionAndSize", "Adjust position and size"),
        EditOperation::SetStyle { .. } => msg!("engine.labelEditStyle", "Edit style"),
        EditOperation::SetText { .. } => msg!("engine.labelEditText", "Edit text"),
        EditOperation::SetProps { .. } | EditOperation::SetCodeParameters { .. } => msg!("engine.labelEditParameters", "Edit parameters"),
        EditOperation::SetAnimation { .. } => msg!("engine.labelSetAnimation", "Set animation"),
        EditOperation::SetKeyframes { .. } => msg!("engine.labelSetKeyframes", "Set keyframes"),
        EditOperation::SetTemplate { .. } => msg!("engine.labelSetTemplate", "Set template"),
        EditOperation::ReplaceCodeBundle { .. } => msg!("engine.labelReplaceCodeComposition", "Replace code composition"),
        EditOperation::SetAudioMix { .. } => msg!("engine.labelAdjustAudio", "Adjust audio"),
        EditOperation::SetSpeed { .. } => msg!("engine.labelChangeSpeed", "Change speed"),
        EditOperation::SetCaptionStyle { .. } => msg!("engine.labelChangeCaptionStyle", "Change subtitle style"),
        EditOperation::UpdateSequence { .. } => msg!("engine.labelEditVideoSettings", "Edit video settings"),
        EditOperation::SetTransition { .. } => msg!("engine.labelSetTransition", "Set transition"),
        EditOperation::RemoveTransition { .. } => msg!("engine.labelDeleteTransition", "Delete transition"),
        EditOperation::SetEffects { .. } => msg!("engine.labelEditEffects", "Edit effects"),
        EditOperation::SetChapters { .. } => msg!("engine.labelSetChapters", "Set chapters"),
        EditOperation::UpsertChapter { .. } => msg!("engine.labelEditChapter", "Edit chapter"),
        EditOperation::RemoveChapter { .. } => msg!("engine.labelDeleteChapter", "Delete chapter"),
        EditOperation::SetDucking { .. } => msg!("engine.labelSetDucking", "Set ducking"),
        EditOperation::RemoveDucking { .. } => msg!("engine.labelDeleteDucking", "Delete ducking"),
        EditOperation::CreateCheckpoint { .. } => msg!("engine.labelSaveCheckpoint", "Save checkpoint"),
        EditOperation::RenameVideo { .. } => msg!("engine.labelRenameVideo", "Rename video"),
    }
}

fn default_label(ops: &[EditOperation]) -> Text {
    // “Import and add” counts as one add.
    let kept: Vec<Text> = ops
        .iter()
        .filter(|op| !matches!(op, EditOperation::ImportAsset { .. }))
        .map(operation_label)
        .collect();
    let Some(main) = kept.first().cloned().or_else(|| ops.first().map(operation_label)) else {
        return msg!("engine.labelEdit", "Edit");
    };
    // Kinds are compared by reference, not by text.
    let distinct: BTreeSet<Option<&str>> = kept
        .iter()
        .map(|label| label.message_ref.as_ref().map(|r| r.key.as_str()))
        .collect();
    if distinct.len() > 1 {
        let count = ops.len();
        msg!("engine.labelMoreChanges", "{main} and more ({count} changes)", main, count)
    } else {
        main
    }
}

impl Video {
    /// Creates a video in an empty (or non-existent) directory: one root sequence, with the V1 and A1 tracks.
    pub fn create(dir: &Path, options: &CreateOptions, ffprobe: &Path) -> EngineResult<Video> {
        options.fps.validate("fps")?;
        if options.width == 0 || options.height == 0 || options.width > 16384 || options.height > 16384 {
            return Err(ErrorBody::invalid_operation(msg!("engine.canvasSizeRange", "The canvas size must be between 1 and 16384")));
        }
        let name = options.name.trim();
        if name.is_empty() || name.chars().count() > 200 {
            return Err(ErrorBody::invalid_operation(msg!("engine.videoNameLength", "The video name must be 1–200 characters")));
        }
        if dir.join(DB_FILE).exists() || dir.join(LEGACY_DB_FILE).exists() {
            return Err(ErrorBody::invalid_operation(msg!("engine.videoExists", "This directory already has a video")).details(json!({ "path": dir })));
        }
        fs::create_dir_all(dir.join("blobs").join(".staging"))?;
        let lock = acquire_lock(&dir.join(LOCK_FILE))?;

        let video_id = new_id("video");
        let sequence_id = new_id("seq");
        let mut state = VideoState {
            id: video_id.clone(),
            name: name.to_string(),
            root_sequence_id: sequence_id.clone(),
            revision: 0,
            event_seq: 0,
            sequences: BTreeMap::new(),
            tracks: BTreeMap::new(),
            items: BTreeMap::new(),
            assets: BTreeMap::new(),
            documents: BTreeMap::new(),
            checkpoints: BTreeMap::new(),
            protections: BTreeMap::new(),
            transitions: BTreeMap::new(),
            markers: BTreeMap::new(),
            ducking: BTreeMap::new(),
        };
        // The default name is stored in English with a reference; the UI displays it in the reader's language (video format spec §3.2).
        let root_name = msg!("engine.mainSequence", "Main sequence");
        state.sequences.insert(
            sequence_id.clone(),
            SequenceEntity {
                header: SequenceHeader {
                    name: root_name.text,
                    name_ref: root_name.message_ref,
                    fps: options.fps,
                    canvas: Canvas {
                        width: options.width,
                        height: options.height,
                        working_space: "srgb".into(),
                        background: DEFAULT_CANVAS_BACKGROUND.into(),
                    },
                    duration_policy: DurationPolicy::Derived,
                    animation_bindings: Vec::new(),
                    template: None,
                },
                revision: 0,
            },
        );
        for (order, kind, label, group) in [
            (0, TrackKind::Visual, "V1", SoloGroup::Visual),
            (1, TrackKind::Audio, "A1", SoloGroup::Audio),
        ] {
            let id = new_id("track");
            state.tracks.insert(
                id.clone(),
                Placed {
                    sequence_id: sequence_id.clone(),
                    value: Track {
                        id,
                        order,
                        kind,
                        name: Some(label.into()),
                        locked: false,
                        visible: true,
                        muted: false,
                        solo: Solo { enabled: false, group },
                    },
                },
            );
        }
        let mut store = Store::create(&dir.join(DB_FILE), &state, &now_rfc3339())?;
        let generation = store.bump_generation(&video_id)?;
        Ok(Video {
            dir: dir.to_path_buf(),
            store,
            state,
            generation,
            mode: OpenMode::Write,
            ffprobe: ffprobe.to_path_buf(),
            _lock: Some(lock),
        })
    }

    pub fn open(dir: &Path, mode: OpenMode, ffprobe: &Path) -> EngineResult<Video> {
        upgrade_legacy_dir(dir)?;
        let db = dir.join(DB_FILE);
        if !db.is_file() {
            return Err(ErrorBody::not_found(kinds::video(), &dir.display().to_string()));
        }
        let lock = match mode {
            OpenMode::Write => Some(acquire_lock(&dir.join(LOCK_FILE))?),
            OpenMode::ReadOnly => None,
        };
        let mut store = Store::open(&db, mode == OpenMode::ReadOnly)?;
        let (state, mut generation) = store.load()?;
        if mode == OpenMode::Write {
            // Takes write permission: the owner generation is incremented, so even if an old writer is still alive, its conditional commits will fail.
            generation = store.bump_generation(&state.id)?;
            fs::create_dir_all(dir.join("blobs").join(".staging"))?;
        }
        Ok(Video {
            dir: dir.to_path_buf(),
            store,
            state,
            generation,
            mode,
            ffprobe: ffprobe.to_path_buf(),
            _lock: lock,
        })
    }

    /// Claims the owning project (architecture design §5.1): the Runtime passes the project's id when it opens or creates a video in a project.
    /// If the video belongs to another project, it is replaced with a new videoId (a copy); the content, revision number, and history are unchanged. A read-only open cannot claim.
    pub fn claim_project(&mut self, project_id: &str) -> EngineResult<ProjectClaim> {
        if self.mode != OpenMode::Write {
            return Err(ErrorBody::invalid_operation(msg!(
                "engine.claimReadOnly",
                "A video opened read-only cannot claim a project"
            )));
        }
        let claim = self.store.claim_project(&self.state.id, project_id, &new_id("video"))?;
        if let ProjectClaim::Reassigned { video_id, .. } = &claim {
            self.state.id = video_id.clone();
        }
        Ok(claim)
    }

    /// The project the video belongs to; empty if it has not been claimed yet.
    pub fn project_id(&self) -> EngineResult<Option<Id>> {
        self.store.project_id()
    }

    /// The videoIds this video has used before (the origin of identifier changes), oldest first.
    pub fn previous_video_ids(&self) -> EngineResult<Vec<Id>> {
        self.store.previous_video_ids()
    }

    pub fn id(&self) -> &str {
        &self.state.id
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn mode(&self) -> OpenMode {
        self.mode
    }

    pub fn state(&self) -> &VideoState {
        &self.state
    }

    pub fn revision(&self) -> String {
        self.state.revision.to_string()
    }

    pub fn event_seq(&self) -> i64 {
        self.state.event_seq
    }

    pub fn snapshot(&self) -> VideoSnapshot {
        self.state.snapshot()
    }

    pub fn history(&self, limit: i64) -> EngineResult<Vec<HistoryEntry>> {
        self.store.history(&self.state.id, limit.clamp(1, 500))
    }

    pub fn events_after(&self, after: i64, limit: i64) -> EngineResult<Vec<VideoEvent>> {
        self.store.events_after(&self.state.id, after, limit.clamp(1, 1000))
    }

    pub fn undo_state(&self, actor: &Actor) -> EngineResult<UndoState> {
        let actor = serde_json::to_string(actor).expect("能序列化");
        let (undo, redo) = self.store.undo_steps(&self.state.id, &actor)?;
        Ok(UndoState { undo, redo })
    }

    /// Finds an already-committed receipt by commandId (when the response was lost in transit).
    pub fn find_receipt(&self, command_id: &str) -> EngineResult<Option<TransactionReceipt>> {
        Ok(self.store.find_by_key(&self.state.id, command_id)?.map(|(_, receipt)| receipt))
    }

    /// Where the bytes of an asset's version are right now: managed ones are in the video directory's `blobs/`, linked ones are at their location.
    /// If a linked file is gone, or its length is no longer the registered length, it is reported as `ASSET_MISSING`; other bytes are not substituted for it.
    pub fn resolve_asset(&self, asset_id: &str, revision: Option<&str>) -> EngineResult<ResolvedAsset> {
        let asset = self
            .state
            .assets
            .get(asset_id)
            .ok_or_else(|| ErrorBody::not_found(kinds::asset(), asset_id))?;
        let rev = revision.unwrap_or(&asset.current_revision);
        let record = asset
            .revisions
            .get(rev)
            .ok_or_else(|| ErrorBody::asset_missing(
                asset_id,
                msg!("engine.assetRevisionMissing", "The asset has no revision {revision}", revision = rev),
            ))?;
        let is_tree = record.media_type == DIRECTORY_MEDIA_TYPE;
        let (path, storage) = match &record.storage {
            AssetStorage::Managed => {
                let path = self.dir.join(blob_rel_path(&record.content_hash, &record.media_type));
                let present = if is_tree { path.is_dir() } else { path.is_file() };
                if !present {
                    return Err(ErrorBody::asset_missing(
                        asset_id,
                        msg!("engine.managedFileMissing", "The asset file is not in the video directory"),
                    ).details(json!({ "reason": "missing" })));
                }
                (path, "managed")
            }
            AssetStorage::Linked { locator, .. } => {
                let path = locate_linked(&self.dir, asset_id, &locator.path)?;
                let meta = fs::metadata(&path).map_err(|_| {
                    ErrorBody::asset_missing(
                        asset_id,
                        msg!("engine.linkedAssetMoved", "The linked asset is not at its original location"),
                    ).details(json!({
                        "path": locator.path, "volume": locator.volume, "reason": "missing",
                    }))
                })?;
                if !is_tree && (!meta.is_file() || meta.len() != record.byte_length) {
                    return Err(ErrorBody::asset_missing(
                        asset_id,
                        msg!("engine.linkedAssetChanged", "The linked asset is no longer the file that was linked"),
                    ).details(json!({
                        "path": locator.path, "reason": "changed", "expectedByteLength": record.byte_length, "actualByteLength": meta.len(),
                    })));
                }
                if is_tree && !meta.is_dir() {
                    return Err(ErrorBody::asset_missing(
                        asset_id,
                        msg!(
                            "engine.linkedBundleMoved",
                            "The linked code bundle directory is not at its original location"
                        ),
                    ).details(json!({
                        "path": locator.path, "volume": locator.volume, "reason": "missing",
                    })));
                }
                (path, "linked")
            }
        };
        Ok(ResolvedAsset {
            path,
            storage,
            media_type: record.media_type.clone(),
            byte_length: record.byte_length,
            name: asset.name.clone(),
        })
    }

    /// The location of an asset version's bytes.
    pub fn blob_path(&self, asset_id: &str, revision: Option<&str>) -> EngineResult<PathBuf> {
        Ok(self.resolve_asset(asset_id, revision)?.path)
    }

    /// Asset versions that cannot be read right now (`videos.assetStatus` in command and protocol spec §4.1): each asset's current version, plus the versions that instances reference.
    /// The reasons are the same as `details.reason` of `ASSET_MISSING`: `missing` (gone), `changed` (no longer the file as registered),
    /// and `outside-project` (the relative path leaves the project directory). It only checks whether the file exists and whether its length matches; it does not recompute the digest.
    pub fn missing_assets(&self) -> Vec<MissingAsset> {
        let mut wanted: BTreeSet<(&str, &str)> = self
            .state
            .assets
            .iter()
            .map(|(id, asset)| (id.as_str(), asset.current_revision.as_str()))
            .collect();
        for item in self.state.items.values() {
            wanted.extend(item.value.asset_refs().map(|r| (r.id.as_str(), r.revision.as_str())));
        }
        wanted
            .into_iter()
            .filter_map(|(asset_id, revision)| {
                let err = self.resolve_asset(asset_id, Some(revision)).err()?;
                let record = self.state.assets.get(asset_id).and_then(|a| a.revisions.get(revision));
                let locator = record.and_then(|r| match &r.storage {
                    AssetStorage::Linked { locator, .. } => Some(locator),
                    AssetStorage::Managed => None,
                });
                Some(MissingAsset {
                    asset_id: asset_id.to_string(),
                    revision: revision.to_string(),
                    reason: err.details["reason"].as_str().unwrap_or("missing").to_string(),
                    path: locator.map(|l| l.path.clone()),
                    volume: locator.and_then(|l| l.volume.clone()),
                })
            })
            .collect()
    }

    /// Assets with no references (`videos.unusedAssets`, `removeAssets` in command and protocol spec §4.2). For how references are judged, see [`crate::asset_usage`].
    pub fn unused_assets(&self) -> Vec<crate::asset_usage::UnusedAsset> {
        crate::asset_usage::unused_assets(&self.state)
    }

    /// Cleans up the video directory's `blobs/` ([`crate::gc`]): deletes the blobs that no record in the library mentions, and the staging leftovers older than `staging_grace`.
    /// Only available in write mode: the write lock guarantees that no other writer is publishing into `blobs/`. When a frozen task lease is held, or during export or portable package import, the caller decides not to call it.
    /// If reading the reference set fails, it reports an error and deletes nothing; if an individual entry cannot be deleted, that is only recorded in the receipt.
    pub fn gc_blobs(&self, staging_grace: std::time::Duration) -> EngineResult<crate::gc::BlobGcReport> {
        if self.mode != OpenMode::Write {
            return Err(ErrorBody::read_only());
        }
        let referenced = self.store.referenced_content_hashes()?;
        Ok(crate::gc::gc_blob_dir(
            &self.dir,
            &referenced,
            staging_grace,
            std::time::SystemTime::now(),
        ))
    }

    /// The body text stored for a document version, kept exactly as is: the digest is computed from it (a portable package takes it in as is, video format spec §8).
    pub fn document_text(&self, document_id: &str, revision: &str) -> EngineResult<String> {
        self.store
            .document_body(&self.state.id, document_id, revision)?
            .ok_or_else(|| ErrorBody::storage(msg!(
                "engine.documentRevisionNoBody",
                "Revision {revision} of document {id} has no body",
                revision,
                id = document_id
            )))
    }

    /// Reads a document's body. If no version is given, the current version is read.
    pub fn document(&self, document_id: &str, revision: Option<&str>) -> EngineResult<DocumentContent> {
        let record = self
            .state
            .documents
            .get(document_id)
            .ok_or_else(|| ErrorBody::not_found(kinds::document(), document_id))?;
        let rev = revision.unwrap_or(&record.current_revision);
        if !record.revisions.contains_key(rev) {
            return Err(ErrorBody::not_found(kinds::document_revision(), &format!("{document_id}@{rev}")));
        }
        let text = self
            .store
            .document_body(&self.state.id, document_id, rev)?
            .ok_or_else(|| ErrorBody::storage(msg!(
                "engine.documentRevisionNoBody",
                "Revision {revision} of document {id} has no body",
                revision = rev,
                id = document_id
            )))?;
        let body = serde_json::from_str(&text).map_err(|e| ErrorBody::storage(msg!(
            "engine.documentCorrupt",
            "The document body is corrupt: {error}",
            error = e.to_string()
        )))?;
        Ok(DocumentContent {
            document: record.clone(),
            revision: rev.to_string(),
            body,
        })
    }

    /// The body of a document version; `None` if the document or the version does not exist.
    fn document_body_if_present(&self, document_id: &str, revision: &str) -> EngineResult<Option<Value>> {
        match self.document(document_id, Some(revision)) {
            Ok(content) => Ok(Some(content.body)),
            Err(error) if error.code == "ENTITY_NOT_FOUND" => Ok(None),
            Err(error) => Err(error),
        }
    }

    /// Instances whose anchor cannot be resolved on the current timeline, or that are not at the resolved position (video format spec §3.16). Computed live from the timeline, not persisted.
    pub fn orphaned_anchors(&self) -> EngineResult<Vec<crate::anchors::OrphanedAnchor>> {
        let mut load = |id: &str, revision: &str| self.document_body_if_present(id, revision);
        crate::anchors::orphaned(&self.state, &mut load)
    }

    fn ensure_writable(&self) -> EngineResult<()> {
        match self.mode {
            OpenMode::Write => Ok(()),
            OpenMode::ReadOnly => Err(ErrorBody::read_only()),
        }
    }

    /// Idempotency check: the same key with the same payload returns the original receipt; the same key with a different payload is rejected.
    fn replay(&self, command_id: &str, hash: &str) -> EngineResult<Option<Committed>> {
        match self.store.find_by_key(&self.state.id, command_id)? {
            Some((stored, receipt)) if stored == hash => Ok(Some(Committed { receipt, event: None })),
            Some(_) => Err(ErrorBody::idempotency_conflict(command_id)),
            None => Ok(None),
        }
    }

    fn check_revision(&self, expected: &str) -> EngineResult<()> {
        let current = self.revision();
        if expected != current {
            return Err(ErrorBody::revision_conflict(&self.state.id, expected, &current));
        }
        Ok(())
    }

    pub fn apply(&mut self, tx: &VideoTransaction) -> EngineResult<Committed> {
        self.apply_guarded(tx, &[])
    }

    /// Commit with task protection (architecture design §3.2): changes an agent makes within a task are passed by the Runtime with the task contract's protection scope,
    /// and if they touch it, the whole transaction is rejected with `TASK_PROTECTED`. A replay of the same commandId still returns the original receipt.
    pub fn apply_guarded(&mut self, tx: &VideoTransaction, protections: &[TaskProtection]) -> EngineResult<Committed> {
        self.ensure_writable()?;
        if tx.command_id.trim().is_empty() || tx.command_id.len() > 200 {
            return Err(ErrorBody::invalid_operation(msg!("engine.commandIdInvalid", "commandId is invalid")));
        }
        if tx.operations.is_empty() || tx.operations.len() > 1000 {
            return Err(ErrorBody::invalid_operation(msg!(
                "engine.operationCount",
                "A transaction must have 1–1000 operations"
            )));
        }
        let mut payload = json!({
            "kind": "edit",
            "baseVideoRevision": tx.expected_revision,
            "label": tx.label,
            "operations": tx.operations,
        });
        // References count only when they are supplied: commands without references keep the same digest as before, so retries of commands sent before the upgrade are still recognized as replays.
        if let Some(label_ref) = &tx.label_ref {
            payload["labelRef"] = json!(label_ref);
        }
        let hash = payload_hash(&payload);
        if let Some(replayed) = self.replay(&tx.command_id, &hash)? {
            return Ok(replayed);
        }
        self.check_revision(&tx.expected_revision)?;
        let ops: Vec<EditOperation> = tx
            .operations
            .iter()
            .enumerate()
            .map(|(i, v)| parse_operation(i, v))
            .collect::<EngineResult<_>>()?;

        // Import, collect, and relink are prepared outside the transaction: copying, digesting, and probing do not occupy the write transaction (architecture design §5.2).
        let mut prepared: HashMap<usize, PreparedAsset> = HashMap::new();
        let mut relinked: HashMap<usize, FileLocator> = HashMap::new();
        for (index, op) in ops.iter().enumerate() {
            let outside = |e: ErrorBody| with_operation_index(e, index);
            match op {
                EditOperation::ImportAsset {
                    path, storage, include, ..
                } => {
                    // The storage mode and path rules (by default, files are linked and directories are collected in; relative paths are used only for links) are decided in `prepare_import`.
                    let asset = prepare_import(&self.dir, Path::new(path), &self.ffprobe, *storage, include.as_deref()).map_err(outside)?;
                    prepared.insert(index, asset);
                }
                EditOperation::CollectAssets { asset_ids } => {
                    for id in asset_ids {
                        self.collect(id).map_err(outside)?;
                    }
                }
                EditOperation::RelinkAsset { asset_id, path } => {
                    relinked.insert(index, self.relink(asset_id, path).map_err(outside)?);
                }
                _ => {}
            }
        }

        // When modifying an existing document, first look up the highest version stored in the library: the body of an undone version is still in the library, and the new version must not reuse its number.
        let mut document_revision_floor: HashMap<Id, u64> = HashMap::new();
        // The set of cut points that a cut operation is going to modify is also read outside the transaction (§6.7).
        let mut cut_sets: HashMap<Id, Value> = HashMap::new();
        // The transcript and proposal that a cut proposal reads are also read outside the transaction (§6.2). If they are not found, the operation itself reports the error.
        let mut document_bodies: HashMap<Id, Value> = HashMap::new();
        for op in &ops {
            let mut read_cut_set = |asset_id: &str| -> EngineResult<Option<Id>> {
                let id = crate::cuts::cut_set_document(&self.state, asset_id);
                if let Some(id) = &id
                    && !cut_sets.contains_key(id)
                {
                    cut_sets.insert(id.clone(), self.document(id, None)?.body);
                }
                Ok(id)
            };
            let mut written: Vec<Id> = Vec::new();
            let mut read: Vec<Id> = Vec::new();
            match op {
                EditOperation::PutDocument { document_id: Some(id), .. } => written.push(id.clone()),
                EditOperation::AddCuts { asset_id, .. } | EditOperation::RestoreCut { asset_id, .. } => {
                    written.extend(read_cut_set(asset_id)?);
                }
                EditOperation::ProposeCuts {
                    asset_id,
                    speech_document_id,
                    ..
                } => {
                    read_cut_set(asset_id)?;
                    read.extend(crate::proposals::speech_document(&self.state, asset_id, speech_document_id.as_deref()).ok());
                    written.extend(crate::proposals::proposal_document(&self.state, asset_id));
                }
                EditOperation::AcceptCutSuggestions { proposal_id, .. } => {
                    if let Some(asset_id) = self.state.documents.get(proposal_id).and_then(|d| d.source_asset_id.clone()) {
                        written.extend(read_cut_set(&asset_id)?);
                        read.push(proposal_id.clone());
                        written.push(proposal_id.clone());
                    }
                }
                _ => {}
            }
            for id in read {
                if !document_bodies.contains_key(&id) {
                    document_bodies.insert(id.clone(), self.document(&id, None)?.body);
                }
            }
            for id in written {
                if let std::collections::hash_map::Entry::Vacant(slot) = document_revision_floor.entry(id) {
                    let floor = self.store.max_document_revision(&self.state.id, slot.key())?;
                    slot.insert(floor);
                }
            }
        }

        let transaction_id = new_transaction_id();
        let now = now_rfc3339();
        let mut next = self.state.clone();
        let mut ctx = EditContext {
            transaction_id: &transaction_id,
            now: &now,
            base_revision: self.revision(),
            prepared: &prepared,
            refs: HashMap::new(),
            time_resolution: Vec::new(),
            lineage: BTreeMap::new(),
            reused_assets: Vec::new(),
            document_refs: HashMap::new(),
            track_refs: HashMap::new(),
            documents: Vec::new(),
            document_revision_floor: &document_revision_floor,
            relinked: &relinked,
            actor: &tx.actor,
            cut_sets: &cut_sets,
            document_bodies: &document_bodies,
            cut_impact: Default::default(),
            code_edits: Vec::new(),
            removed_tracks: Vec::new(),
            removed_assets: Vec::new(),
        };
        for (index, op) in ops.iter().enumerate() {
            apply_operation(&mut next, index, op, &mut ctx).map_err(|e| with_operation_index(e, index))?;
        }
        // Item-local followers are recomputed from the target's changes in this transaction; those whose target is gone are deleted too (video format spec §3.16).
        let removed_with_target = crate::item_local::settle(&self.state, &mut next, &mut ctx)?;
        // Semantic anchors are re-evaluated against the final timeline and placed; those that cannot be resolved or cannot fit are listed as orphaned.
        let resolutions = {
            let written = &ctx.documents;
            let mut load = |id: &str, revision: &str| -> EngineResult<Option<Value>> {
                if let Some(d) = written.iter().rev().find(|d| d.document_id == id && d.revision == revision) {
                    return serde_json::from_str(&d.body)
                        .map(Some)
                        .map_err(|e| ErrorBody::storage(msg!(
            "engine.documentCorrupt",
            "The document body is corrupt: {error}",
            error = e.to_string()
        )));
                }
                self.document_body_if_present(id, revision)
            };
            crate::anchors::resolve(&next, &mut load)?
        };
        let orphaned_anchors = crate::anchors::apply(&self.state, &mut next, resolutions, &mut ctx)?;
        // Instances that run to the end of the sequence have their end computed against the final timeline (video format spec §3.16), and then bindings and transitions are checked.
        crate::sequence_end::settle(&mut next)?;
        // After all operations have run, transitions that no longer hold are deleted and reported in the receipt (video format spec §3.9).
        crate::elements::prune_bindings(&mut next);
        let transition_changes = crate::transitions::reconcile_transitions(&self.state, &mut next)?;
        // The change name and references given by the caller are stored as they are; only when none is given does the engine name the change (command and protocol spec §3.1).
        let label = match &tx.label {
            Some(l) if !l.trim().is_empty() => Text {
                text: l.trim().chars().take(200).collect(),
                message_ref: tx.label_ref.clone(),
            },
            _ => default_label(&ops),
        };
        let time_resolution = std::mem::take(&mut ctx.time_resolution);
        let lineage = std::mem::take(&mut ctx.lineage);
        let reused = std::mem::take(&mut ctx.reused_assets);
        let documents = std::mem::take(&mut ctx.documents);
        let cut_impact = std::mem::take(&mut ctx.cut_impact);
        let code_edits = std::mem::take(&mut ctx.code_edits);
        let removed_tracks = std::mem::take(&mut ctx.removed_tracks);
        let removed_assets = std::mem::take(&mut ctx.removed_assets);
        let refs: BTreeMap<String, Id> = ctx
            .refs
            .drain()
            .chain(ctx.document_refs.drain())
            .chain(ctx.track_refs.drain())
            .collect();
        self.commit(
            next,
            CommitInput {
                transaction_id,
                command_id: tx.command_id.clone(),
                payload_hash: hash,
                base_label: label.clone(),
                undo_depth: 0,
                label,
                actor: tx.actor.clone(),
                task_id: tx.task_id.clone(),
                protections: protections.to_vec(),
                undo_of: None,
                now,
                time_resolution,
                lineage,
                extra_preserved: reused,
                documents,
                refs,
                removed_transitions: transition_changes.removed,
                shortened_transitions: transition_changes.shortened,
                cut_impact,
                orphaned_anchors,
                removed_with_target,
                code_edits,
                removed_tracks,
                removed_assets,
            },
        )
    }

    /// Copies the bytes of a linked asset's current version into `blobs/` and checks the digest. Nothing is done for one that is already managed.
    fn collect(&self, asset_id: &str) -> EngineResult<()> {
        let asset = self
            .state
            .assets
            .get(asset_id)
            .ok_or_else(|| ErrorBody::not_found(kinds::asset(), asset_id))?;
        let record = &asset.revisions[&asset.current_revision];
        let AssetStorage::Linked { locator, .. } = &record.storage else {
            return Ok(());
        };
        let source = locate_linked(&self.dir, asset_id, &locator.path)?;
        if record.media_type == DIRECTORY_MEDIA_TYPE {
            let include = record.tree.as_ref().and_then(|t| t.include.as_deref());
            let (hash, _, _) = hash_tree(&source, include)?;
            if hash != record.content_hash {
                return Err(ErrorBody::asset_missing(
                    asset_id,
                    msg!(
                        "engine.linkedBundleChanged",
                        "The code bundle at the original location no longer matches what was linked"
                    ),
                ));
            }
            publish_tree(&self.dir, &source, include, &record.content_hash)
        } else {
            publish_verified(&self.dir, &source, &record.media_type, &record.content_hash).map_err(|e| e.entities([asset_id]))
        }
    }

    /// Checks that the content at the new location matches the asset's current version, and returns the new location. The location is normalized the same way as at import:
    /// a path inside the project directory is recorded relative to the video directory; a path outside the project is recorded as absolute (video format spec §4.2).
    fn relink(&self, asset_id: &str, path: &str) -> EngineResult<FileLocator> {
        let asset = self
            .state
            .assets
            .get(asset_id)
            .ok_or_else(|| ErrorBody::not_found(kinds::asset(), asset_id))?;
        let record = &asset.revisions[&asset.current_revision];
        if !matches!(record.storage, AssetStorage::Linked { .. }) {
            return Err(ErrorBody::invalid_operation(msg!("engine.relinkNotLinked", "Only linked assets can be relinked")).entities([asset_id]));
        }
        let (locator, resolved) = link_locator(&self.dir, Path::new(path));
        let hash = if record.media_type == DIRECTORY_MEDIA_TYPE {
            hash_tree(&resolved, record.tree.as_ref().and_then(|t| t.include.as_deref()))?.0
        } else {
            hash_file(&resolved)?.0
        };
        if hash != record.content_hash {
            // New bytes appearing at the same path are a new version, not a relink (video format spec §4.2).
            return Err(ErrorBody::invalid_operation(msg!(
                "engine.relinkContentMismatch",
                "The content at the new location does not match the asset; replace the asset revision to change content"
            )).entities([asset_id]));
        }
        Ok(locator)
    }

    /// Undo is a compensating transaction (command and protocol spec §8.3): the target objects must still be in the state they were in after that transaction,
    /// and only then are they restored to their earlier state. Objects changed by someone else afterwards are not overwritten; `UNDO_CONFLICT` is returned.
    pub fn undo(&mut self, request: &UndoRequest) -> EngineResult<Committed> {
        self.undo_guarded(request, &[])
    }

    /// Undo and redo with task protection: the compensating transaction likewise must not touch the task's protection scope.
    pub fn undo_guarded(&mut self, request: &UndoRequest, protections: &[TaskProtection]) -> EngineResult<Committed> {
        self.ensure_writable()?;
        let hash = payload_hash(&json!({
            "kind": "undo",
            "baseVideoRevision": request.expected_revision,
            "target": request.target,
        }));
        if let Some(replayed) = self.replay(&request.command_id, &hash)? {
            return Ok(replayed);
        }
        if let Some(expected) = &request.expected_revision {
            self.check_revision(expected)?;
        }
        let target = match &request.target {
            UndoTarget::Transaction(id) => id.clone(),
            UndoTarget::Undo => {
                self.undo_state(&request.actor)?
                    .undo
                    .ok_or_else(|| ErrorBody::undo_unavailable("", msg!("engine.nothingToUndo", "There is no change to undo")))?
                    .transaction_id
            }
            UndoTarget::Redo => {
                self.undo_state(&request.actor)?
                    .redo
                    .ok_or_else(|| ErrorBody::undo_unavailable("", msg!("engine.nothingToRedo", "There is no change to redo")))?
                    .transaction_id
            }
        };
        let UndoRecord {
            changes,
            undone_by,
            undo_depth,
            base_label,
            base_label_ref,
        } = self
            .store
            .undo_record(&target)?
            .ok_or_else(|| ErrorBody::undo_unavailable(&target, msg!("engine.transactionMissing", "There is no such transaction")))?;
        if let Some(by) = undone_by {
            return Err(
                ErrorBody::undo_unavailable(&target, msg!("engine.alreadyUndone", "This change has already been undone")).details(json!({ "transactionId": target, "undoneBy": by }))
            );
        }
        if changes.is_empty() {
            return Err(ErrorBody::undo_unavailable(
                &target,
                msg!("engine.transactionNoChanges", "This transaction has no changes to undo"),
            ));
        }

        let current = self.state.entities();
        let conflicts: Vec<Id> = changes
            .iter()
            .filter(|c| current.get(&c.id).map(|row| &row.body) != c.after.as_ref())
            .map(|c| c.id.clone())
            .collect();
        if !conflicts.is_empty() {
            return Err(ErrorBody::undo_conflict(
                conflicts,
                msg!("engine.undoChangedSince", "What you are undoing has been changed since"),
            ));
        }
        let mut next = self.state.clone();
        for change in &changes {
            next.put(&change.id, change.kind, change.parent.as_deref(), change.before.clone())?;
        }
        // If the restore conflicts with someone else's later change, it is also reported as an undo conflict, so callers only handle one kind of error.
        check_references(&next).map_err(|ids| ErrorBody::undo_conflict(
                ids,
                msg!("engine.undoOrphansItems", "Undoing would leave clips added later without their assets"),
            ))?;
        let touched = VideoState::touched_sequences(&self.state, &next, &VideoState::diff(&self.state, &next));
        for seq in touched.iter().filter(|s| next.sequences.contains_key(*s)) {
            check_overlaps(&next, seq).map_err(|e| ErrorBody::undo_conflict(
                    e.entity_ids,
                    msg!("engine.undoOverlaps", "Restored clips would overlap clips added later"),
                ))?;
        }
        // Undo does not delete transitions along the way: if after the restore some transition no longer holds (a transition added later depends on the undone change), it is reported as an undo conflict.
        let broken = crate::transitions::invalid_transitions(&next)?;
        if !broken.is_empty() {
            return Err(
                ErrorBody::undo_conflict(
                    broken.iter().map(|r| r.id.clone()).collect(),
                    msg!("engine.undoBreaksTransitions", "These transitions no longer hold after undoing"),
                )
                    .details(json!({ "removedTransitions": broken })),
            );
        }

        let depth = undo_depth + 1;
        // The forward change name is passed as a nested parameter: the engine-generated name is expanded in the reader's language; the caller's name is displayed as given.
        let base_label = Text {
            text: base_label,
            message_ref: base_label_ref,
        };
        let label = if depth % 2 == 1 {
            msg!("engine.labelUndo", "Undo: {label}", label = &base_label)
        } else {
            msg!("engine.labelRedo", "Redo: {label}", label = &base_label)
        };
        self.commit(
            next,
            CommitInput {
                transaction_id: new_transaction_id(),
                command_id: request.command_id.clone(),
                payload_hash: hash,
                label,
                base_label,
                undo_depth: depth,
                actor: request.actor.clone(),
                task_id: None,
                protections: protections.to_vec(),
                undo_of: Some(target),
                now: now_rfc3339(),
                time_resolution: Vec::new(),
                lineage: BTreeMap::new(),
                extra_preserved: Vec::new(),
                refs: BTreeMap::new(),
                documents: Vec::new(),
                removed_transitions: Vec::new(),
                shortened_transitions: Vec::new(),
                cut_impact: Default::default(),
                orphaned_anchors: Vec::new(),
                removed_with_target: Vec::new(),
                code_edits: Vec::new(),
                removed_tracks: Vec::new(),
                removed_assets: Vec::new(),
            },
        )
    }

    fn commit(&mut self, mut next: VideoState, input: CommitInput) -> EngineResult<Committed> {
        let changes = VideoState::diff(&self.state, &next);
        crate::task_guard::check(&self.state, &next, &changes, &input.protections)?;
        let touched: Vec<Id> = VideoState::touched_sequences(&self.state, &next, &changes).into_iter().collect();
        for seq in &touched {
            if next.sequences.contains_key(seq) {
                check_overlaps(&next, seq)?;
            }
        }
        let base_revision = self.state.revision;
        next.revision = base_revision + 1;
        next.event_seq = self.state.event_seq + 1;
        for seq in &touched {
            if let Some(entity) = next.sequences.get_mut(seq) {
                entity.revision = next.revision;
            }
        }

        let root = self.state.root_sequence_id.clone();
        let old_duration = self.state.duration_frames(&root).unwrap_or(0);
        let new_duration = next.duration_frames(&next.root_sequence_id).unwrap_or(0);
        let mut created = Vec::new();
        let mut updated = Vec::new();
        let mut deleted = Vec::new();
        for change in &changes {
            match (&change.before, &change.after) {
                (None, Some(_)) => created.push(change.id.clone()),
                (Some(_), Some(_)) => updated.push(change.id.clone()),
                (Some(_), None) => deleted.push(change.id.clone()),
                (None, None) => {}
            }
        }
        let preserved = preserved_instances(&self.state, &next, &changes, input.extra_preserved);
        let new_asset_versions: Vec<(Id, AssetRevision)> = changes
            .iter()
            .filter(|c| c.kind == EntityKind::Asset && c.after.is_some())
            .filter_map(|c| next.assets.get(&c.id))
            .flat_map(|asset| asset.revisions.values().map(|r| (asset.id.clone(), r.clone())))
            .collect();

        let receipt = TransactionReceipt {
            transaction_id: input.transaction_id.clone(),
            command_id: input.command_id.clone(),
            status: "committed".into(),
            video_id: next.id.clone(),
            previous_revision: base_revision.to_string(),
            video_revision: next.revision.to_string(),
            event_seq: next.event_seq.to_string(),
            label: input.label.text.clone(),
            label_ref: input.label.message_ref.clone(),
            actor: input.actor.clone(),
            undo_of: input.undo_of.clone(),
            created_ids: created,
            updated_ids: updated,
            deleted_ids: deleted,
            lineage: input.lineage,
            refs: input.refs,
            impact: Impact {
                old_duration_frames: old_duration,
                new_duration_frames: new_duration,
                translation_units_stale: Vec::new(),
                dubbing_units_stale: Vec::new(),
                orphaned_anchors: input.orphaned_anchors,
                removed_transitions: input.removed_transitions,
                shortened_transitions: input.shortened_transitions,
                removed_by_cuts: input.cut_impact.removed,
                cuts_not_relaid: input.cut_impact.not_relaid,
                removed_with_target: input.removed_with_target,
                code_edits: input.code_edits,
                removed_tracks: input.removed_tracks,
                removed_assets: input.removed_assets,
            },
            time_resolution: input.time_resolution,
            preserved,
            undo: if changes.is_empty() {
                let reason = msg!("engine.undoNoChange", "This transaction did not change the video");
                UndoInfo {
                    available: false,
                    token: None,
                    unavailable_reason: Some(reason.text),
                    unavailable_reason_ref: reason.message_ref,
                }
            } else {
                UndoInfo {
                    available: true,
                    token: Some(input.transaction_id.clone()),
                    unavailable_reason: None,
                    unavailable_reason_ref: None,
                }
            },
            committed_at: input.now,
        };
        let event = VideoEvent {
            video_id: next.id.clone(),
            event_seq: next.event_seq.to_string(),
            video_revision: next.revision.to_string(),
            transaction_id: input.transaction_id,
            changed_ids: changes.iter().map(|c| c.id.clone()).collect(),
            projection: projection(&next, &changes, &touched),
            actor: input.actor,
            label: input.label.text,
            label_ref: input.label.message_ref,
            undo_of: input.undo_of.clone(),
            task_id: input.task_id,
        };
        self.store.commit(&CommitRecord {
            video_id: &next.id.clone(),
            base_revision,
            generation: self.generation,
            state: &next,
            changes: &changes,
            touched_sequences: &touched,
            new_asset_versions,
            new_document_versions: &input.documents,
            idempotency_key: &input.command_id,
            payload_hash: &input.payload_hash,
            receipt: &receipt,
            event: &event,
            undo_of: input.undo_of.as_deref(),
            undo_depth: input.undo_depth,
            base_label: &input.base_label.text,
            base_label_ref: input.base_label.message_ref.as_ref(),
        })?;
        self.state = next;
        Ok(Committed {
            receipt,
            event: Some(event),
        })
    }
}

struct CommitInput {
    transaction_id: Id,
    command_id: Id,
    payload_hash: String,
    label: Text,
    /// The name of the forward change: undo and redo wrap around it.
    base_label: Text,
    undo_depth: i64,
    actor: Actor,
    task_id: Option<Id>,
    /// Task protection (§3.2): checked against the entity changes before commit; for user and system commits it is empty.
    protections: Vec<TaskProtection>,
    undo_of: Option<Id>,
    now: String,
    time_resolution: Vec<editor_semantics::TimeQuantizationReceipt>,
    lineage: BTreeMap<Id, Vec<Id>>,
    extra_preserved: Vec<Id>,
    documents: Vec<DocumentBody>,
    refs: BTreeMap<String, Id>,
    removed_transitions: Vec<RemovedTransition>,
    shortened_transitions: Vec<ShortenedTransition>,
    cut_impact: crate::cuts::CutImpact,
    /// Instances after this transaction whose anchor cannot be resolved or that cannot fit (§3.16).
    orphaned_anchors: Vec<Id>,
    /// Instances deleted along with an `item-local` target (§3.16).
    removed_with_target: Vec<Id>,
    /// The code picture replaced by `replaceCodeBundle` (code bundle spec §3.4).
    code_edits: Vec<crate::receipt::CodeEdit>,
    /// The track deleted by `deleteTrack`.
    removed_tracks: Vec<Id>,
    /// The assets deleted by `removeAssets`.
    removed_assets: Vec<Id>,
}

/// Each instance's referenced assets and documents must exist. Returns the instances that lost their reference.
fn check_references(state: &VideoState) -> Result<(), Vec<Id>> {
    let missing: Vec<Id> = state
        .items
        .values()
        .filter(|i| {
            let asset_gone = i
                .value
                .asset_refs()
                .any(|r| !state.assets.get(&r.id).is_some_and(|a| a.revisions.contains_key(&r.revision)));
            let document_gone = match &i.value {
                TimelineItem::Caption(c) => std::iter::once(&c.document_id)
                    .chain(&c.style_document_id)
                    .any(|d| !state.documents.contains_key(d)),
                _ => false,
            };
            asset_gone || document_gone
        })
        .map(|i| i.value.base().id.clone())
        // Chapter thumbnails must also exist.
        .chain(
            state
                .markers
                .values()
                .filter(|m| {
                    m.value
                        .thumbnail
                        .as_ref()
                        .is_some_and(|r| !state.assets.get(&r.id).is_some_and(|a| a.revisions.contains_key(&r.revision)))
                })
                .map(|m| m.value.id.clone()),
        )
        .collect();
    if missing.is_empty() { Ok(()) } else { Err(missing) }
}

/// Instances that share an asset with a modified instance but have no changes of their own: the receipt states explicitly that they remain unchanged (acceptance T05).
fn preserved_instances(before: &VideoState, after: &VideoState, changes: &[EntityChange], extra: Vec<Id>) -> Vec<Id> {
    let changed: BTreeSet<&str> = changes.iter().map(|c| c.id.as_str()).collect();
    let assets: BTreeSet<&str> = changes
        .iter()
        .filter(|c| c.kind == EntityKind::Item)
        .filter_map(|c| before.items.get(&c.id).or_else(|| after.items.get(&c.id)))
        .flat_map(|i| i.value.asset_refs().map(|r| r.id.as_str()))
        .collect();
    let mut preserved: BTreeSet<Id> = after
        .items
        .values()
        .filter(|i| !changed.contains(i.value.base().id.as_str()) && i.value.asset_refs().any(|r| assets.contains(r.id.as_str())))
        .map(|i| i.value.base().id.clone())
        .collect();
    preserved.extend(extra);
    preserved.into_iter().collect()
}

/// The projection changes in an event: changed entities give their new values, deleted entities give their IDs; the affected sequences get a new head and version.
fn projection(state: &VideoState, changes: &[EntityChange], touched: &[Id]) -> Projection {
    let mut upserts = Vec::new();
    let mut removals = Vec::new();
    let mut sequences_done = BTreeSet::new();
    for change in changes {
        match &change.after {
            Some(body) => {
                let value = if change.kind == EntityKind::Sequence {
                    sequences_done.insert(change.id.clone());
                    sequence_value(state, &change.id).unwrap_or_else(|| body.clone())
                } else {
                    body.clone()
                };
                upserts.push(EntityUpsert {
                    kind: change.kind,
                    id: change.id.clone(),
                    sequence_id: change.parent.clone(),
                    value,
                });
            }
            None => removals.push(EntityRemoval {
                kind: change.kind,
                id: change.id.clone(),
                sequence_id: change.parent.clone(),
            }),
        }
    }
    for seq in touched {
        if sequences_done.contains(seq) {
            continue;
        }
        if let Some(value) = sequence_value(state, seq) {
            upserts.push(EntityUpsert {
                kind: EntityKind::Sequence,
                id: seq.clone(),
                sequence_id: None,
                value,
            });
        }
    }
    Projection { upserts, removals }
}

fn sequence_value(state: &VideoState, id: &str) -> Option<Value> {
    let seq = state.sequences.get(id)?;
    let mut value = serde_json::to_value(&seq.header).ok()?;
    if let Value::Object(map) = &mut value {
        map.insert("id".into(), json!(id));
        map.insert("revision".into(), json!(seq.revision.to_string()));
    }
    Some(value)
}
