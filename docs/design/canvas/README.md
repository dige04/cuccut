# docs/design/canvas/ — 会话里的设计稿

在会话里让智能体做一份设计稿（画布上的若干画板：界面、网页、海报、图表）或一套设计系统，在功能区用编辑器预览、编辑，并把标注作为附件发回会话。编辑器是移植来的 Claude Design 运行时，宿主能力与幻灯片共用一套实现（[幻灯片设计](../slides/slides-design.md)）。

这些行为写在下面几处：

| 内容 | 位置 |
| --- | --- |
| 输入框里的设计稿标注与设计系统标注 | [产品设计 §3.2.3](../../product/product-design.md#323-输入区) |
| 功能区的设计稿标签、导出 | [产品设计 §3.3](../../product/product-design.md#33-功能区ux-07) |
| 标注随消息交给智能体、发送前同步编辑器、Web 端编辑器的隔离、Space 里的设计稿条目 | [架构设计](../../architecture/architecture-design.md) §3.4、§4.6、§4.8、§5.7 |
| `design.open`、`designSystem.open` 与标注字段 | [命令协议 §4.1](../../spec/command-protocol-spec.md#41-方法) |
| 编辑器运行时与 CucCut 的改动 | [`packages/design-runtime`](../../../packages/design-runtime/README.md)、[`packages/design-system-runtime`](../../../packages/design-system-runtime/README.md) |
| 验收 | [验收与测试](../../acceptance/acceptance-spec.md) UI-11–UI-13 |

实现放在 `packages/design`（布局、检查、宿主 shim）、`packages/design-system`、`packages/design-runtime` / `packages/design-system-runtime`（运行时源码）与 `apps/design-editor` / `apps/design-system-editor`（编辑器页面的构建）。
