<!-- surface: cli -->
# 走 MCP

用 `cuccut mcp install --agent <宿主>` 接上；工具名与 CLI 命令一一对应：

<!-- generated: tool-map -->
| MCP 工具 | CLI 命令 | 效果 |
| --- | --- | --- |
| `assets_import` | `cuccut assets import` | mutation |
| `captions_create` | `cuccut captions create` | mutation |
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
| `projects_list` | `cuccut projects list` | query |
| `skills_list` | `cuccut skills list` | query |
| `skills_read` | `cuccut skills read` | query |
| `space_list` | `cuccut space list` | query |
| `space_search` | `cuccut space search` | query |
| `speak` | `cuccut speak` | job |
| `transcribe` | `cuccut transcribe` | job |
| `translate` | `cuccut translate` | job |
| `videos_create` | `cuccut videos create` | mutation |
| `videos_frames` | `cuccut videos frames` | mutation |
| `videos_history` | `cuccut videos history` | query |
| `videos_inspect` | `cuccut videos inspect` | query |
| `videos_list` | `cuccut videos list` | query |

只在 CLI 里、MCP 上没有的：`cuccut artifacts save`、`cuccut models install`、`cuccut models test`、`cuccut projects create`、`cuccut transcode`、`cuccut videos delete`、`cuccut videos import-package`。
<!-- /generated -->
<!-- /surface -->
