/**
 * Bridge that hands prompts to the agent session (docs/design/slides §4, §8.3). The runtime's `chat.suggestPrompt` runs in the iframe, while the session's input box is in the parent window.
 *
 * The runtime calls `suggestPrompt(prompt)` at places such as “让智能体修好这页” (“have the agent fix this page”). Here it is converted to `editor:suggest-prompt` and sent to the parent window; the parent puts the prompt into this session's input box and replies with `editor:suggest-prompt-result`. If it was not put in (the tab does not belong to the session) or the parent does not reply, this rejects, and the runtime copies the prompt to the clipboard instead.
 */
import type { ParentLink } from './comments-bridge.ts';
import type { HostChatCapability } from './slides-host.ts';

/** How long to wait for the parent window's reply before counting the prompt as not put in. */
const SUGGEST_TIMEOUT_MS = 5000;

export interface ChatBridge {
  capability: HostChatCapability;
  /** Stops listening for parent window messages; all waiting calls are treated as not put in. */
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
