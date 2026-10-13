import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorToHostMessage, HostToEditorMessage } from '../editor-messages.ts';
import { createChatBridge } from './chat-bridge.ts';
import type { ParentLink } from './comments-bridge.ts';

function fakeLink() {
  const sent: EditorToHostMessage[] = [];
  const listeners = new Set<(message: HostToEditorMessage) => void>();
  const link: ParentLink = {
    post: message => sent.push(message),
    onMessage: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const deliver = (message: HostToEditorMessage) => listeners.forEach(l => l(message));
  return { link, sent, deliver, listeners };
}

afterEach(() => vi.useRealTimers());

describe('createChatBridge', () => {
  it('suggestPrompt sent to the parent window; fulfilled once the parent puts it in the input box', async () => {
    const parent = fakeLink();
    const chat = createChatBridge(parent.link, () => 'p1');
    const done = chat.capability.suggestPrompt('Fix slide 2');
    expect(parent.sent).toEqual([{ type: 'editor:suggest-prompt', requestId: 'p1', prompt: 'Fix slide 2' }]);
    // Responses to other requests do not count
    parent.deliver({ type: 'editor:suggest-prompt-result', requestId: 'other', ok: true });
    parent.deliver({ type: 'editor:suggest-prompt-result', requestId: 'p1', ok: true });
    await expect(done).resolves.toBeUndefined();
  });

  it('rejected when the parent can\'t put it in or doesn\'t respond (at runtime it is changed to copy to clipboard)', async () => {
    vi.useFakeTimers();
    const parent = fakeLink();
    let n = 0;
    const chat = createChatBridge(parent.link, () => `p${++n}`, 1000);
    const refused = chat.capability.suggestPrompt('a');
    parent.deliver({ type: 'editor:suggest-prompt-result', requestId: 'p1', ok: false });
    await expect(refused).rejects.toThrow();
    const silent = chat.capability.suggestPrompt('b');
    vi.advanceTimersByTime(1000);
    await expect(silent).rejects.toThrow();
  });

  it('dispose stops receiving messages; pending ones rejected', async () => {
    const parent = fakeLink();
    const chat = createChatBridge(parent.link, () => 'p1');
    const waiting = chat.capability.suggestPrompt('a');
    chat.dispose();
    expect(parent.listeners.size).toBe(0);
    await expect(waiting).rejects.toThrow();
  });
});
