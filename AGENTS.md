# AGENTS.md

General rules for coding agents in CucCut. This document keeps only the global constraints and the reading entry points. Details are loaded per task, and the local `AGENTS.md` in a directory adds local constraints.

## Reading and language

- By default, reply in the language the user writes in. Code identifiers, commands and existing terms stay as they are.
- Locate the material with the table below first, then read 1–3 sections from the relevant docs directory. Next, read the target directory's README, its local `AGENTS.md` and adjacent tests. Do not read all of `docs/`.
- Keep the root file concise: no more than 80 lines and 6 KB. Put new details in the document they belong to, and state the trigger condition and link here without copying the body.

## On-demand reading

| When | What to read |
| --- | --- |
| Locate a module, run the project | [Root README](README.md); directory and dependency boundaries in [Repository conventions](docs/repo-conventions.md) |
| Create a new file, package or crate | [Repository conventions](docs/repo-conventions.md) (placement and naming) |
| Add or change code identifiers, enums, categories or result keys (must be in English) | [Repository conventions §3](docs/repo-conventions.md#3-naming) |
| Product, architecture, formats, protocols or domain behaviour | [Docs reading route](docs/README.md#reading-routes); choose the matching topic and section |
| Change the specs or other docs | [Documentation conventions](docs/README.md#conventions-for-this-document); [Development workflow §1](docs/development-workflow.md#1-specification-and-implementation) |
| Prepare to verify a change | [Development workflow §2](docs/development-workflow.md#2-verification); pass criteria in [Acceptance and testing](docs/acceptance/acceptance-spec.md) |
| Change user-visible UI (prototype first) | [Development workflow §3](docs/development-workflow.md#3-multi-surface-sync); icons in [Repository conventions §4](docs/repo-conventions.md#4-interface-icons) |
| Change a prototype | [Prototype README](designs/cuccut/README.md) → [Prototype local protocol](designs/cuccut/AGENTS.md) |
| Start or restart the design web page | [Prototype local protocol "HTTP preview"](designs/cuccut/AGENTS.md#http-预览) |
| Change prompts, language handling or platform-specific implementation | [Development workflow §4](docs/development-workflow.md#4-language-and-platform) |
| Change opening, locating or selecting files or directories, or other system integration | [Development workflow §4.1](docs/development-workflow.md#41-cross-platform-system-integration) |
| Add or change text meant for people (UI, errors, CLI output) | [Repository conventions §5](docs/repo-conventions.md#5-copy-and-multilingual-support); wording in the [Glossary](docs/glossary.md#english-ui-terms) |
| Change dependencies or generated outputs, or use worktrees | [Development workflow §5](docs/development-workflow.md#5-workspace-and-artifacts) |
| Review a run: find session records, tool-call arguments, artifacts | [Development workflow §5.3](docs/development-workflow.md#53-development-data-and-session-records) |

## General constraints

- When a protocol, format or public behaviour changes on purpose, implement it in the same task and update the matching spec and tests. If a conflict is found, state it explicitly; do not quietly change the spec to fit the implementation.
- UI changes: change only the prototype first and hand it to the user for confirmation. Only after confirmation, change Electron and Web ([Development workflow §3](docs/development-workflow.md#3-multi-surface-sync)). Then audit the corresponding features on all three surfaces and sync the applicable parts; where a feature has no counterpart, state why. Background changes that do not change user-visible behaviour do not trigger UI sync.
- Verify at the smallest scope that is still sufficient for the impact. For visual changes, check the actual page; for doc changes, check links, paths and commands. Do not write unexecuted checks as passed.
- Product capabilities must not assume Chinese or English. Language branches have explicit fallbacks, and platform-specific code is conditional. System integration must audit the capability differences between Windows / macOS and Web, and be verified per [Development workflow §4.1](docs/development-workflow.md#41-cross-platform-system-integration).
- When a dependency changes, sync the corresponding lockfile. Generated outputs follow the rules of the directory they belong to; temporary artifacts go in a temp directory outside the repository.

## Mandatory completion gate

Every implementation task that modifies files must create a git commit before the final reply.

- Before editing, check `git status`. Treat workspace changes that existed before the task, or appeared concurrently, as belonging to the user.
- Before committing, review the final diff and run verification proportional to the risk. Always report the checks actually run and any known skipped items.
- Stage only the files or hunks that belong to this task. After `git add`, re-check `git diff --cached`, and do not sneak in unrelated changes.
- On the current branch, use `type(scope): summary` per [commit classification](docs/development-workflow.md#11-commit-classification). Fixes of the same kind use one unified scope. Commit messages default to English, state the concrete change, and carry no sign-off lines. The final reply reports the commit hash.
- After finishing, create only a local commit and never push automatically (including force push). Pushing requires the user to explicitly ask for it for the current task; push authorization from an earlier task must not be carried over.
- Before merging a branch or worktree back into `main`, consolidate it into one or a few meaningful commits per [pre-merge commit cleanup](docs/development-workflow.md#12-commit-tidying-before-merge). Except for that cleanup or an explicit user request, do not amend or rewrite history. Read-only tasks and tasks with no file changes must not create empty commits.
- **No leftover worktrees:** a task done in a worktree (including a subagent's `.claude/worktrees/agent-*`) must, when finished, have that worktree and its branch deleted, along with its dedicated cargo target directory. Before deleting, choose one of two options: merge into `main`; or, if not merging, first commit any uncommitted changes to that branch, tag `archive/<worktree name>` to archive it, then run `git worktree remove` and `git branch -D`. The session that orchestrates subagents is responsible for cleaning up the worktrees it spawned. Any worktree that must be kept (pending the user's decision, or with an unresolved conflict) must be named with its path and reason in the final reply; do not leave it silently.
