<!-- surface: cli -->
# Over MCP

Connect with `cuccut mcp install --agent <host>`; tool names map one to one onto CLI commands:

<!-- generated: tool-map -->
| MCP tool | CLI command | Effect |
| --- | --- | --- |
| `assets_import` | `cuccut assets import` | mutation |
| `assets_prune` | `cuccut assets prune` | mutation |
| `captions_create` | `cuccut captions create` | mutation |
| `chapters_adopt` | `cuccut chapters adopt` | mutation |
| `compositions_import` | `cuccut compositions import` | mutation |
| `compositions_preview` | `cuccut compositions preview` | mutation |
| `documents_put` | `cuccut documents put` | mutation |
| `documents_read` | `cuccut documents read` | query |
| `download` | `cuccut download` | job |
| `dub` | `cuccut dub` | job |
| `edits_apply` | `cuccut edits apply` | mutation |
| `edits_ops` | `cuccut edits ops` | query |
| `edits_undo` | `cuccut edits undo` | mutation |
| `export` | `cuccut export` | job |
| `image` | `cuccut image` | job |
| `jobs_cancel` | `cuccut jobs cancel` | mutation |
| `jobs_inspect` | `cuccut jobs inspect` | query |
| `jobs_list` | `cuccut jobs list` | query |
| `jobs_retry` | `cuccut jobs retry` | job |
| `jobs_wait` | `cuccut jobs wait` | query |
| `library_list` | `cuccut library list` | query |
| `library_show` | `cuccut library show` | query |
| `models_capabilities` | `cuccut models capabilities` | query |
| `models_list` | `cuccut models list` | query |
| `music` | `cuccut music` | job |
| `projects_list` | `cuccut projects list` | query |
| `skills_list` | `cuccut skills list` | query |
| `skills_read` | `cuccut skills read` | query |
| `space_list` | `cuccut space list` | query |
| `space_search` | `cuccut space search` | query |
| `speak` | `cuccut speak` | job |
| `transcribe` | `cuccut transcribe` | job |
| `translate` | `cuccut translate` | job |
| `videos_create` | `cuccut videos create` | mutation |
| `videos_derive` | `cuccut videos derive` | mutation |
| `videos_frames` | `cuccut videos frames` | mutation |
| `videos_history` | `cuccut videos history` | query |
| `videos_inspect` | `cuccut videos inspect` | query |
| `videos_list` | `cuccut videos list` | query |
| `videos_shots` | `cuccut videos shots` | query |

Only in the CLI, not on MCP: `cuccut artifacts save`, `cuccut models install`, `cuccut models test`, `cuccut projects create`, `cuccut transcode`, `cuccut videos delete`, `cuccut videos import-package`.
<!-- /generated -->
<!-- /surface -->
