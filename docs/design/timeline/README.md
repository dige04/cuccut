# docs/design/timeline/ — Timeline Semantics and Element Model (Ported from v2)

Design notes from v2 `ccut-timeline`, plus a mapping between the v2 element model and the v3 video format. The implementation lives in `crates/timeline` (ported as-is; VideoEngine and `render-graph` are wired to the editing semantics where that is done, see [Architecture design §13.6](../../architecture/architecture-design.md#136-porting-from-v2) and §14 "Porting the timeline semantics").

Apart from `element-model-mapping.md`, every file is copied verbatim from v2 `docs/design/`: a one-line note was added at the top, and the body is unchanged. Relative links in the body still follow v2's directory layout, so most of them will likely not open here. `core/crates/ccut-timeline/src/…` in the text corresponds to `crates/timeline/src/…` in this repository.

| File | Contents |
| --- | --- |
| [`element-model-mapping.md`](element-model-mapping.md) | **v2 element model vs. v3 video format**: field-by-field correspondence, conversion between containers and time, where legacy data goes, affected modules and batches, open questions awaiting decision. Input for the wiring batches |
| [`ccut-timeline-json-spec.md`](ccut-timeline-json-spec.md) | Spec for v2 `timeline.json` 0.12 (chapter 19 of the v2 format spec): two-layer model, three clocks, element props, transitions, keyframes, solid-color canvas and ducking |
| [`ccut-edit-domain-design.md`](ccut-edit-domain-design.md) | v2 edit domain: source-level cut points (Cut), clips (Clip), overlay elements, element animation, derivation and projection, command surface. Main text in [`ccut-edit-domain-design/`](ccut-edit-domain-design/) |
| [`ccut-talking-head-cut-design.md`](ccut-talking-head-cut-design.md) | v2 talking-head cutting: proposed per-item states, suggestions coexisting with manual cuts, script selection sync, recovery and undo. Main text in [`ccut-talking-head-cut-design/`](ccut-talking-head-cut-design/) |
| [`ccut-element-geometry-panel-design.md`](ccut-element-geometry-panel-design.md) | v2 element geometry: percentages for `place`, short-edge base, pin alignment; template layer and elements unified |
| [`ccut-whiteboard-narration-sync-design.md`](ccut-whiteboard-narration-sync-design.md) | v2 whiteboard elements following narration beats: `pace`, `strict`, beat windows and word anchors |

v2 design docs that relate to this crate but belong to other modules (element render basics, motion render upgrade, confetti elements, the whiteboard animation itself, smart reframing) were not copied. They will come over when the corresponding module is ported.
