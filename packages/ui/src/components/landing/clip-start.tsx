import { useId, useRef, useState } from 'react';
import { ArrowRight, FileVideo, FolderOpen, Link2, Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { mediaKindOf } from '../../model/new-flow.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Input } from '../../cc/ui/input.tsx';
import { Label } from '../../cc/ui/label.tsx';
import { clipSourceError, normalizeClipSource } from './clip-source.ts';
import { LANDING_COPY } from './landing-copy.ts';

/**
 * "Clip a long video" (agentcut `ClippingStart`): a dashed drop card with a link-or-path field, Add, and a file
 * chooser. It starts an ordinary session with a prefilled request to find clips: a link goes into the message (the
 * agent fetches it with the download tool), a local file rides along as an asset, the same way the composer sends it.
 * `blocked` is why no session can start yet (no agent ready); the card says so instead of doing nothing.
 */
export function ClipStart({
  onStart,
  blocked,
  source,
  onSourceChange: setSource,
}: {
  onStart(source: string): Promise<boolean>;
  blocked: string | null;
  /** The field's text, kept by the start page so switching tabs does not clear it. */
  source: string;
  onSourceChange(source: string): void;
}) {
  const runtime = useRuntime();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const submit = async (value = source) => {
    if (pending) return;
    const problem = clipSourceError(value) ?? blocked;
    if (problem) {
      setError(problem);
      field.current?.focus();
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (await onStart(normalizeClipSource(value))) setSource('');
    } finally {
      setPending(false);
    }
  };

  const choose = async () => {
    if (pending) return;
    const picked = await runtime.host.pickMediaFiles();
    const video = picked.find((path) => mediaKindOf(path) === 'video');
    if (video) {
      setSource(video);
      void submit(video);
    } else if (picked.length) setError(LANDING_COPY.clips.notVideo);
  };

  const describedBy = error ? `${id}-error` : `${id}-status`;

  return (
    <div
      data-cc
      aria-busy={pending}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes('Files')) return;
        event.preventDefault();
        if (!pending) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes('Files')) return;
        event.preventDefault();
        setDragging(false);
        const file = [...event.dataTransfer.files].find((candidate) => mediaKindOf(candidate.name) === 'video');
        if (!file) {
          setError(LANDING_COPY.clips.notVideo);
          return;
        }
        // An empty path means the file is not on this computer (the browser client); the host has already said so.
        const path = runtime.host.pathForFile(file);
        if (!path) return;
        setSource(path);
        void submit(path);
      }}
      className={cn(
        'flex flex-col items-center gap-5 rounded-3xl border border-dashed bg-card px-4 py-7 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none sm:px-8 sm:py-9',
        dragging ? 'border-primary/70 shadow-[0_0_0_4px_var(--glass-specular)]' : 'border-white/15',
      )}>
      <div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-[20px] border border-white/15 bg-linear-to-b from-white/10 to-white/[0.03] shadow-(--control-highlight)">
        {pending ? <Loader2 className="size-7 text-muted-foreground motion-safe:animate-spin" /> : <FileVideo className="size-7 text-foreground/80" />}
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {dragging ? LANDING_COPY.clips.dropTitle : LANDING_COPY.clips.title}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">{LANDING_COPY.clips.body}</p>
      </div>
      <form
        className="flex w-full max-w-xl flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}>
        <Label htmlFor={id}>{LANDING_COPY.clips.field}</Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2 aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              ref={field}
              value={source}
              disabled={pending}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={!!error}
              aria-describedby={describedBy}
              onChange={(event) => {
                setSource(event.target.value);
                setError(null);
              }}
              placeholder={LANDING_COPY.clips.placeholder}
              className="h-11 pl-9"
            />
          </div>
          {/* While no agent is ready the setup card above holds the view's one primary action. */}
          <Button type="submit" size="lg" variant={blocked ? 'outline' : 'default'} disabled={pending}>
            {LANDING_COPY.clips.add}
            <ArrowRight aria-hidden />
          </Button>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      <div className="flex w-full max-w-xl items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{LANDING_COPY.clips.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" size="lg" disabled={pending} onClick={() => void choose()}>
        <FolderOpen aria-hidden />
        {LANDING_COPY.clips.choose}
      </Button>
      <p id={`${id}-status`} role="status" className="min-h-5 max-w-xl text-center text-xs text-muted-foreground">
        {pending ? LANDING_COPY.clips.starting : (blocked ?? LANDING_COPY.clips.note)}
      </p>
    </div>
  );
}
