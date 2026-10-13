//! Documents that composition reads: frozen bodies of the caption document, the caption style document, and the transcript document holding the caption words (`documents` of the engine's `exports.plan`; the preview supplies them from the UI).

use std::collections::HashMap;
use std::sync::Arc;

use serde::Deserialize;
use serde_json::Value;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrozenDocument {
    pub document_id: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub schema: Option<String>,
    /// Caption line kind: `original` or `translation` (captions derived from a translation).
    #[serde(default)]
    pub line_kind: Option<String>,
    /// The document header's `sourceDocumentId`: caption sentences point to words in this document through `words`.
    #[serde(default)]
    pub source_document_id: Option<String>,
    /// The document header's `sourceAssetId`: the media the transcript describes (used to project the effective word stream).
    #[serde(default)]
    pub source_asset_id: Option<String>,
    /// `null` when the document is gone.
    #[serde(default)]
    pub body: Value,
}

/// Documents looked up by ID. Bodies are shared: when the preview swaps documents, the transcript is no longer copied in full.
#[derive(Clone, Debug, Default)]
pub struct Documents {
    by_id: HashMap<String, Arc<FrozenDocument>>,
}

impl Documents {
    pub fn new(documents: Vec<FrozenDocument>) -> Documents {
        Documents::shared(documents.into_iter().map(Arc::new))
    }

    /// Documents with shared bodies; if the same ID appears twice, the later one wins.
    pub fn shared(documents: impl IntoIterator<Item = Arc<FrozenDocument>>) -> Documents {
        Documents {
            by_id: documents.into_iter().map(|d| (d.document_id.clone(), d)).collect(),
        }
    }

    pub fn get(&self, id: &str) -> Option<&FrozenDocument> {
        self.by_id.get(id).map(Arc::as_ref).filter(|d| !d.body.is_null())
    }
}
