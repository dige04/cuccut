/**
 * 把提示交给智能体会话的桥（docs/design/slides §4、§8.3）：运行时的 `chat.suggestPrompt` 在 iframe 里，会话的输入框在父窗口。
 *
 * 运行时在「让智能体修好这页」等处调 `suggestPrompt(prompt)`，这里转成 `editor:suggest-prompt` 发给父窗口；
 * 父窗口把提示放进这个会话的输入框，回 `editor:suggest-prompt-result`。没放进去（标签页不属于会话）或父窗口没回应时拒绝，
 * 运行时改为把提示复制到剪贴板。
 */
import type { ParentLink } from './comments-bridge.ts';
import type { HostChatCapability } from './slides-host.ts';

/** 父窗口多久没回应算没放进去。 */
const SUGGEST_TIMEOUT_MS = 5000;

export interface ChatBridge {
  capability: HostChatCapability;
  /** 停止收父窗口的消息，等着的都按没放进去处理。 */
  dispose(): void;
}

export function createChatBridge(link: ParentLink, newId: () => string = () => crypto.randomUUID(), timeoutMs = SUGGEST_TIMEOUT_MS): ChatBridge {
  const pending = new Map<string, (ok: boolean) => void>();
  const stop = link.onMessage(message => {
    if (message.type === 'editor:suggest-prompt-result') pending.get(message.requestId)?.(message.ok);
  });
  return {
    capability: {
      suggestPrompt: prompt =>
        new Promise<void>((resolve, reject) => {
          const requestId = newId();
          const settle = (ok: boolean) => {
            clearTimeout(timer);
            pending.delete(requestId);
            if (ok) resolve();
            else reject(new Error('the prompt was not put into a session'));
          };
          const timer = setTimeout(() => settle(false), timeoutMs);
          pending.set(requestId, settle);
          link.post({ type: 'editor:suggest-prompt', requestId, prompt });
        }),
    },
    dispose() {
      stop();
      for (const settle of [...pending.values()]) settle(false);
    },
  };
}
