# docs/design/canvas/ — Design drafts in the session

In the session, the agent makes a design draft (several artboards on a canvas: UI, web pages, posters, charts) or a design system. The draft is previewed and edited in the feature area with the editor, and annotations are sent back to the session as attachments. The editor is a ported Claude Design runtime; host capabilities share one implementation with slides ([Slide design](../slides/slides-design.md)).

These behaviours are described in the following places:

| Content | Location |
| --- | --- |
| Design-draft and design-system annotations in the input box | [Product design §3.2.3](../../product/product-design.md#323-input-area) |
| Design-draft tabs and export in the feature area | [Product design §3.3](../../product/product-design.md#33-feature-area-ux-07) |
| Annotations handed to the agent with the message, editor sync before sending, isolation of the web editor, design-draft entries in Space | [Architecture design](../../architecture/architecture-design.md) §3.4, §4.6, §4.8, §5.7 |
| `design.open`, `designSystem.open` and annotation fields | [Command protocol §4.1](../../spec/command-protocol-spec.md#41-methods) |
| Editor runtime and CucCut changes | [`packages/design-runtime`](../../../packages/design-runtime/README.md), [`packages/design-system-runtime`](../../../packages/design-system-runtime/README.md) |
| Acceptance | [Acceptance and testing](../../acceptance/acceptance-spec.md) UI-11–UI-13 |

The implementation lives in `packages/design` (layout, checks, host shim), `packages/design-system`, `packages/design-runtime` / `packages/design-system-runtime` (runtime source) and `apps/design-editor` / `apps/design-system-editor` (builds of the editor pages).
