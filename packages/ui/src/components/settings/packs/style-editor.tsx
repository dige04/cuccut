import { useEffect, useId, useState } from 'react';
import type { PackDetail, PackExampleView } from '@cuccut/protocol';
import { Check, Film, Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '../../../cc/ui/button.tsx';
import { Textarea } from '../../../cc/ui/textarea.tsx';
import { packErrorMessage, styleEditorState } from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { setPackStyle } from '../../../runtime/pack-commands.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { PanelHeading } from '../settings-ui.tsx';
import { ErrorLine } from './packs-ui.tsx';

const S = () => PACKS_COPY.style;

/**
 * A pack's style guide on its page (pack design §2.5, agentcut `StyleEditor`): the guide in a recessed monospace field
 * with its count against the limit, and the reference videos that show the style. "Save guide" is the view's one tinted
 * action, and only while there is a change to save; otherwise the page has none. Saving runs the same `packs.setStyle`
 * as `cuccut packs style`, with the digest the page read, so a guide saved elsewhere meanwhile is not overwritten. A
 * refused save names the flagged line. In a browser the guide is shown read-only and the field says why.
 *
 * Reference videos are listed here; adding, editing and removing them is the reference-file editor's job.
 */
export function StyleEditor({ detail, web, onSaved }: { detail: PackDetail; web: boolean; onSaved(detail: PackDetail): void }) {
  const runtime = useRuntime();
  const id = useId();
  const saved = detail.style?.text ?? '';
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  // A newer guide from the Runtime (saved here or reloaded) replaces the field.
  useEffect(() => setText(saved), [saved]);

  const state = styleEditorState(text, saved);
  const canSave = !web && !busy && state.reason === null;
  const note = web ? S().webReadOnly : state.over ? state.reason : text === '' && saved !== '' ? S().emptyRemoves : null;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const next = await setPackStyle(runtime, detail.pack.id, text, detail.style?.hash ?? undefined);
      setNotice(next.style ? S().saved : S().removed);
      onSaved(next);
    } catch (reason) {
      setError(packErrorMessage(reason, 'saveStyle'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <PanelHeading title={<span id={`${id}-title`}>{S().title}</span>} hint={S().lede} />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-text`} className="sr-only">
          {S().textLabel}
        </label>
        <Textarea
          id={`${id}-text`}
          value={text}
          rows={10}
          readOnly={web}
          placeholder={S().placeholder}
          aria-invalid={state.over || undefined}
          aria-describedby={`${id}-count ${id}-why`}
          onChange={(event) => {
            setText(event.target.value);
            setNotice('');
          }}
          className="max-h-[28rem] min-h-40 overflow-y-auto font-mono text-xs leading-relaxed md:text-xs"
        />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id={`${id}-count`} className={cn('text-xs tabular-nums', state.over ? 'text-destructive' : 'text-muted-foreground')}>
              {state.count}
            </span>
            {/* Why Save is off (or what it will do) where the eye is when it is not obvious; "nothing changed" goes to screen readers only. */}
            <span id={`${id}-why`} className={note ? 'text-xs text-muted-foreground' : 'sr-only'}>
              {note ?? state.reason ?? ''}
            </span>
          </div>
          {web ? null : (
            <Button
              size="sm"
              variant={state.changed ? 'default' : 'outline'}
              disabled={!canSave}
              title={state.reason ?? undefined}
              onClick={() => void save()}>
              {busy ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Check aria-hidden />}
              {busy ? S().saving : S().save}
            </Button>
          )}
        </div>
        <p role="status" className={notice ? 'm-0 text-xs text-muted-foreground' : 'sr-only'}>
          {notice}
        </p>
        <ErrorLine>{error}</ErrorLine>
      </div>
      <References examples={detail.examples} />
    </section>
  );
}

/** The reference files: what a finished video in this style looks like, and what to take from it. */
function References({ examples }: { examples: PackExampleView[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="m-0 text-sm font-medium text-foreground">{S().references}</h4>
      {examples.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {examples.map((example) => {
            const Icon = example.kind === 'video' ? Film : ImageIcon;
            return (
              <li key={example.file} className="flex items-start gap-3 rounded-2xl bg-foreground/[0.04] px-3 py-2.5">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-foreground [overflow-wrap:anywhere]">{example.title || example.file}</span>
                  {example.note ? <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{example.note}</span> : null}
                  <span className="font-mono text-[0.7rem] text-muted-foreground/80 [overflow-wrap:anywhere]">{example.file}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{S().noReferences}</p>
      )}
    </div>
  );
}
