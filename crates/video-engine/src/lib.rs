//! CucCut video engine: the sole writer of videos (architecture design §2.3, §5).
//!
//! A video is a directory: `video.db` (SQLite, WAL), `video.lock` (write lock) and `blobs/` (content-addressed media).
//! Edits are committed as validated operations in transactions; each transaction atomically writes entities, the receipt, undo records and the event outbox.

// The error body carries the entity, version and details, and only appears on the failure path; it is not boxed just to shrink the Result.
#![allow(clippy::result_large_err)]

pub mod anchors;
pub mod asset_usage;
pub mod chapters;
pub mod cuts;
pub mod ducking;
pub mod effects;
mod elements;
pub mod error;
pub mod gc;
pub mod ids;
pub mod import;
mod item_keyframes;
mod item_local;
pub mod ops;
pub mod package;
pub mod proposals;
pub mod receipt;
mod sequence_end;
pub mod state;
pub mod store;
pub mod task_guard;
pub mod transitions;
pub mod video;

/// The exchange DTOs live in `video-model`; the render plan and the WASM preview use them too, so the original path is kept here.
pub use video_model as model;

pub use error::{EngineResult, ErrorBody, Retryability};
pub use ops::EditOperation;
pub use receipt::{HistoryEntry, TransactionReceipt, VideoEvent};
pub use store::{ProjectClaim, UndoStep};
pub use task_guard::{ProtectionTarget, TaskProtection};
pub use video::{Committed, CreateOptions, OpenMode, UndoRequest, UndoState, UndoTarget, Video, VideoTransaction, claim_project_dir};
