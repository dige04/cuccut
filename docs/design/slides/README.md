# docs/design/slides/ — 会话里的幻灯片

在会话里让智能体做一份幻灯片（deck），在功能区用 Slides 编辑器预览、编辑，并把对幻灯片的标注作为附件发回会话。编辑器是移植来的 Slides 运行时，宿主能力（文件、素材、用户、标注、外部改动）由 Runtime 与界面重新实现（[架构设计 §3.5](../../architecture/architecture-design.md#35-工具目录)、[§4.8](../../architecture/architecture-design.md#48-对外服务)）。

| 文件 | 内容与状态 |
| --- | --- |
| [`slides-design.md`](slides-design.md) | **实施中（2026-10-10，第 2 到 5 阶段已实现）**：四项决定（运行时入库、截图、Web 范围、素材地址）；deck 的磁盘格式与运行时 URL 的映射；宿主能力逐项对照（`db` 不需要、`room` 不做）；Runtime 的 `slides.open` 与幻灯片路由、发布的乐观并发、素材、外部改动；skill 与 `slides_check` / `slides_import_asset`；功能区幻灯片标签与标注流程；标注附件的协议；要修订的规范与分阶段实施 |

实现在 `packages/slides`（协议、存储、路由、宿主 shim）、`packages/slides-runtime`（运行时源码，D1）与 `apps/slides-editor`（编辑器页面的构建），借鉴自 Claude Slides 的实现。
