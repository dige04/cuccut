//! Portable package (video format spec §8): freezing at export (`exports.package`) and building an unpacked package into a new video (`videos.importPackage`).
//!
//! Freezing reads, in one request, the current snapshot, the original text of the body stored for each document version, and the current location of each asset version. The engine host processes requests in order,
//! so they correspond to the same video version. Document versions and blobs taken into the video no longer change; later edits do not affect an already frozen export.

use std::path::PathBuf;

use serde::Deserialize;
use serde_json::{Value, json};
use message_ref::msg;
use video_engine::import::{DIRECTORY_MEDIA_TYPE, tree_files};
use video_engine::model::{AssetStorage, Id};
use video_engine::package::{import_package, package_asset_path, package_document_path};
use video_engine::{ErrorBody, Retryability, Video};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportParams {
    /// Directory of the new video (absolute path, does not exist yet).
    pub path: String,
    /// Directory where the unpacked, manifest-verified package is (absolute path).
    pub package_dir: String,
    #[serde(default)]
    pub project_id: Option<Id>,
}

/// Freezes an open video, for the Runtime to write a portable package. When an asset version cannot be read, no error is raised; each item carries `missing`, and the Runtime decides whether to reject or to annotate it honestly.
pub fn freeze(video: &Video) -> Result<Value, ErrorBody> {
    let snapshot = video.snapshot();
    let mut documents = Vec::new();
    for (id, record) in &snapshot.documents {
        for (revision, version) in &record.revisions {
            let text = video.document_text(id, revision)?;
            documents.push(json!({
                "documentId": id,
                "revision": revision,
                "contentHash": version.content_hash,
                "byteLength": text.len(),
                "packagePath": package_document_path(id, revision),
                "text": text,
            }));
        }
    }
    let mut assets = Vec::new();
    for (id, asset) in &snapshot.assets {
        for (revision, version) in &asset.revisions {
            let storage = match version.storage {
                AssetStorage::Managed => "managed",
                AssetStorage::Linked { .. } => "linked",
            };
            let mut entry = json!({
                "assetId": id,
                "revision": revision,
                "name": asset.name,
                "mediaType": version.media_type,
                "contentHash": version.content_hash,
                "byteLength": version.byte_length,
                "storage": storage,
                "packagePath": package_asset_path(&version.content_hash, &version.media_type),
            });
            match video.resolve_asset(id, Some(revision)) {
                Ok(resolved) => {
                    entry["path"] = json!(resolved.path);
                    if version.media_type == DIRECTORY_MEDIA_TYPE {
                        let include = version.tree.as_ref().and_then(|t| t.include.as_deref());
                        match tree_files(&resolved.path, include) {
                            Ok(files) => {
                                entry["files"] = files.iter().map(|(rel, path)| json!({ "rel": rel, "path": path })).collect();
                            }
                            Err(e) => entry["missing"] = json!({ "reason": "missing", "message": e.message }),
                        }
                    }
                }
                Err(e) => {
                    let reason = e.details.get("reason").and_then(Value::as_str).unwrap_or("missing");
                    entry["missing"] = json!({ "reason": reason, "message": e.message });
                }
            }
            assets.push(entry);
        }
    }
    Ok(json!({
        "videoDir": video.dir(),
        "snapshot": snapshot,
        "documents": documents,
        "assets": assets,
    }))
}

/// Builds the unpacked package into a new video, returning the same structure as `videos.create` (the caller registers it as an open video).
pub fn import(params: ImportParams, ffprobe: &std::path::Path) -> Result<Video, ErrorBody> {
    let dir = PathBuf::from(&params.path);
    let package_dir = PathBuf::from(&params.package_dir);
    if !dir.is_absolute() || !package_dir.is_absolute() {
        return Err(ErrorBody::new(
            "INVALID_PARAMS",
            msg!("engineHost.pathRelative", "Paths must be absolute"),
            Retryability::Never,
        ));
    }
    import_package(&dir, &package_dir, params.project_id.as_deref(), ffprobe)
}
