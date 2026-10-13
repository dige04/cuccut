//! `exports.plan`: the freeze taken when an export starts (architecture design §9.11). In a single request it reads the current video snapshot, the document bodies it needs, and asset locations,
//! then computes the audio segment plan or the text timeline projection (`render-graph`, the same implementation as preview). The engine host processes requests in order,
//! so this one result corresponds to a single video version; later edits do not affect an export that has already been frozen.

use std::collections::{BTreeMap, BTreeSet};

use editor_semantics::Ratio;
use message_ref::{Text, msg};
use render_graph::VideoView;
use render_graph::audio_plan::{plan_audio_with_speech, speaker_activity, speech_activity};
use render_graph::text_plan::plan_text;
use render_graph::video_plan::{output_geometry, plan_video};
use serde::Deserialize;
use serde_json::{Value, json};
use video_engine::error::kinds;
use video_engine::model::{AssetStorage, DocumentRecord, Id, TimelineItem};
use video_engine::video::DocumentContent;
use video_engine::{ErrorBody, Retryability, Video};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanParams {
    pub video_id: Id,
    /// `audio`: the audio range plan; `text`: the timeline projection of the document; `video`: the sequences, assets, and documents to freeze for the final cut, plus each segment's visual overview and audio plan.
    kind: String,
    #[serde(default)]
    sequence_id: Option<Id>,
    /// Sequence time in seconds `[start, end)`; each part gets its own plan (`parts`, same video version); when empty, it is the whole sequence.
    #[serde(default)]
    ranges: Vec<RangeParams>,
    /// For `text`: the first is the main document; the second (optional) is the other language of a merged bilingual pair.
    #[serde(default)]
    document_ids: Vec<Id>,
    /// For `text`: projects only through these instances.
    #[serde(default)]
    scope_item_ids: Vec<Id>,
    /// For `audio` and `video`: which instances to disable or unmute in this one audio plan only (for example, only the original sound, or only one group of voiceover; architecture design §9.13).
    /// The visual plan and frozen sequence (`document`) of `video` are not affected; the video itself is unchanged.
    #[serde(default)]
    audio_items: Option<AudioItemSelection>,
    /// For `video`: the desired output width and height (in pixels; both may be omitted). The plan's `output` is the determined output size and the position of the picture within it
    /// (`render_graph::video_plan::output_geometry`).
    #[serde(default)]
    output: Option<OutputParams>,
    /// For `video`: does not freeze assets (`assets` is empty; it does not check whether files exist or have changed). Font inventory (`fonts.usage`) covers only text and subtitles,
    /// which need no assets; a video with missing assets is still inventoried.
    #[serde(default)]
    skip_assets: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OutputParams {
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
}

/// Instances switched in the audio plan: `disable` is treated as disabled (no sound, and does not trigger ducking), and `unmute` is treated as not muted (the `mix.muted` of audio instances,
/// and the embedded audio of video instances). The caller decides which instances, based on the markers in the video; IDs not in the sequence are ignored.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AudioItemSelection {
    #[serde(default)]
    disable: Vec<Id>,
    #[serde(default)]
    unmute: Vec<Id>,
}

/// Applies the instance selection to this sequence in the snapshot (affects only this plan).
fn select_audio_items(items: &mut [TimelineItem], selection: &AudioItemSelection) {
    for item in items {
        let id = item.base().id.clone();
        if selection.unmute.contains(&id) {
            match item {
                TimelineItem::Audio(a) => a.mix.muted = false,
                TimelineItem::Video(v) => v.embedded_audio.enabled = true,
                _ => {}
            }
        }
        if selection.disable.contains(&id) {
            item.base_mut().enabled = false;
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RangeParams {
    start: f64,
    end: f64,
}

const MAX_RANGES: usize = 64;
const SPEECH_SCHEMA: &str = "cuccut.speech/1";

/// Translation body (video format spec §5.3): `/2` is the canonical format, which the translation flow writes; `/1` is the format of old imported projects, read-only compatibility.
/// Neither carries timing, so it cannot be projected as the main document; it is carried along with the main document as body text only, and export matches it to sentences by sentence ID.
fn is_translation(schema: &str) -> bool {
    matches!(schema, "cuccut.translation/1" | "cuccut.translation/2")
}

/// The source clock can come from a document's source chain (format spec §4.6), including subtitle → translation → transcript.
fn source_asset(documents: &BTreeMap<Id, DocumentRecord>, id: &str) -> Option<Id> {
    let mut current = id;
    let mut visited = BTreeSet::new();
    while visited.insert(current) {
        let document = documents.get(current)?;
        if let Some(asset) = &document.source_asset_id {
            return Some(asset.clone());
        }
        current = document.source_document_id.as_deref()?;
    }
    None
}

fn invalid(code: &str, message: impl Into<Text>) -> ErrorBody {
    ErrorBody::new(code, message, Retryability::Never)
}

/// Seconds → rational number at microsecond precision (same rounding as the interactive preview entry point).
fn seconds(value: f64, field: &str) -> Result<Ratio, ErrorBody> {
    if !value.is_finite() || value < 0.0 {
        return Err(invalid(
            "EXPORT_RANGE_EMPTY",
            msg!("engineHost.secondsInvalid", "{field} must be a finite number of seconds, at least 0", field),
        ));
    }
    Ratio::new((value * 1_000_000.0).round() as i128, 1_000_000)
        .ok_or_else(|| invalid(
                "TIME_ARITHMETIC_OVERFLOW",
                msg!("engineHost.secondsOverflow", "{field} is out of range", field),
            ))
}

fn plan_error(error: render_graph::PlanError) -> ErrorBody {
    invalid(&error.code, error.message)
}

pub fn plan(video: &Video, value: PlanParams) -> Result<Value, ErrorBody> {
    let snapshot = video.snapshot();
    let sequence_id = value.sequence_id.clone().unwrap_or_else(|| snapshot.root_sequence_id.clone());
    // Sequence used for the audio plan: a copy with the instance selection applied (affects only this audio; the visuals and frozen sequence stay as they are).
    let audio_sequences = match &value.audio_items {
        Some(_) if value.kind != "audio" && value.kind != "video" => {
            return Err(invalid(
                "INVALID_PARAMS",
                msg!("engineHost.audioItemsKind", "audioItems is only for audio and video plans"),
            ));
        }
        Some(selection) => {
            let mut sequences = snapshot.sequences.clone();
            if let Some(sequence) = sequences.get_mut(&sequence_id) {
                select_audio_items(&mut sequence.items, selection);
            }
            Some(sequences)
        }
        None => None,
    };
    if value.skip_assets && value.kind != "video" {
        return Err(invalid(
            "INVALID_PARAMS",
            msg!("engineHost.skipAssetsKind", "skipAssets is only for video plans"),
        ));
    }
    if let Some(output) = &value.output {
        if value.kind != "video" {
            return Err(invalid(
                "INVALID_PARAMS",
                msg!("engineHost.outputKind", "output is only for video plans"),
            ));
        }
        if output.width == Some(0) || output.height == Some(0) {
            return Err(invalid(
                "INVALID_PARAMS",
                msg!("engineHost.outputSize", "The output width and height must be positive integers"),
            ));
        }
    }
    let sequence = snapshot
        .sequences
        .get(&sequence_id)
        .ok_or_else(|| ErrorBody::not_found(kinds::sequence(), &sequence_id))?;
    if value.ranges.len() > MAX_RANGES {
        return Err(invalid(
            "INVALID_PARAMS",
            msg!("engineHost.tooManyRanges", "At most {max} ranges at a time", max = MAX_RANGES),
        ));
    }
    let mut ranges: Vec<Option<(Ratio, Ratio)>> = Vec::new();
    for r in &value.ranges {
        ranges.push(Some((seconds(r.start, "range.start")?, seconds(r.end, "range.end")?)));
    }
    if ranges.is_empty() {
        ranges.push(None);
    }
    let view = VideoView::from(&snapshot);
    let audio_view = match &audio_sequences {
        Some(sequences) => VideoView {
            sequences,
            assets: &snapshot.assets,
        },
        None => view,
    };
    let mut result = json!({
        "videoId": snapshot.id,
        "videoName": snapshot.name,
        "videoRevision": snapshot.revision,
        "sequenceId": sequence.id,
        "sequenceRevision": sequence.revision,
        "fps": sequence.header.fps,
        "canvas": { "width": sequence.header.canvas.width, "height": sequence.header.canvas.height },
    });
    // Ducking triggered by the script (video format spec §3.9): the trigger range is the effective word stream across the whole sequence, shared by all segment ranges.
    let transcripts = match value.kind.as_str() {
        "audio" | "video" => speech_documents(video, &snapshot)?,
        _ => Vec::new(),
    };
    let transcript_pairs: Vec<_> = transcripts.iter().map(|c| (&c.document, &c.body)).collect();
    let speech = if transcript_pairs.is_empty() {
        Vec::new()
    } else {
        speech_activity(view, &sequence_id, &transcript_pairs).map_err(plan_error)?
    };
    match value.kind.as_str() {
        "audio" => {
            let mut parts = Vec::new();
            let mut assets = Vec::new();
            let mut seen: Vec<(String, String)> = Vec::new();
            for range in ranges {
                let plan = plan_audio_with_speech(audio_view, &sequence_id, range, &speech).map_err(plan_error)?;
                for segment in &plan.segments {
                    let key = (segment.asset.id.clone(), segment.asset.revision.clone());
                    if seen.contains(&key) {
                        continue;
                    }
                    assets.push(asset_entry(video, &snapshot, &key.0, &key.1)?);
                    seen.push(key);
                }
                parts.push(json!({ "audio": plan }));
            }
            result["parts"] = Value::Array(parts);
            result["assets"] = Value::Array(assets);
        }
        "text" => {
            let Some(primary) = value.document_ids.first() else {
                return Err(invalid(
                    "INVALID_PARAMS",
                    msg!("engineHost.textPlanNoDocument", "A text plan needs at least one document"),
                ));
            };
            if value.document_ids.len() > 2 {
                return Err(invalid(
                    "INVALID_PARAMS",
                    msg!(
                        "engineHost.textPlanTooManyDocuments",
                        "A text plan takes at most two documents (the main one and the other one of a bilingual merge)"
                    ),
                ));
            }
            let mut contents = Vec::new();
            let mut documents = Vec::new();
            for document_id in &value.document_ids {
                let mut content = video.document(document_id, None)?;
                content.document.source_asset_id = source_asset(&snapshot.documents, document_id);
                let schema = content.body.get("schema").and_then(Value::as_str).unwrap_or_default().to_string();
                documents.push(json!({
                    "documentId": content.document.id,
                    "kind": content.document.kind,
                    "name": content.document.name,
                    "language": content.document.language,
                    "revision": content.revision,
                    "sourceAssetId": content.document.source_asset_id,
                    "sourceDocumentId": content.document.source_document_id,
                    "schema": schema,
                    // The translation has no timing: it is carried over as-is, and export matches it to the main document's sentences by sentence ID. The transcript also carries its body: sentence members and speaker names
                    // (timing always uses the projection in `parts`, not the source times in the body).
                    "body": if is_translation(&schema) || schema == SPEECH_SCHEMA { content.body.clone() } else { Value::Null },
                }));
                contents.push((schema, content));
            }
            let mut parts = Vec::new();
            for range in ranges {
                let mut plans = Vec::new();
                for (schema, content) in &contents {
                    if is_translation(schema) && &content.document.id != primary {
                        plans.push(Value::Null);
                        continue;
                    }
                    let plan = plan_text(view, &sequence_id, &content.document, &content.body, &value.scope_item_ids, range)
                        .map_err(plan_error)?;
                    plans.push(serde_json::to_value(&plan).expect("can serialize"));
                }
                parts.push(json!({ "plans": plans }));
            }
            result["documents"] = Value::Array(documents);
            result["parts"] = Value::Array(parts);
            // For ASS: the style document for displaying the first subtitle instance of the main document.
            let style_id = sequence.items.iter().find_map(|item| match item {
                TimelineItem::Caption(c) if &c.document_id == primary => c.style_document_id.clone(),
                _ => None,
            });
            result["style"] = match style_id {
                Some(id) => match video.document(&id, None) {
                    Ok(style) => json!({ "documentId": id, "revision": style.revision, "body": style.body }),
                    Err(_) => Value::Null,
                },
                None => Value::Null,
            };
        }
        "video" => {
            let mut parts = Vec::new();
            let mut refs: Vec<(String, String)> = Vec::new();
            let mut document_ids: Vec<Id> = Vec::new();
            for range in ranges {
                let picture = plan_video(view, &sequence_id, range).map_err(plan_error)?;
                let audio = plan_audio_with_speech(audio_view, &sequence_id, range, &speech).map_err(plan_error)?;
                let used = picture.assets.iter().chain(audio.segments.iter().map(|s| &s.asset));
                for asset in used {
                    let key = (asset.id.clone(), asset.revision.clone());
                    if !refs.contains(&key) {
                        refs.push(key);
                    }
                }
                for id in &picture.documents {
                    if !document_ids.contains(id) {
                        document_ids.push(id.clone());
                    }
                }
                parts.push(json!({ "video": picture, "audio": audio }));
            }
            // The waveform listens to the sound of the whole sequence (format spec §3.7); audio segments may lie outside the export range: those assets are also frozen, and their spectra are computed at export time.
            if sequence.items.iter().any(|item| matches!(item, TimelineItem::Visualizer(_))) {
                let whole = render_graph::audio_plan::plan_audio(view, &sequence_id, None).map_err(plan_error)?;
                for segment in &whole.segments {
                    let key = (segment.asset.id.clone(), segment.asset.revision.clone());
                    if !refs.contains(&key) {
                        refs.push(key);
                    }
                }
            }
            let mut assets = Vec::new();
            if !value.skip_assets {
                for (id, revision) in &refs {
                    assets.push(asset_entry(video, &snapshot, id, revision)?);
                }
            }
            // Frame by frame, the part of the video the plan needs (`PlanDocument`): this sequence and the asset records it references.
            let mut records = serde_json::Map::new();
            for item in &sequence.items {
                for asset in item.asset_refs() {
                    if let Some(record) = snapshot.assets.get(&asset.id) {
                        records.insert(asset.id.clone(), serde_json::to_value(record).expect("can serialize"));
                    }
                }
            }
            result["document"] = json!({
                "rootSequenceId": sequence_id,
                "sequences": { sequence_id.clone(): sequence },
                "assets": records,
            });
            // The transcript containing the subtitle's words (the `speech` document pointed to by `sourceDocumentId` in the subtitle document header) is frozen along with it; word-by-word animation and emphasis advance according to it.
            let transcripts_used: Vec<Id> = document_ids
                .iter()
                .filter_map(|id| snapshot.documents.get(id)?.source_document_id.clone())
                .filter(|parent| snapshot.documents.get(parent).is_some_and(|record| record.kind == "speech"))
                .collect();
            for id in transcripts_used {
                if !document_ids.contains(&id) {
                    document_ids.push(id);
                }
            }
            result["documents"] = Value::Array(document_ids.iter().map(|id| caption_document(video, &snapshot, id)).collect());
            result["assets"] = Value::Array(assets);
            result["parts"] = Value::Array(parts);
            let (width, height) = value.output.as_ref().map_or((None, None), |o| (o.width, o.height));
            let canvas = &sequence.header.canvas;
            result["output"] = serde_json::to_value(output_geometry(canvas.width, canvas.height, width, height)).expect("can serialize");
            // Waveform with `speaker` set (format spec §3.7): the intervals in which each speaker talks across the whole sequence, computed the same way as in preview. Not provided when the video has no transcript;
            // export renders it as having no transcript (silent, with a notice).
            let speaker_visualizer = sequence.items.iter().any(|item| match item {
                TimelineItem::Visualizer(v) => v.visualizer.speaker.as_deref().is_some_and(|s| !s.is_empty()),
                _ => false,
            });
            if speaker_visualizer && !transcript_pairs.is_empty() {
                let speakers = speaker_activity(view, &sequence_id, &transcript_pairs).map_err(plan_error)?;
                result["speakers"] = serde_json::to_value(speakers).expect("can serialize");
            }
        }
        other => return Err(invalid(
                "INVALID_PARAMS",
                msg!("engineHost.planKindUnknown", "Unknown plan kind {kind}", kind = other),
            )),
    }
    Ok(result)
}

/// The current body of each transcript document in the video (`kind: speech`): projected onto the sequence it becomes the effective word stream (ducking trigger ranges, waveform speakers).
fn speech_documents(video: &Video, snapshot: &video_engine::model::VideoSnapshot) -> Result<Vec<DocumentContent>, ErrorBody> {
    let mut contents = Vec::new();
    for (id, record) in &snapshot.documents {
        if record.kind == "speech" {
            contents.push(video.document(id, None)?);
        }
    }
    Ok(contents)
}

/// Frozen body of the documents subtitles need to read (the subtitle document, the style document, or the transcript containing the subtitle's words). `lineKind` is the kind of subtitle line: subtitles derived from a translation
/// are translation lines, and the rest are source-language lines (the same judgment as in preview). `sourceDocumentId` and `sourceAssetId` in the document header are copied as-is (used for looking up subtitle words).
/// If the document is gone, the body is `null`, and export's pre-check reports it.
fn caption_document(video: &Video, snapshot: &video_engine::model::VideoSnapshot, id: &Id) -> Value {
    let record = snapshot.documents.get(id);
    let parent_kind = record
        .and_then(|r| r.source_document_id.as_ref())
        .and_then(|parent| snapshot.documents.get(parent))
        .map(|parent| parent.kind.as_str());
    let content = video.document(id, None).ok();
    json!({
        "documentId": id,
        "kind": record.map(|r| r.kind.clone()),
        "revision": content.as_ref().map(|c| c.revision.clone()),
        "schema": content.as_ref().and_then(|c| c.body.get("schema")).and_then(Value::as_str),
        "lineKind": if parent_kind == Some("translation") { "translation" } else { "original" },
        "sourceDocumentId": record.and_then(|r| r.source_document_id.clone()),
        "sourceAssetId": source_asset(&snapshot.documents, id),
        "body": content.map(|c| c.body),
    })
}

/// Frozen info for one asset version: location, storage mode, and fingerprint. If the file is missing or its size has changed, the engine reports `ASSET_MISSING`.
fn asset_entry(video: &Video, snapshot: &video_engine::model::VideoSnapshot, asset_id: &str, revision: &str) -> Result<Value, ErrorBody> {
    let resolved = video.resolve_asset(asset_id, Some(revision))?;
    let record = snapshot
        .assets
        .get(asset_id)
        .and_then(|asset| asset.revisions.get(revision))
        .ok_or_else(|| ErrorBody::asset_missing(
            asset_id,
            msg!("engine.assetRevisionMissing", "The asset has no revision {revision}", revision),
        ))?;
    let modified_at = match &record.storage {
        AssetStorage::Linked { locator, .. } => locator.modified_at.clone(),
        AssetStorage::Managed => None,
    };
    Ok(json!({
        "assetId": asset_id,
        "revision": revision,
        "name": resolved.name,
        "path": resolved.path,
        "storage": resolved.storage,
        "mediaType": record.media_type,
        "contentHash": record.content_hash,
        "byteLength": record.byte_length,
        "modifiedAt": modified_at,
        "audio": record.audio,
        "video": record.video,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_clock_follows_document_ancestry_and_stops_at_direct_assets() {
        let record = |id: &str, parent: Option<&str>, asset: Option<&str>| {
            serde_json::from_value(json!({ "id": id, "kind": "caption", "name": id,
                "sourceDocumentId": parent, "sourceAssetId": asset, "currentRevision": "1", "revisions": {} }))
            .unwrap()
        };
        let mut documents = BTreeMap::from([
            ("speech".into(), record("speech", None, Some("media"))),
            ("translation".into(), record("translation", Some("speech"), None)),
            ("caption".into(), record("caption", Some("translation"), None)),
        ]);
        assert_eq!(source_asset(&documents, "caption"), Some("media".into()));
        documents.insert("caption".into(), record("caption", Some("translation"), Some("override")));
        assert_eq!(source_asset(&documents, "caption"), Some("override".into()));
        documents.insert("caption".into(), record("caption", Some("missing"), None));
        assert_eq!(source_asset(&documents, "caption"), None);
        documents.insert("caption".into(), record("caption", Some("translation"), None));
        documents.insert("speech".into(), record("speech", Some("caption"), None));
        assert_eq!(source_asset(&documents, "caption"), None);
    }

    #[test]
    fn both_translation_schemas_ride_along_with_the_primary() {
        assert!(is_translation("cuccut.translation/1"));
        assert!(is_translation("cuccut.translation/2"));
        assert!(!is_translation("cuccut.translation/3"));
        assert!(!is_translation(SPEECH_SCHEMA));
    }
}
