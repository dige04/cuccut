import type { Id } from '@cuccut/protocol';
import { MessageSuggestion } from '@react-spectrum/ai';
import AIMark from '@react-spectrum/s2/icons/AIMark';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { THREAD_EMPTY_COPY } from '../../copy.ts';
import { useContextTag } from '../../state/agent-context.ts';
import { useShell } from '../../state/shell-store.ts';
import { focusPromptEnd } from '../use-prompt-value.ts';

/** Prototype ui.css `.ath__empty` :2755-2761, spectrum.css `.cc-ai-suggestions` :26. */
const empty = style({
  boxSizing: 'border-box',
  width: 'full',
  maxWidth: 560,
  marginX: 'auto',
  paddingTop: 56,
  paddingX: 24,
  paddingBottom: 24,
  textAlign: 'center',
});
const glyph = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  size: 48,
  borderRadius: '[10px]',
  backgroundColor: 'blue-200',
  color: 'blue-1000',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const greet = style({ marginTop: 16, marginBottom: 0, font: 'heading-sm', color: 'gray-900' });
const sub = style({ marginTop: 8, marginBottom: 0, font: 'body', color: 'gray-600' });
const suggestions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 });

/**
 * Empty session (prototype agent-thread.jsx `AgentThread` empty state :461-475): a session that exists but has no messages yet. The start page for new sessions (start-page.tsx) has its own version, which is not here. When the editor has open the video that this session's source refers to, the greeting includes the video's name, and the suggestions switch to the editor group (the prototype picks `agent.chips.editor` / `agent.chips.home` by `cur.project`). Clicking a suggestion writes it into this session's draft (replacing the existing draft, same as the prototype's `patch({draft})`) and puts the cursor at the end of the input box.
 *
 * The prototype uses `MessageSuggestionList aria-label="试着问问"` (“试着问问”, Try asking). S2 AI's MessageSuggestionList requires a `title` and renders it as a visible h3, but the prototype shows no title, so here a group with `aria-label` wraps MessageSuggestion, laid out the same way (wrapping, gap 8).
 * `folderOf`: the id of another session that shares the working directory with this one; the source is recognised by it.
 */
export function ThreadEmpty({ conversationId, projectId, folderOf }: { conversationId: Id; projectId: Id | null; folderOf?: Id }) {
  const tag = useContextTag({ conversationId: folderOf ?? conversationId, projectId });
  const videoName = tag?.videoName || null;
  const chips = videoName ? THREAD_EMPTY_COPY.chipsVideo : THREAD_EMPTY_COPY.chips;

  const pick = (text: string) => {
    useShell.getState().setDraft(conversationId, text);
    requestAnimationFrame(() => focusPromptEnd(document.querySelector(`[data-composer="${CSS.escape(conversationId)}"]`)));
  };

  return (
    <div className={empty}>
      <span className={glyph} data-cc-icons="primary" aria-hidden>
        <AIMark />
      </span>
      <h2 className={greet}>{videoName ? THREAD_EMPTY_COPY.greetVideo(videoName) : THREAD_EMPTY_COPY.greet}</h2>
      <p className={sub}>{videoName ? THREAD_EMPTY_COPY.subVideo : THREAD_EMPTY_COPY.sub}</p>
      <div className={suggestions} data-cc-suggestions="" role="group" aria-label={THREAD_EMPTY_COPY.suggestions}>
        {chips.map((chip) => (
          <MessageSuggestion key={chip} onPress={() => pick(chip)}>
            {chip}
          </MessageSuggestion>
        ))}
      </div>
    </div>
  );
}
