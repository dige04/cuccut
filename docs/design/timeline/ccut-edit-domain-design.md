> Ported from CucCut v2. The data model names used in this text (timeline.json, Element, Source / Clip / Cut, etc.) refer to the v2 model. For how they map to v3 sequences, tracks and instances, see the [element model mapping](element-model-mapping.md) and [Architecture design §14](../../architecture/architecture-design.md#14-items-pending-review).

# CucCut Clip-Domain Protocol Design (Cut / Clip / Element / Watermark / Project Export)

Status: implementation complete, v0.5 (2026-08-02; E0–E4 are implemented in the repository and regression-tested, and one full audit pass has fixed the semantic gaps. The client integration boundary and remaining gaps are recorded honestly in §9/§11. Opening the project in external NLEs on real hardware belongs to release-candidate acceptance.)
Scope: add the clip domain to `.ccut` product projects: media-level cutting (Cut), timeline arrangement (Clip), overlay elements (B-roll / text / watermark / on-screen text), element animation, full-overlay burn-in of the finished video, project export to six NLE targets including CapCut, backfilling clip data for old projects, and skill clip-surface regression. This document also records the clip-domain continuation of [ccut-mac-app-port-design.md](../../archive/mac/ccut-mac-app-port-design.md) and its implemented contract.

Related documents:
[Format spec (BCF 0.1 / Project / Transcript v0.3)](../bcf/cuccut-format-spec.md) ·
[CLI and Agent protocol](ccut-cli-design.md) ·
[Studio Web and serve](ccut-studio-web-implementation.md) ·
[Mac App port](../../archive/mac/ccut-mac-app-port-design.md)

---

## Contents

This document has been split by chapter (2026-09-10). The body is under [`ccut-edit-domain-design/`](ccut-edit-domain-design/), one chapter per file. Chapters that are too long are further split into subdirectories by section (the `README.md` in a subdirectory is that chapter's introduction and section index). References written as "§N" still mean chapter N in the table below. When changing a section, edit the file that holds it. For a new chapter, create a new file and add a line here. **Do not write the body back into this file.**

- [1. Background and decision baseline](ccut-edit-domain-design/01.md)
- [2. Overall architecture](ccut-edit-domain-design/02.md)
- [3. timeline.json data model](ccut-edit-domain-design/03.md)
- [4. Derivation and projection](ccut-edit-domain-design/04.md)
- [5. Command surface and serve](ccut-edit-domain-design/05.md)
- [6. Export](ccut-edit-domain-design/06.md)
- [7. Backfilling clip data for old projects](ccut-edit-domain-design/07.md)
- [8. Skill clip-surface regression](ccut-edit-domain-design/08.md)
- [9. Milestones](ccut-edit-domain-design/09.md)
- [10. Revisions to existing documents (landed with E0)](ccut-edit-domain-design/10.md)
- [11. Open questions and risks](ccut-edit-domain-design/11.md)
