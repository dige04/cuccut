# docs/design/slides/ — In-session slide decks

In a session, have the agent build a deck (slides). Preview and edit it in the ribbon with the Slides editor, and send annotations on the slides back to the session as attachments. The editor is a ported Slides runtime. Host capabilities (files, assets, users, annotations, external changes) are re-implemented by the Runtime and the UI ([architecture design §3.5](../../architecture/architecture-design.md#35-tool-catalog), [§4.8](../../architecture/architecture-design.md#48-external-services)).

| File | Content and status |
| --- | --- |
| [`slides-design.md`](slides-design.md) | **In progress (2026-10-10; stages 2 to 5 implemented)**: four decisions (runtime checked in, screenshots, web scope, asset URLs); mapping of the deck's disk format to runtime URLs; host capabilities compared item by item (`db` not needed, `room` not done); Runtime's `slides.open` and slide routes, optimistic concurrency for publishing, assets, external changes; skill and `slides_check` / `slides_import_asset`; ribbon slide tab and annotation flow; protocol for annotation attachments; spec to revise and staged implementation plan |

The implementation lives in `packages/slides` (protocol, storage, routing, host shim), `packages/slides-runtime` (runtime source, D1) and `apps/slides-editor` (build of the editor page), drawing on an existing Slides implementation.
