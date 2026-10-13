//! Two things the engine does for a portable package (video format spec §8): the relative path where a media asset in the package lives, and building a new video from an already-unpacked package whose manifest has been validated.
//!
//! The package manifest and archive are validated by the Runtime (length and digest of each file, format version, paths not escaping the package). The engine does not trust the manifest: document bodies are recomputed against the registered `contentHash`, asset bytes against the registered digest, and the snapshot is checked by the same rules as at commit (references, overlaps, transitions). Any mismatch is rejected, so a half-built or self-inconsistent video is never created.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use editor_semantics::TIME_CONTRACT_VERSION;
use serde_json::{Value, json};

use crate::error::{EngineResult, ErrorBody, Retryability, Text, kinds, msg};
use crate::ids::{new_id, now_rfc3339};
use crate::import::{DIRECTORY_MEDIA_TYPE, blob_extension, hash_tree, publish_tree, publish_verified};
use crate::model::*;
use crate::ops::check_overlaps;
use crate::state::{Placed, SequenceEntity, VideoState};
use crate::store::{DocumentBody, Store};
use crate::video::{DB_FILE, LOCK_FILE, OpenMode, Video, acquire_lock, sha256_text};

/// The snapshot file in the package.
pub const PACKAGE_SNAPSHOT: &str = "video.snapshot.json";

/// The relative path in the package for the bytes of one asset version: a file is `assets/<sha256>.<ext>`, a directory is `assets/<sha256>/`.
pub fn package_asset_path(content_hash: &str, media_type: &str) -> String {
    let hex = content_hash.strip_prefix("sha256:").unwrap_or(content_hash);
    if media_type == DIRECTORY_MEDIA_TYPE {
        return format!("assets/{hex}");
    }
    format!("assets/{hex}.{}", blob_extension(media_type))
}

/// The relative path in the package for the body of one document version.
pub fn package_document_path(document_id: &str, revision: &str) -> String {
    format!("documents/{document_id}/{revision}.json")
}

fn invalid(message: impl Into<Text>) -> ErrorBody {
    ErrorBody::new("PACKAGE_INVALID", message, Retryability::Never)
}

fn duplicate(id: &str) -> ErrorBody {
    invalid(msg!("engine.packageDuplicateId", "The snapshot has a duplicate entity ID {id}", id))
}

fn mismatch(message: impl Into<Text>, details: Value) -> ErrorBody {
    ErrorBody::new("PACKAGE_DIGEST_MISMATCH", message, Retryability::Never).details(details)
}

/// IDs and versions used as a segment of a path: must not be empty, must not be `.` or `..`, and must not contain a separator.
fn safe_segment(text: &str) -> bool {
    !text.is_empty()
        && text != "."
        && text != ".."
        && text.len() <= 200
        && !text.chars().any(|c| c == '/' || c == '\\' || c == '\0' || c.is_control())
}

/// Build an unpacked package (`package_dir`, containing `video.snapshot.json`, `documents/` and `assets/`) into a new video in `dir`.
/// The new video gets a new videoId; its content, the ID of each entity and its revision numbers are kept from the package. All assets collected in the package are collected into the video (`managed`).
/// `dir` must not exist yet; on failure, the half-built directory is deleted.
pub fn import_package(dir: &Path, package_dir: &Path, project_id: Option<&str>, ffprobe: &Path) -> EngineResult<Video> {
    if dir.exists() {
        return Err(ErrorBody::invalid_operation(msg!("engine.targetExists", "The target directory already exists")).details(json!({ "path": dir })));
    }
    let parent = dir.parent().ok_or_else(|| ErrorBody::invalid_operation(msg!("engine.targetInvalid", "The target directory is invalid")))?;
    if !parent.is_dir() {
        return Err(ErrorBody::not_found(kinds::directory(), &parent.display().to_string()));
    }
    // Read and check the snapshot and documents first, without touching the target directory: if the package is wrong, nothing is built.
    let (state, documents) = read_package(package_dir)?;
    fs::create_dir(dir)?;
    let result = (|| -> EngineResult<Video> {
        fs::create_dir_all(dir.join("blobs").join(".staging"))?;
        let lock = acquire_lock(&dir.join(LOCK_FILE))?;
        publish_assets(dir, package_dir, &state)?;
        let mut store = Store::create(&dir.join(DB_FILE), &state, &now_rfc3339())?;
        store.import_versions(&state, &documents)?;
        drop(store);
        drop(lock);
        let mut video = Video::open(dir, OpenMode::Write, ffprobe)?;
        if let Some(project_id) = project_id {
            video.claim_project(project_id)?;
        }
        Ok(video)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(dir);
    }
    result
}

/// Read the snapshot from the package and turn it into the new video's working state; read and check the body of each document version.
fn read_package(package_dir: &Path) -> EngineResult<(VideoState, Vec<DocumentBody>)> {
    let text = fs::read_to_string(package_dir.join(PACKAGE_SNAPSHOT)).map_err(|e| invalid(msg!(
            "engine.packageNoSnapshot",
            "The package has no readable snapshot: {error}",
            error = e.to_string()
        )))?;
    let raw: Value = serde_json::from_str(&text).map_err(|e| invalid(msg!("engine.snapshotNotJson", "The snapshot is not JSON: {error}", error = e.to_string())))?;
    if raw.get("format").and_then(Value::as_str) != Some(VIDEO_FORMAT) {
        return Err(invalid(msg!("engine.snapshotNotVideo", "The snapshot is not a CucCut video")));
    }
    let schema = raw.get("schemaVersion").and_then(Value::as_u64).unwrap_or(0);
    if schema != u64::from(SCHEMA_VERSION) {
        // Only the current version is accepted (video format spec §1.4): a higher version is not recognized; versions 1–2 use the old element model, and no compatibility is kept.
        let message = if schema > u64::from(SCHEMA_VERSION) {
            msg!(
                "engine.packageSchemaTooNew",
                "Video format version {version} in the package is not supported; open it with a newer CucCut",
                version = schema
            )
        } else {
            msg!(
                "engine.packageSchemaRetired",
                "Video format version {version} in the package is no longer supported: from version {current}, picture elements use a new element model; import again from the original project",
                version = schema,
                current = SCHEMA_VERSION
            )
        };
        return Err(ErrorBody::new("PACKAGE_VERSION_UNSUPPORTED", message, Retryability::Never)
            .details(json!({ "schemaVersion": schema, "supported": [SCHEMA_VERSION] })));
    }
    let contract = raw.get("timeContractVersion").and_then(Value::as_u64).unwrap_or(0);
    if contract != u64::from(TIME_CONTRACT_VERSION) {
        return Err(ErrorBody::new(
            "PACKAGE_VERSION_UNSUPPORTED",
            msg!(
                "engine.packageTimeContract",
                "Time contract version {version} in the package is not supported",
                version = contract
            ),
            Retryability::Never,
        )
        .details(json!({ "timeContractVersion": contract, "supported": TIME_CONTRACT_VERSION })));
    }
    let snapshot: VideoSnapshot = serde_json::from_value(raw).map_err(|e| invalid(msg!("engine.snapshotUnreadable", "The snapshot cannot be read: {error}", error = e.to_string())))?;
    let state = state_from_snapshot(snapshot)?;
    validate(&state)?;
    let mut documents = Vec::new();
    for (id, record) in &state.documents {
        for (revision, version) in &record.revisions {
            if !safe_segment(id) || !safe_segment(revision) {
                return Err(invalid(msg!(
                    "engine.documentPathUnsafe",
                    "Revision {revision} of document {id} cannot be used as a path in the package",
                    revision,
                    id
                )));
            }
            let path = package_dir.join(package_document_path(id, revision));
            let body = fs::read_to_string(&path).map_err(|e| invalid(msg!(
                    "engine.packageDocumentMissing",
                    "The package is missing revision {revision} of document {id}: {error}",
                    revision,
                    id,
                    error = e.to_string()
                )))?;
            let hash = sha256_text(&body);
            if hash != version.content_hash || body.len() as u64 != version.byte_length {
                return Err(mismatch(
                    msg!(
                        "engine.documentDigestMismatch",
                        "Revision {revision} of document {id} does not match its recorded digest",
                        revision,
                        id
                    ),
                    json!({ "documentId": id, "revision": revision, "expected": version.content_hash, "actual": hash }),
                ));
            }
            if !serde_json::from_str::<Value>(&body).is_ok_and(|v| v.is_object()) {
                return Err(invalid(msg!(
                    "engine.documentNotObject",
                    "Revision {revision} of document {id} is not a JSON object",
                    revision,
                    id
                )));
            }
            documents.push(DocumentBody {
                document_id: id.clone(),
                revision: revision.clone(),
                content_hash: version.content_hash.clone(),
                body,
            });
        }
    }
    Ok((state, documents))
}

/// Snapshot → working state (the inverse of `VideoState::snapshot`). The video gets a new ID; revision numbers are kept.
fn state_from_snapshot(snapshot: VideoSnapshot) -> EngineResult<VideoState> {
    let revision: i64 = snapshot
        .revision
        .parse()
        .ok()
        .filter(|r| *r >= 0)
        .ok_or_else(|| invalid(msg!("engine.snapshotRevisionInvalid", "The revision of the snapshot is invalid")))?;
    let mut state = VideoState {
        id: new_id("video"),
        name: snapshot.name,
        root_sequence_id: snapshot.root_sequence_id,
        revision,
        event_seq: 0,
        sequences: BTreeMap::new(),
        tracks: BTreeMap::new(),
        items: BTreeMap::new(),
        transitions: BTreeMap::new(),
        markers: BTreeMap::new(),
        ducking: BTreeMap::new(),
        assets: snapshot.assets,
        documents: snapshot.documents,
        checkpoints: snapshot.checkpoints,
        protections: snapshot.protections,
    };
    for (id, sequence) in snapshot.sequences {
        if id != sequence.id {
            return Err(invalid(msg!("engine.sequenceIdMismatch", "The ID of sequence {id} is inconsistent", id)));
        }
        let seq_revision: i64 = sequence
            .revision
            .parse()
            .ok()
            .filter(|r| (0..=revision).contains(r))
            .ok_or_else(|| invalid(msg!("engine.sequenceRevisionInvalid", "The revision of sequence {id} is invalid", id)))?;
        for track in sequence.tracks {
            let key = track.id.clone();
            let placed = Placed {
                sequence_id: id.clone(),
                value: track,
            };
            if state.tracks.insert(key.clone(), placed).is_some() {
                return Err(duplicate(&key));
            }
        }
        for item in sequence.items {
            let key = item.base().id.clone();
            let placed = Placed {
                sequence_id: id.clone(),
                value: item,
            };
            if state.items.insert(key.clone(), placed).is_some() {
                return Err(duplicate(&key));
            }
        }
        for transition in sequence.transitions {
            let key = transition.id.clone();
            let placed = Placed {
                sequence_id: id.clone(),
                value: transition,
            };
            if state.transitions.insert(key.clone(), placed).is_some() {
                return Err(duplicate(&key));
            }
        }
        for marker in sequence.markers {
            let key = marker.id.clone();
            let placed = Placed {
                sequence_id: id.clone(),
                value: marker,
            };
            if state.markers.insert(key.clone(), placed).is_some() {
                return Err(duplicate(&key));
            }
        }
        for rule in sequence.ducking {
            let key = rule.id.clone();
            let placed = Placed {
                sequence_id: id.clone(),
                value: rule,
            };
            if state.ducking.insert(key.clone(), placed).is_some() {
                return Err(duplicate(&key));
            }
        }
        state.sequences.insert(
            id,
            SequenceEntity {
                header: sequence.header,
                revision: seq_revision,
            },
        );
    }
    Ok(state)
}

/// The rules that hold at commit also hold at import: IDs are unique, all references resolve, no overlaps on the same track, and transition sides hold.
fn validate(state: &VideoState) -> EngineResult<()> {
    if !state.sequences.contains_key(&state.root_sequence_id) {
        return Err(invalid(msg!("engine.rootSequenceMissing", "The root sequence of the snapshot does not exist")));
    }
    let name = state.name.trim();
    if name.is_empty() || name.chars().count() > 200 {
        return Err(invalid(msg!("engine.videoNameLength", "The video name must be 1–200 characters")));
    }
    // Entities are stored in one table keyed by ID, so IDs also cannot repeat across different kinds.
    let counts = [
        state.sequences.len(),
        state.tracks.len(),
        state.items.len(),
        state.transitions.len(),
        state.markers.len(),
        state.ducking.len(),
        state.assets.len(),
        state.documents.len(),
        state.checkpoints.len(),
        state.protections.len(),
    ];
    let ids: BTreeSet<&str> = state
        .sequences
        .keys()
        .chain(state.tracks.keys())
        .chain(state.items.keys())
        .chain(state.transitions.keys())
        .chain(state.markers.keys())
        .chain(state.ducking.keys())
        .chain(state.assets.keys())
        .chain(state.documents.keys())
        .chain(state.checkpoints.keys())
        .chain(state.protections.keys())
        .map(String::as_str)
        .collect();
    let total: usize = counts.iter().sum();
    if ids.len() != total || ids.contains(state.id.as_str()) {
        return Err(invalid(msg!("engine.snapshotDuplicateIds", "The snapshot has duplicate entity IDs")));
    }
    for (id, asset) in &state.assets {
        if asset.id != *id || !asset.revisions.contains_key(&asset.current_revision) {
            return Err(invalid(msg!("engine.assetRecordIncomplete", "The record of asset {id} is incomplete", id)));
        }
        for (revision, version) in &asset.revisions {
            if version.revision != *revision || !version.content_hash.starts_with("sha256:") {
                return Err(invalid(msg!(
                    "engine.assetRevisionIncomplete",
                    "The record of revision {revision} of asset {id} is incomplete",
                    revision,
                    id
                )));
            }
        }
    }
    for (id, document) in &state.documents {
        if document.id != *id || !document.revisions.contains_key(&document.current_revision) {
            return Err(invalid(msg!("engine.documentRecordIncomplete", "The record of document {id} is incomplete", id)));
        }
    }
    for item in state.items.values() {
        let base = item.value.base();
        if state.tracks.get(&base.track_id).is_none_or(|t| t.sequence_id != item.sequence_id) {
            return Err(invalid(msg!(
                "engine.itemTrackOutside",
                "The track of clip {item} is not in its sequence",
                item = base.id
            )));
        }
        for asset_ref in item.value.asset_refs() {
            if !state
                .assets
                .get(&asset_ref.id)
                .is_some_and(|a| a.revisions.contains_key(&asset_ref.revision))
            {
                return Err(invalid(msg!(
                    "engine.itemAssetNotInPackage",
                    "Asset {asset}@{revision} used by clip {item} is not in the package",
                    asset = asset_ref.id,
                    revision = asset_ref.revision,
                    item = base.id
                )));
            }
        }
        if let TimelineItem::Caption(caption) = &item.value {
            let style = caption.style_document_id.iter();
            for doc in std::iter::once(&caption.document_id).chain(style) {
                if !state.documents.contains_key(doc) {
                    return Err(invalid(msg!(
                        "engine.captionDocumentNotInPackage",
                        "Document {doc} used by caption clip {item} is not in the package",
                        doc,
                        item = base.id
                    )));
                }
            }
        }
    }
    for sequence_id in state.sequences.keys() {
        check_overlaps(state, sequence_id)?;
    }
    let mut copy = state.clone();
    let changes = crate::transitions::reconcile_transitions(state, &mut copy)?;
    if let Some(first) = changes.removed.first() {
        return Err(invalid(msg!(
            "engine.transitionSidesInvalid",
            "The clips on either side of transition {transition} are invalid",
            transition = first.id
        )));
    }
    Ok(())
}

/// Publish the assets collected into the package into the video's `blobs/` by content address, and check them against the registered digest. Assets not collected into the package (links, missing ones) are not touched.
fn publish_assets(dir: &Path, package_dir: &Path, state: &VideoState) -> EngineResult<()> {
    for (id, asset) in &state.assets {
        for (revision, version) in &asset.revisions {
            if !matches!(version.storage, AssetStorage::Managed) {
                continue;
            }
            let rel = package_asset_path(&version.content_hash, &version.media_type);
            let source: PathBuf = package_dir.join(&rel);
            let details = || json!({ "assetId": id, "revision": revision, "path": rel });
            if version.media_type == DIRECTORY_MEDIA_TYPE {
                if !source.is_dir() {
                    return Err(invalid(msg!(
                        "engine.packageAssetMissing",
                        "The package is missing revision {revision} of asset {id}",
                        revision,
                        id
                    )).details(details()));
                }
                let include = version.tree.as_ref().and_then(|t| t.include.as_deref());
                let (hash, length, _) = hash_tree(&source, include)?;
                if hash != version.content_hash || length != version.byte_length {
                    return Err(mismatch(
                        msg!(
                            "engine.assetDigestMismatch",
                            "Revision {revision} of asset {id} does not match its recorded digest",
                            revision,
                            id
                        ),
                        details(),
                    ));
                }
                publish_tree(dir, &source, include, &version.content_hash)?;
            } else {
                let meta = fs::symlink_metadata(&source)
                    .map_err(|_| invalid(msg!(
                        "engine.packageAssetMissing",
                        "The package is missing revision {revision} of asset {id}",
                        revision,
                        id
                    )).details(details()))?;
                if !meta.is_file() || meta.len() != version.byte_length {
                    return Err(mismatch(
                        msg!(
                            "engine.assetLengthMismatch",
                            "The length of revision {revision} of asset {id} does not match its record",
                            revision,
                            id
                        ),
                        details(),
                    ));
                }
                publish_verified(dir, &source, &version.media_type, &version.content_hash)
                    .map_err(|_| mismatch(
                        msg!(
                            "engine.assetDigestMismatch",
                            "Revision {revision} of asset {id} does not match its recorded digest",
                            revision,
                            id
                        ),
                        details(),
                    ))?;
            }
        }
    }
    Ok(())
}
