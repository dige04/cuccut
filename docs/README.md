# CucCut Documentation

CucCut is a source-available AI video agent: users delegate tasks in natural language, and the agent creates, edits and continuously revises videos. All results land in an editable video, and users can take over, refine and export at any time in a separate interface. For the license summary see the [root README](../README.md#许可), and for the formal terms see [LICENSE](../LICENSE).

This directory is the single source of truth for CucCut's product, architecture and format specifications. Each topic has one complete document, and each document starts with a table of contents. Read by jumping to the sections relevant to your task.

## Contents

| Document | Contents |
| --- | --- |
| [`product/product-design.md`](product/product-design.md) | **Product design**: positioning and scope, interfaces (Home / Space / Editor), tasks and conversation, autonomous execution and permissions, quality and delivery, twelve end-to-end workflows, requirements list, release roadmap and metrics |
| [`architecture/architecture-design.md`](architecture/architecture-design.md) | **System architecture design**: modules and state ownership, processes and lifecycle, Agent Harness, business protocol, storage, models, task scheduling, code runtime, rendering and export, dependency invalidation, client, security, code organization |
| [`spec/video-format-spec.md`](spec/video-format-spec.md) | **Video format specification**: time model, video and sequences, media and documents, speech and subtitles, talking-head editing, dubbing and language versions, portable package |
| [`spec/code-bundle-spec.md`](spec/code-bundle-spec.md) | **Code bundle specification**: manifest, instances, author contract, time dependencies and Bake for code composition bundles |
| [`spec/command-protocol-spec.md`](spec/command-protocol-spec.md) | **Command and protocol specification**: command envelope, edit transactions, receipts, time input, batch preflight, undo, events and error contract |
| [`spec/model-worker-protocol-spec.md`](spec/model-worker-protocol-spec.md) | **Model Worker protocol specification**: stdio messages between the Runtime and the local inference process, model package description, staging directory and the `cuccut.asr-result/v1` output contract |
| [`spec/node-protocol-spec.md`](spec/node-protocol-spec.md) | **Node protocol specification**: HTTP endpoints for LAN capability sharing, pairing and tokens, task and event streams, cleanup rules, and the `nodes` method of the local gateway |
| [`spec/template-spec.md`](spec/template-spec.md) | **Template package specification**: directory layout of Home creation templates, manifest fields and categories, covers and previews, assets, path and language constraints, brief guidance for scene templates |
| [`spec/pack-spec.md`](spec/pack-spec.md) | **Pack specification**: the pack folder and `pack.json`, limits, sources (folder, GitHub, https), the text scan, install rules and the active style guide |
| [`acceptance/acceptance-spec.md`](acceptance/acceptance-spec.md) | **Acceptance and testing**: test strategy, release gates, performance targets, acceptance matrix |
| [`acceptance/agent-surface-e2e.md`](acceptance/agent-surface-e2e.md) | **Agent surface end-to-end acceptance record**: conclusions, evidence locations, fixes and findings from the 2026-10-06 run in which Claude Code, via skill and MCP, went through the flow “link → transcription → self-translation → bilingual subtitles → export” |
| [`design/subtitle/`](design/subtitle/README.md) | **Subtitle and translation design (ported from v2)**: transcript post-processing, translation carriers, subtitle alignment and splitting, design records for subtitle export. The implementation is in `crates/speech-doc`. Data model names in the text refer to v2; for the mapping to v3 see architecture design §14 |
| [`design/brand/app-icon.md`](design/brand/app-icon.md) | **App icon design**: graphic composition, three-color palette and alternative variants, shape template, directions considered and rejected. The drawing source is in `tools/app-icon/` |
| [`design/timeline/`](design/timeline/README.md) | **Timeline semantics and element model (ported from v2)**: the v2 element model with an item-by-item comparison to the v3 video format (input for the wiring batches), and design records for the clip domain, talking-head cutting, element geometry and `timeline.json`. The implementation is in `crates/timeline`; data model names in the text refer to v2 |
| [`design/agent-surface/`](design/agent-surface/README.md) | **Capability surface for external Agents (proposal)**: design in which the CLI, MCP service and CucCut skill share one tool catalog; the command catalog for the Agent surface, CLI and MCP conventions, and the skill structure and implementation order |
| [`design/slides/`](design/slides/README.md) | **Slides in conversation (in progress)**: the agent makes decks within the conversation, the Slides editor in the feature area, and annotations sent back to the conversation as attachments; reimplementation of host capabilities, Runtime routing, the annotation protocol and phased implementation |
| [`design/canvas/`](design/canvas/README.md) | **Design boards in conversation**: the agent makes design boards (artboards) and design systems within the conversation, the editor in the feature area, and annotations sent back to the conversation as attachments. The index page points to where these behaviors are described in the product, architecture and protocol documents and in the runtime packages |
| [`glossary.md`](glossary.md) | **Glossary**: one word per concept |
| [`repo-conventions.md`](repo-conventions.md) | **Repository conventions**: top-level directories, code placement and file naming |
| [`development-workflow.md`](development-workflow.md) | **Development workflow**: keeping specs and implementation in sync, verification entry points, multi-platform sync, language and platform, workspaces and artifacts. Read the sections relevant to your task |
| [`macos-signing.md`](macos-signing.md) | **macOS signing and backup**: Developer ID identity, notarization credentials, cross-Mac recovery and GitHub Actions Secrets |

## Reading routes

| What you want to do | Read |
| --- | --- |
| Understand what CucCut is and what the first release does | Product design §1, §11 |
| Design or implement the interface | Product design §2–§5; architecture design §11 |
| Implement agent integration and tools | Architecture design §3–§4; product design §6–§7 |
| Implement the video engine and editing semantics | Video format spec §2–§4; command and protocol spec; architecture design §5 |
| Implement subtitles, translation, talking-head editing and dubbing | Video format spec §5–§7 |
| Implement code animation and rendering | Code bundle spec; architecture design §8–§10 |
| Implement model integration and long-running tasks | Architecture design §6–§7; Model Worker protocol spec |
| Implement LAN capability sharing | Architecture design §6.7, §12.7; node protocol spec |
| Implement external services (MCP service, model API, Web) | Architecture design §4.8, §12.8 |
| Implement the CLI, MCP tools or the CucCut skill (capability surface for external agents) | [`design/agent-surface/`](design/agent-surface/README.md); architecture design §3.5, §4.8 |
| Implement the user library, preference settings and cross-video search | Architecture design §5.9–§5.11 |
| Implement tool-page tasks, fixed flows and the various exports | Architecture design §7.9, §9.13 |
| Manage external tools, install actions and app updates | Architecture design §12.9, §2.6 |
| Implement the Home template library and add built-in templates | Template package spec; product design §3.2.1 |
| Write tests or decide whether a release can ship | Acceptance and testing |
| Create new files, packages or crates | Repository conventions |
| Verify changes, sync multiple platforms, handle dependencies or worktrees | Corresponding sections of the development workflow |

## Conventions for this document

### Normative terms

- **Must / must not**: hard constraint. A violation is a defect.
- **Should / should not**: default practice. A deviation must state its reason.
- **May**: an allowed choice.
- “Default” and “recommended value” are adjustable product parameters, not guarantees.

### Scope markers

| Marker | Meaning |
| --- | --- |
| P0 | Must be present in the first complete loop |
| P1 | Extended experience in the full version |
| P2 | Later scale and collaboration |
| G | Cross-phase constraint: applies to every feature already opened, not exempted by phase |

Dividing work into P0 / P1 does not authorize removing capabilities that are already stable. A feature that is not yet wired to the agent may keep a manual entry point, but the conversation must not claim that it can execute.

### Status of contracts

The types, interfaces, state machines and error codes in the documents are **target contracts**. DTO summaries are written in TypeScript syntax and do not represent a generated SDK or Schema. Performance figures are targets pending benchmark calibration. Acceptance items are definitions; execution status is maintained by test records.

Unknown source editability, unverified graphic consistency, a missing sandbox, and external billing of unclear status must not be hidden behind a single “success” state. This rule runs through all documents.

### ID scheme

| Prefix | Meaning | Defined in |
| --- | --- | --- |
| `AG` `UX` `SPC` `CON` `CRE` `EDT` `LNG` `AST` `COL` `AUT` `QUA` `OUT` `SET` `NFR` | Product requirements | Product design §10 |
| `S01`–`S12` | End-to-end workflows | Product design §9 |
| `R0`–`R4` | Release phases | Product design §11 |
| `0.1`–`0.4` | Starting versions: the split of R0 and the first half of R1 | Product design §11.1 |
| `D01`–`D14` | Key architecture decisions | Architecture design §1.6 |
| `TIME-01`–`TIME-08` | Time model rules | Video format spec §2.1 |
| `AT` `UI` `T` `A` `C` `M` `TM` | Acceptance items | Acceptance and testing §6 |

Once published, an ID is never reused and its meaning never changes. Deprecated items keep their number and are marked as deprecated.

### Version axes

The document version, `videoSchemaVersion`, `bundleSchemaVersion`, `adapterContractVersion`, `eventProtocolVersion`, `timeContractVersion`, `runtimeVersion` and `engineVersion` evolve independently of one another. “v1” in the text refers to the first-release data or execution contract. Details are in architecture design §13.3.

### Writing rules

- **One topic, one document.** Do not split by chapter into multiple files. Keep the table of contents at the top and section numbers stable. Cross-document references are written as “document name §section number”.
- **One fact, one place.** Each fact is defined in one place and referenced elsewhere. If the same passage would have to be written in two places, change one of them to a reference.
- **Integrate, don't append.** When behavior changes, rewrite the section that owns the topic; do not add a paragraph at the end.
- **Write rules, not process.** Documents describe what the system should be. They do not record discussion history, revision history or the source of trade-offs. History lives in git.
- **Placement rules:** user-visible behavior and scope → product design; services, processes and mechanisms → architecture design; persistent formats, DTOs and numeric rules → `spec/`; verifiable pass criteria → acceptance and testing.
- Items still awaiting review, experiment or user research confirmation go in the “Items pending review” chapter at the end of the document they belong to.
- Documents are written in Chinese; code identifiers, protocol fields and commands stay in English as they are. The product itself is language-agnostic: media, scripts, translations and dubbing can be in any language, and the languages in the examples are illustrative only.
