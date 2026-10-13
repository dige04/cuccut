import { useRef, useState } from 'react';
import { live, type SpaceEntry } from '@cuccut/protocol';
import {
  ActionButton,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  TextArea,
  TextField,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { revealLabel } from '../copy.ts';
import { useRuntime } from '../runtime/context.tsx';
import { S } from './shell-copy.ts';
import { entryPath } from '../model/space.ts';
import { copyText, elideMiddle, entryFacts, HERO_NAME_MAX, heroLine, sections, type InfoRow, type VideoInfoFacts } from '../model/video-info.ts';

/**
 * The video details dialog (design mockup project-info.jsx): a hero, read-only section rows, editable items, and a footer with “copy all” and “done”. Row assembly is in model/video-info.ts; this file only draws and commits the name. The ⓘ in the editor top bar (editor/video-info.tsx) and Space's “video details…” share it.
 *
 * Only the name can be changed (the editor path, `renameVideo`): it is committed once on blur, Enter, or “done”, not on every keystroke; an empty or unchanged name is restored. Closing with Esc discards an uncommitted draft. Description and notes have nowhere to be stored, so they are greyed out with the reason.
 * The “location” and “source file” rows have “show in folder” at the end (the row's `reveal`), which hands off to the host's file manager; the Web host cannot do this, so it is not drawn. The original description scrolls within a height limit.
 * “relink media” is not included here: that belongs to the case where media is missing.
 */
export const VIDEO_INFO_COPY = live(() => S.videoInfo);
const C = VIDEO_INFO_COPY;

const body = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const hero = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const heroTitle = style({ font: 'title', color: 'gray-900', margin: 0, lineClamp: 2, overflowWrap: 'anywhere', userSelect: 'text' });
const heroSub = style({ font: 'ui-sm', color: 'gray-600', whiteSpace: 'nowrap', overflow: 'hidden', userSelect: 'text' });
const section = style({ marginTop: 16, display: 'flex', flexDirection: 'column', minWidth: 0 });
const sectionTitle = style({ font: 'detail', fontWeight: 'bold', color: 'gray-600', margin: 0, marginBottom: 4 });
const rows = style({ display: 'flex', flexDirection: 'column', margin: 0 });
const rowLine = style({ display: 'flex', alignItems: 'baseline', gap: 12, paddingY: 4, minWidth: 0 });
const label = style({ font: 'ui-sm', color: 'gray-600', width: 64, flexShrink: 0, margin: 0 });
const value = style({
  font: { default: 'ui-sm', isMono: 'code-xs' },
  color: 'gray-900',
  margin: 0,
  minWidth: 0,
  flexGrow: 1,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
  maxHeight: { isLong: 160 },
  overflowY: { isLong: 'auto' },
  overscrollBehavior: { isLong: 'contain' },
});
const rowAction = style({ flexShrink: 0, alignSelf: 'center', marginY: -4 });
const form = style({ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 });
const full = style({ width: 'full' });

export interface VideoInfoDialogProps {
  facts: VideoInfoFacts;
  /** Rows that only the editor path has (content, translation). */
  extras?: readonly InfoRow[];
  /** Rename; returns true on success. When not given, the name is greyed out. */
  onRename?: (name: string) => Promise<boolean>;
  /** Why the name cannot be changed (written below when greyed out). */
  renameNote?: string | null;
  onClose(): void;
}

export function VideoInfoDialog({ facts, extras = [], onRename, renameNote = null, onClose }: VideoInfoDialogProps) {
  // State lives in the dialog's outer layer: S2's Dialog renders its children in several slots, each one separately.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const list = sections(facts, extras);
  const heroText = heroLine(facts.source);
  const host = useRuntime().host;
  const canReveal = host.platform !== 'web';

  /** Submits the name draft; with no draft, an empty or unchanged one, it is restored and counts as success. On failure the draft is kept, and the error is shown by the side that renamed it. */
  const commit = (): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (draft === null) return Promise.resolve(true);
    const next = draft.trim();
    if (!next || next === facts.title || !onRename) {
      setDraft(null);
      return Promise.resolve(true);
    }
    setBusy(true);
    const run = onRename(next)
      .then(
        (ok) => {
          if (ok) setDraft(null);
          return ok;
        },
        (error: Error) => {
          ToastQueue.negative(C.renameFailed(error.message), { timeout: 5000 });
          return false;
        },
      )
      .finally(() => {
        pending.current = null;
        setBusy(false);
      });
    pending.current = run;
    return run;
  };

  const copyAll = () => {
    navigator.clipboard.writeText(copyText(facts.title, heroText, list)).then(
      () => ToastQueue.positive(C.copied, { timeout: 3000 }),
      () => ToastQueue.negative(C.copyFailed, { timeout: 4000 }),
    );
  };

  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">{C.title}</Heading>
            <Content>
              <div className={body}>
                <div className={hero}>
                  <p className={heroTitle} title={facts.title}>
                    {facts.title}
                  </p>
                  {heroText ? (
                    <span className={heroSub} title={heroText}>
                      {[facts.source?.kind, facts.source?.fileName ? elideMiddle(facts.source.fileName.trim(), HERO_NAME_MAX) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </div>
                {list.map((s) => (
                  <section key={s.title} className={section} aria-label={s.title}>
                    <h3 className={sectionTitle}>{s.title}</h3>
                    <dl className={rows}>
                      {s.rows.map((r) => (
                        <div key={r.label} className={rowLine}>
                          <dt className={label}>{r.label}</dt>
                          <dd className={value({ isMono: r.mono, isLong: !!r.long })}>{r.value}</dd>
                          {r.reveal && canReveal ? (
                            <TooltipTrigger>
                              <ActionButton
                                isQuiet
                                size="S"
                                styles={rowAction}
                                aria-label={`${revealLabel()}: ${r.label}`}
                                onPress={() => void host.revealPath(r.reveal!)}>
                                <Folder />
                              </ActionButton>
                              <Tooltip>{revealLabel()}</Tooltip>
                            </TooltipTrigger>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
                <div className={form}>
                  <TextField
                    label={C.name}
                    styles={full}
                    value={draft ?? facts.title}
                    onChange={setDraft}
                    onBlur={() => void commit()}
                    onKeyDown={(event) => {
                      // Enter while an IME is choosing characters does not count as a commit.
                      if (event.key === 'Enter' && !event.nativeEvent.isComposing) void commit();
                      else event.continuePropagation();
                    }}
                    isDisabled={!onRename}
                    description={onRename ? undefined : (renameNote ?? undefined)}
                    maxLength={120}
                  />
                  <TextArea label={C.summary} styles={full} isDisabled description={C.notSaved} />
                  <TextArea label={C.notes} styles={full} isDisabled description={C.notSaved} />
                </div>
              </div>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={copyAll}>
                {C.copyAll}
              </Button>
              <Button
                variant="accent"
                isPending={busy}
                onPress={() => {
                  void commit().then((ok) => ok && close());
                }}>
                {C.done}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}

/** The Space path: only entry records; rows without them are omitted. The name is not changed here (Space's “rename” changes the display name). */
export function SpaceVideoInfo({ entry, dirs, onClose }: { entry: SpaceEntry; dirs: Parameters<typeof entryPath>[1]; onClose(): void }) {
  return <VideoInfoDialog facts={entryFacts(entry, entry.name, entryPath(entry, dirs))} renameNote={C.renameInEditor} onClose={onClose} />;
}
