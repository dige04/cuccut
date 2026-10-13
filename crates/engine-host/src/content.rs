//! `videos.readContent`: a read-only query used by the Space content index (architecture design §5.11). For a video that is already open, it uses the open instance; a video that is not open is opened read-only, takes no write lock, and is released once read.
//!
//! Returns the video snapshot (assets, sequences, markers), plus the current body of text documents (transcripts, subtitles, translations). Transcripts and subtitles also carry a timeline projection on the root sequence
//! (the same `plan_text` as export and preview). If the projection cannot be produced, the reason is included, and the Runtime falls back to source time.

use render_graph::VideoView;
use render_graph::text_plan::plan_text;
use serde_json::{Value, json};
use video_engine::Video;

const SPEECH_SCHEMA: &str = "cuccut.speech/1";
const CAPTION_SCHEMA: &str = "cuccut.caption/1";
/// Translation: `/2` is the current format; `/1` is read-only compatibility for old imported projects (video format spec §5.3).
const TRANSLATION_SCHEMAS: [&str; 2] = ["cuccut.translation/2", "cuccut.translation/1"];
const TEXT_KINDS: [&str; 3] = ["speech", "caption", "translation"];

pub fn read(video: &Video) -> Value {
    let snapshot = video.snapshot();
    let view = VideoView::from(&snapshot);
    let root = snapshot.root_sequence_id.clone();
    let mut documents = Vec::new();
    for (id, record) in &snapshot.documents {
        if !TEXT_KINDS.contains(&record.kind.as_str()) {
            continue;
        }
        let content = match video.document(id, None) {
            Ok(content) => content,
            Err(error) => {
                let mut entry = json!({ "documentId": id, "kind": record.kind, "error": error.message });
                if let Some(error_ref) = error.message_ref {
                    entry["errorRef"] = json!(error_ref);
                }
                documents.push(entry);
                continue;
            }
        };
        let schema = content.body.get("schema").and_then(Value::as_str).unwrap_or_default().to_string();
        let text = schema == SPEECH_SCHEMA || schema == CAPTION_SCHEMA || TRANSLATION_SCHEMAS.contains(&schema.as_str());
        let mut entry = json!({
            "documentId": id,
            "kind": record.kind,
            "name": record.name,
            "language": record.language,
            "revision": content.revision,
            "schema": schema,
            "sourceAssetId": record.source_asset_id,
            "sourceDocumentId": record.source_document_id,
            "body": if text { content.body.clone() } else { Value::Null },
            "plan": Value::Null,
        });
        if schema == SPEECH_SCHEMA || schema == CAPTION_SCHEMA {
            match plan_text(view, &root, &content.document, &content.body, &[], None) {
                Ok(plan) => entry["plan"] = serde_json::to_value(&plan).expect("能序列化"),
                Err(error) => entry["planError"] = json!({ "code": error.code, "message": error.message }),
            }
        }
        documents.push(entry);
    }
    json!({
        "videoId": snapshot.id,
        "name": snapshot.name,
        "revision": snapshot.revision,
        "snapshot": snapshot,
        "documents": documents,
    })
}
