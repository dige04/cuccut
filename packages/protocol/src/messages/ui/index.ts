/**
 * `packages/ui` 发出、随命令落盘的文字（message-ref.ts），目前是编辑事务的修改名。每个区域一个 `<区域>.ts` 与它的译文
 * `<区域>.zh-Hans.ts`，在这里 export 登记。包外按 `@cuccut/protocol/messages/ui` 引用。
 */
export * from './edit-label.ts';
