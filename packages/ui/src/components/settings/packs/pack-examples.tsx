import { useEffect, useId, useState } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { PACK_LIMITS, type PackDetail, type PackExampleView } from '@cuccut/protocol';
import { Check, File, Film, Image as ImageIcon, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../cc/ui/button.tsx';
import { Input } from '../../../cc/ui/input.tsx';
import { Textarea } from '../../../cc/ui/textarea.tsx';
import {
  exampleAddReason,
  exampleEditState,
  exampleExtensions,
  exampleLabel,
  exampleStillNote,
  exampleStillPath,
  packErrorMessage,
} from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { addPackExample, forgetPackFile, packFileUrl, removePackExample, restorePackExample, updatePackExample } from '../../../runtime/pack-commands.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { ErrorLine } from './packs-ui.tsx';

const S = () => PACKS_COPY.style;

/**
 * A pack's reference videos on its page (pack design §2.5, agentcut `StyleEditor` examples): what a finished video in
 * this style looks like, each with its still, a title and what to take from it. Agents open the stills, so a video
 * without one (no ffmpeg) says so.
 *
 * Each row saves its own title and note; Remove acts at once and the toast offers Undo (`packs.restoreExample`). The
 * form below adds an image or video from this computer. None of these is tinted: the page's one tinted action is "Save
 * guide", when there is a change to save. In a browser the references are shown read-only.
 */
export function PackExamples({ detail, web, onChange }: { detail: PackDetail; web: boolean; onChange(detail: PackDetail): void }) {
  const id = useId();
  const packId = detail.pack.id;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h4 id={`${id}-title`} className="m-0 text-sm font-medium text-foreground">
          {S().references}
        </h4>
        <p className="m-0 text-xs text-muted-foreground">{S().referencesHint}</p>
      </div>
      {detail.examples.length ? (
        <ul aria-labelledby={`${id}-title`} className="m-0 flex list-none flex-col gap-2 p-0">
          {detail.examples.map((example) => (
            <ExampleRow key={`${example.file}\n${example.title}\n${example.note}\n${example.still ?? ''}`} packId={packId} example={example} web={web} onChange={onChange} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{S().noReferences}</p>
      )}
      {web ? <p className="m-0 text-xs text-muted-foreground">{S().webExamples}</p> : <AddExample packId={packId} count={detail.examples.length} onChange={onChange} />}
    </div>
  );
}

/** One reference: its still (or why there is none), then its title and note, editable on the desktop. */
function ExampleRow({ packId, example, web, onChange }: { packId: string; example: PackExampleView; web: boolean; onChange(detail: PackDetail): void }) {
  const runtime = useRuntime();
  const id = useId();
  const [title, setTitle] = useState(example.title);
  const [note, setNote] = useState(example.note);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = exampleLabel(example);
  const state = exampleEditState(example, title, note);
  const canSave = busy === null && state.reason === null;

  const save = async () => {
    if (!canSave) return;
    setBusy('save');
    setError(null);
    try {
      onChange(await updatePackExample(runtime, packId, example.file, { title, note }));
      ToastQueue.positive(S().exampleSaved, { timeout: 4000 });
    } catch (reason) {
      setError(packErrorMessage(reason, 'saveExample'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      const result = await removePackExample(runtime, packId, example);
      onChange(result);
      ToastQueue.neutral(S().exampleRemoved(label), {
        timeout: 8000,
        actionLabel: PACKS_COPY.pack.undo,
        shouldCloseOnAction: true,
        onAction: () => {
          restorePackExample(runtime, packId, result.trashId).then(
            (restored) => {
              onChange(restored);
              ToastQueue.positive(S().exampleRestored(label), { timeout: 4000 });
            },
            (reason: unknown) => ToastQueue.negative(packErrorMessage(reason, 'restoreExample'), { timeout: 8000 }),
          );
        },
      });
    } catch (reason) {
      setError(packErrorMessage(reason, 'removeExample'));
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.04] p-3 @md:flex-row">
      <Still packId={packId} example={example} label={label} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {web ? (
          <>
            <span className="text-sm text-foreground [overflow-wrap:anywhere]">{label}</span>
            {example.note ? <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{example.note}</span> : null}
          </>
        ) : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}>
            <label className="sr-only" htmlFor={`${id}-title`}>
              {S().exampleTitle}
            </label>
            <Input
              id={`${id}-title`}
              value={title}
              placeholder={S().exampleTitle}
              onChange={(event) => setTitle(event.target.value)}
              aria-describedby={`${id}-why`}
            />
            <label className="sr-only" htmlFor={`${id}-note`}>
              {S().exampleNote}
            </label>
            <Textarea
              id={`${id}-note`}
              value={note}
              rows={2}
              placeholder={S().exampleNote}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`${id}-why`}
              className="min-h-14"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" variant="outline" disabled={!canSave} title={state.reason ?? undefined}>
                {busy === 'save' ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Check aria-hidden />}
                {busy === 'save' ? S().exampleSaving : S().exampleSave}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void remove()}>
                {busy === 'remove' ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Trash2 aria-hidden />}
                {S().exampleRemove}
              </Button>
              {/* Why Save is off: shown when a field is too long, read out otherwise. */}
              <span id={`${id}-why`} className={state.changed && state.reason ? 'text-xs text-destructive' : 'sr-only'}>
                {state.reason ?? ''}
              </span>
            </div>
          </form>
        )}
        <span className="font-mono text-[0.7rem] text-muted-foreground/80 [overflow-wrap:anywhere]">{example.file}</span>
        <ErrorLine>{error}</ErrorLine>
      </div>
    </li>
  );
}

/** The picture an agent opens: the image itself or the video's still, through a read handle; a video without one says why. */
function Still({ packId, example, label }: { packId: string; example: PackExampleView; label: string }) {
  const runtime = useRuntime();
  const path = exampleStillPath(example);
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    packFileUrl(runtime, packId, path).then(
      (next) => !cancelled && setUrl({ path, url: next }),
      () => !cancelled && setFailed(path),
    );
    return () => {
      cancelled = true;
    };
  }, [runtime, packId, path]);

  const Icon = example.kind === 'video' ? Film : ImageIcon;
  const note = exampleStillNote(example) ?? (path && failed === path ? S().stillMissing : null);
  const shown = path && url?.path === path && failed !== path ? url.url : null;
  return (
    <div className="flex w-full shrink-0 flex-col gap-1.5 @md:w-48">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/5">
        {shown ? (
          <img
            src={shown}
            alt={S().stillAlt(label)}
            className="size-full object-contain"
            onError={() => {
              forgetPackFile(packId, path!);
              setFailed(path);
            }}
          />
        ) : (
          <Icon aria-hidden className="size-6 text-muted-foreground" />
        )}
        <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] text-foreground/90">
          <Icon aria-hidden className="size-3" />
          {S().kind[example.kind]}
        </span>
      </div>
      {note ? <p className="m-0 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** The form that adds a reference from this computer: a path (typed or picked), a title and what to take from it. */
function AddExample({ packId, count, onChange }: { packId: string; count: number; onChange(detail: PackDetail): void }) {
  const runtime = useRuntime();
  const id = useId();
  const pickFiles = runtime.host.pickFiles?.bind(runtime.host);
  const [draft, setDraft] = useState({ path: '', title: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = exampleAddReason(draft, count);
  const full = count >= PACK_LIMITS.examples;

  const pick = async () => {
    if (!pickFiles) return;
    const [picked] = await pickFiles({
      title: S().pickTitle,
      buttonLabel: S().pickButton,
      filters: [{ name: S().pickFilter, extensions: exampleExtensions() }],
    });
    if (picked) {
      setDraft((d) => ({ ...d, path: picked }));
      setError(null);
    }
  };

  const add = async () => {
    if (busy || reason !== null) return;
    setBusy(true);
    setError(null);
    try {
      const next = await addPackExample(runtime, packId, draft);
      onChange(next);
      const added = next.examples[next.examples.length - 1];
      ToastQueue.positive(S().added(added ? exampleLabel(added) : draft.title || draft.path), { timeout: 4000 });
      setDraft({ path: '', title: '', note: '' });
    } catch (failure) {
      setError(packErrorMessage(failure, 'addExample'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-2 rounded-2xl p-3 ring-1 ring-foreground/10"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}>
      <p id={`${id}-heading`} className="m-0 text-sm font-medium text-foreground">
        {S().addTitle}
      </p>
      <label htmlFor={`${id}-file`} className="sr-only">
        {S().addFile}
      </label>
      <div className="flex flex-col gap-2 @md:flex-row">
        <Input
          id={`${id}-file`}
          value={draft.path}
          spellCheck={false}
          autoComplete="off"
          disabled={full}
          placeholder={S().addFilePlaceholder}
          className="min-w-0 flex-1 font-mono text-xs md:text-xs"
          onChange={(event) => {
            setDraft({ ...draft, path: event.target.value });
            setError(null);
          }}
        />
        {pickFiles ? (
          <Button type="button" variant="outline" disabled={busy || full} title={full ? (reason ?? undefined) : undefined} onClick={() => void pick()}>
            <File aria-hidden />
            {S().chooseFile}
          </Button>
        ) : null}
      </div>
      <label htmlFor={`${id}-title`} className="sr-only">
        {S().exampleTitle}
      </label>
      <Input id={`${id}-title`} value={draft.title} disabled={full} placeholder={S().exampleTitle} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      <label htmlFor={`${id}-note`} className="sr-only">
        {S().exampleNote}
      </label>
      <Textarea
        id={`${id}-note`}
        value={draft.note}
        rows={2}
        disabled={full}
        placeholder={S().exampleNote}
        className="min-h-14"
        onChange={(event) => setDraft({ ...draft, note: event.target.value })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={busy || reason !== null} title={reason ?? undefined} aria-describedby={`${id}-why`}>
          {busy ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Plus aria-hidden />}
          {busy ? S().adding : S().add}
        </Button>
        {/* The pack being full is worth saying out loud; "choose a file first" is for screen readers. */}
        <span id={`${id}-why`} className={full || (reason && draft.path.trim()) ? 'text-xs text-muted-foreground' : 'sr-only'}>
          {reason ?? ''}
        </span>
      </div>
      <ErrorLine>{error}</ErrorLine>
    </form>
  );
}
