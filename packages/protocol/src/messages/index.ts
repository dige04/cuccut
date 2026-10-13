/**
 * The registry of all Runtime-side message catalogs (message-ref.ts). The UI, the CLI and the Runtime all load it through `@cuccut/protocol`, so each can expand message references sent by other processes in its own language. These files hold only text and do not import Node-specific modules.
 *
 * One catalog corresponds to the package that emits the text (Rust crates too; see `tools/rust-messages.mjs`). Within a package, the files are split by area. Area names (the key prefix) are unique across the repository.
 */
import './runtime-core/index.ts';
import './jobs/index.ts';
import './models/index.ts';
import './nodes/index.ts';
import './providers/index.ts';
import './agent-drivers/index.ts';
import './harness/index.ts';
import './runtime-storage/index.ts';
import './protocol/index.ts';
import './process-host/index.ts';
import './client/index.ts';
import './video-engine/index.ts';
import './engine-host/index.ts';
import './video-model/index.ts';
import './editor-semantics/index.ts';
import './message-ref/index.ts';
import './ui/index.ts';
