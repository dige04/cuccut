# docs/design/agent-surface/ — Capability surface for external agents

Design of the three things through which CucCut exposes its capabilities to other agents: the command-line `cuccut`, an outward-facing MCP service, and the CucCut skill that teaches external agents to use them. Mechanically, all three share the tool catalog in the Runtime ([architecture design §3.5](../../architecture/architecture-design.md#35-tool-catalog), [§4.8](../../architecture/architecture-design.md#48-external-services)).

| File | Content and status |
| --- | --- |
| [`agent-surface-design.md`](agent-surface-design.md) | **Proposal (2026-10-06, not implemented)**: the CLI becomes the third consumer of the tool catalog; `LocalPrincipal` and the permission comparison across the three principal kinds; the Agent-facing catalog of top-level verbs + noun groups + meta-commands, and the mapping rule between MCP `a_b` and CLI `a b`; CLI envelope, exit codes, `--wait`, spilling large results to disk and Runtime ownership; the MCP open list and `jobs_wait`; what becomes of existing CLI commands; the structure of the instruction set `skills/cuccut/` and the SKILL.md outline; spec entries to revise and the phased implementation order |

The corresponding v2 designs (the `ccut` CLI and skill) live in the cuccut-app repository under `docs/design/cli/` and `skills/cuccut/`. They are for reference only and are not compatible.
