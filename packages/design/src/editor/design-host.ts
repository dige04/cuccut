/**
 * Host capabilities that the design canvas runtime (@cuccut/design-runtime) reads from globalThis.designHost (docs/design/canvas §4).
 * The original runtime read globalThis.claude. When porting, all of these read points were changed to designHost, each marked with a `CucCut:` comment.
 *
 * The host object is the same one the slide editor uses (connectEditorHost from @cuccut/slides/editor), so its shape is SlidesHost.
 * Where each capability is read in the runtime (paths relative to packages/design-runtime/src):
 *   artifact / self  platform/design-files-port.ts, platform/publish.ts, platform/document-store.ts (publish batch-writes files, with ifMatch)
 *   user             platform/user-capabilities.ts (id / canEdit / can / profiles; `me` is not provided, so the runtime treats the current user's profile as unavailable)
 *   assets           platform/image-upload.ts (images and fonts pasted or dragged in, returning /_blob/<id>)
 *   comments         comments/host-controller.ts (customAnchors: the runtime computes anchors, and the host opens the comment box)
 *   chat             canvas/claude-handoff.tsx (the "hand off to agent" prompt is placed in the session's input box)
 *   downloads        export/downloads.tsx saveThroughHost (exported files are handed to the parent window to save, downloads-bridge.ts; not provided when the page is opened standalone)
 * Not provided (the runtime has fallbacks for all of them, see packages/design-runtime/README.md):
 *   use       asynchronously gets a capability by name; without it, platform/host-capabilities.ts reads the fields above directly, without waiting
 *   sample    fast edit needs the host to call the model on its behalf (fast-edit/sampling-capability.ts); fast edit is also off in the feature flags
 *   db, room  the old database storage and multi-user online (platform/database-adapter.ts); the runtime works in file mode, single-user
 *   hot       applies external changes in place (platform/hot-reload.ts); CucCut instead publishes unsaved changes and then reloads
 *   commentLabels only the slide runtime asks for this
 */
import type { SlidesHost } from '@cuccut/slides/editor';
import type { HostDownloadsCapability } from './downloads-bridge.ts';

export type { HostDownloadsCapability, HostSaveFile } from './downloads-bridge.ts';

export type DesignHost = Omit<SlidesHost, 'commentLabels' | 'use'> & { downloads?: HostDownloadsCapability };

declare global {
  // eslint-disable-next-line no-var -- global variables can only be declared with var
  var designHost: DesignHost | undefined;
}
