//! Asset references and cleanup (command and protocol spec §4.2 `removeAssets`).
//!
//! An asset “is referenced” when any of the places below still points to it (the same map checked by `check_references`, plus the document's provenance):
//! - any instance on any sequence: the content's own `assetRef` and the synthesized prerender stand-in `prerender` ([`TimelineItem::asset_refs`]);
//! - the thumbnail of a chapter (marker);
//! - a document's source asset `sourceAssetId`: the transcript, the cut set, and the recording described by the edit proposal.
//!
//! An unreferenced asset may have its record deleted (`removeAssets`). A code bundle and the prerender stand-in baked from it are handled as a pair: the `sourceBundleRef` in the stand-in's provenance record (`provenance` is `composition-bake`, code bundle spec §7) is the `bundleId/revision` of the code bundle manifest. The two are a pair when it matches the same-named field in the code bundle's asset manifest.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::error::{EngineResult, ErrorBody, kinds, msg};
use crate::model::*;
use crate::ops::EditContext;
use crate::state::VideoState;

/// The value of `provenance.origin` on a baked prerender stand-in (code bundle spec §7; same as `BAKE_PROVENANCE_ORIGIN` in `@cuccut/protocol`).
pub const BAKE_PROVENANCE_ORIGIN: &str = "composition-bake";

/// An asset with no references (`videos.unusedAssets`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnusedAsset {
    pub asset_id: Id,
    pub name: String,
    pub kind: AssetKind,
    pub media_type: String,
    /// Byte size of the current version.
    pub byte_length: u64,
    /// `managed` (bytes are in the video directory) or `linked` (the file stays where it is; deleting the record does not touch it).
    pub storage: String,
    /// The other half of a pair (code bundle ↔ its prerender stand-in), also unreferenced; when one is deleted, both are deleted.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub paired_with: Vec<Id>,
}

/// For each referenced asset → the IDs of the instances, markers and documents that reference it.
pub fn asset_users(state: &VideoState) -> BTreeMap<Id, BTreeSet<Id>> {
    let mut users: BTreeMap<Id, BTreeSet<Id>> = BTreeMap::new();
    for placed in state.items.values() {
        for r in placed.value.asset_refs() {
            users.entry(r.id.clone()).or_default().insert(placed.value.base().id.clone());
        }
    }
    for placed in state.markers.values() {
        if let Some(r) = &placed.value.thumbnail {
            users.entry(r.id.clone()).or_default().insert(placed.value.id.clone());
        }
    }
    for document in state.documents.values() {
        if let Some(asset) = &document.source_asset_id {
            users.entry(asset.clone()).or_default().insert(document.id.clone());
        }
    }
    users
}

/// The identity of a code bundle manifest: `bundleId/revision`.
fn bundle_identity(asset: &AssetRecord) -> Option<(String, String)> {
    if asset.kind != AssetKind::Bundle {
        return None;
    }
    let manifest = asset.revisions.get(&asset.current_revision)?.bundle.as_ref()?;
    identity_of(manifest.get("bundleId")?, manifest.get("revision")?)
}

/// The source code bundle identity recorded by a prerender stand-in (the `sourceBundleRef` of the bake record).
fn baked_from(asset: &AssetRecord) -> Option<(String, String)> {
    let revision = asset.revisions.get(&asset.current_revision)?;
    if revision.provenance.origin != BAKE_PROVENANCE_ORIGIN {
        return None;
    }
    let source = revision.provenance.source.as_ref()?.get("sourceBundleRef")?;
    identity_of(source.get("id")?, source.get("revision")?)
}

fn identity_of(id: &Value, revision: &Value) -> Option<(String, String)> {
    let revision = match revision {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        _ => return None,
    };
    Some((id.as_str()?.to_string(), revision))
}

/// Asset → its paired other half (code bundle ↔ prerender stand-in); matches on identity only, not on whether it is referenced.
fn pairs(state: &VideoState) -> BTreeMap<Id, BTreeSet<Id>> {
    let mut bundles: BTreeMap<(String, String), Vec<&Id>> = BTreeMap::new();
    for (id, asset) in &state.assets {
        if let Some(identity) = bundle_identity(asset) {
            bundles.entry(identity).or_default().push(id);
        }
    }
    let mut out: BTreeMap<Id, BTreeSet<Id>> = BTreeMap::new();
    for (id, asset) in &state.assets {
        let Some(identity) = baked_from(asset) else { continue };
        for bundle in bundles.get(&identity).into_iter().flatten() {
            out.entry(id.clone()).or_default().insert((*bundle).clone());
            out.entry((*bundle).clone()).or_default().insert(id.clone());
        }
    }
    out
}

/// Assets in the video that have no references, sorted by ID.
pub fn unused_assets(state: &VideoState) -> Vec<UnusedAsset> {
    let users = asset_users(state);
    let unused: BTreeSet<&Id> = state.assets.keys().filter(|id| !users.contains_key(*id)).collect();
    let pairs = pairs(state);
    unused
        .iter()
        .map(|id| {
            let asset = &state.assets[*id];
            let current = asset.revisions.get(&asset.current_revision);
            UnusedAsset {
                asset_id: (*id).clone(),
                name: asset.name.clone(),
                kind: asset.kind,
                media_type: current.map(|r| r.media_type.clone()).unwrap_or_default(),
                byte_length: current.map_or(0, |r| r.byte_length),
                storage: match current.map(|r| &r.storage) {
                    Some(AssetStorage::Linked { .. }) => "linked".into(),
                    _ => "managed".into(),
                },
                paired_with: pairs
                    .get(*id)
                    .into_iter()
                    .flatten()
                    .filter(|other| unused.contains(other))
                    .cloned()
                    .collect(),
            }
        })
        .collect()
}

/// `removeAssets`: every listed asset must have no references; when the other half of a pair is also unreferenced, it is deleted together. Only records are deleted.
pub(crate) fn remove_assets(state: &mut VideoState, asset_ids: &[Id], ctx: &mut EditContext<'_>) -> EngineResult<()> {
    if asset_ids.is_empty() {
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.removeAssetsEmpty",
            "removeAssets needs at least one entry"
        )));
    }
    for id in asset_ids {
        if !state.assets.contains_key(id) {
            return Err(ErrorBody::not_found(kinds::asset(), id));
        }
    }
    let users = asset_users(state);
    let in_use: Vec<&Id> = asset_ids.iter().filter(|id| users.contains_key(*id)).collect();
    if !in_use.is_empty() {
        let used_by: BTreeMap<&Id, &BTreeSet<Id>> = in_use.iter().map(|id| (*id, &users[*id])).collect();
        return Err(ErrorBody::invalid_operation(msg!(
            "engine.assetInUse",
            "Asset {asset} is still used by {users}; only assets nothing refers to can be removed",
            asset = in_use[0].as_str(),
            users = used_by[in_use[0]].iter().cloned().collect::<Vec<_>>().join(", ")
        ))
        .recovery(msg!(
            "engine.assetInUseRecovery",
            "Delete or replace the clips, chapter thumbnails and documents that use it first, or leave the asset in place"
        ))
        .entities(in_use.iter().map(|id| (*id).clone()))
        .details(json!({ "rule": "asset-in-use", "usedBy": used_by })));
    }
    let pairs = pairs(state);
    let mut removed: BTreeSet<Id> = asset_ids.iter().cloned().collect();
    for id in asset_ids {
        for partner in pairs.get(id).into_iter().flatten() {
            if !users.contains_key(partner) {
                removed.insert(partner.clone());
            }
        }
    }
    for id in &removed {
        state.assets.remove(id);
        if !ctx.removed_assets.contains(id) {
            ctx.removed_assets.push(id.clone());
        }
    }
    Ok(())
}
