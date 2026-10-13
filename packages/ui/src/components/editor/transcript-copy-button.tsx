import { useEffect, useState } from 'react';
import type { DocumentRecord, Id } from '@cuccut/protocol';
import {
  ActionButton,
  Button,
  DialogTrigger,
  MenuItem,
  Popover,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  ToastQueue,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import ChevronDown from '@react-spectrum/s2/icons/ChevronDown';
import Copy from '@react-spectrum/s2/icons/Copy';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { useShallow } from 'zustand/react/shallow';
import { explainExportError } from '../../model/export-rejection.ts';
import { TRANSCRIPT_FORMATS } from '../../model/export-settings.ts';
import {
  copyAllSettings,
  copyEffective,
  copyIncludes,
  scopeIsPlain,
  type CopyScope,
  type TranscriptCopyPrefs,
} from '../../model/transcript-copy-options.ts';
import {
  chapterSections,
  copyReceipt,
  copyText,
  lengthReceipt,
  writeTranscript,
  type CopyParagraph,
  type TranscriptView,
} from '../../model/transcript-text.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { copyPrefsOf, useTranscriptCopyPrefs } from '../../state/transcript-copy-prefs-store.ts';
import { EXPORT_COPY } from '../export/export-copy.ts';
import { TranscriptIncludeChecks } from '../export/transcript-include.tsx';
import { copyToClipboard } from './transcript-actions.ts';
import { TRANSCRIPT_TOOLS_COPY as T } from './transcript-copy.ts';

/**
 * Copy controls for the transcript panel (design mock transcript-copy.jsx, product design §5.7): two buttons side by side in the panel header. The copy button copies the full text in one click using the remembered combination (`useTranscriptCopyPrefs`). The dropdown opens “Copy settings”: format, the same five toggles as the “Transcript” page of export, a body preview and a copy button. Changes are remembered. The post-copy notice states what was included, with a “Copy settings” button back to the popover. The paragraph and chapter menus (this paragraph / this chapter) use `useScopeCopy` and `copyScope`.
 *
 * The full text goes through `exports.renderText`, so it is byte-identical to a file exported with the same settings. When the panel has several transcripts, each is rendered and they are joined, with the header written only at the top of the first.
 * When only the translation is shown, Runtime cannot render (the main document does not hold translations), so the panel renders it with the same format (`writeTranscript`): no header, and cut parts do not appear.
 * Excerpts are also rendered by the panel: the time of a range export counts from the start of the range, but here we need the moment on the sequence.
 */

const pair = style({ display: 'inline-flex', alignItems: 'center' });
/** The dropdown is only 16px wide, to take less room in the panel header (design mock `.txc__chev`). */
const chevron = style({ width: 16, minWidth: 16 });
const pop = style({ display: 'flex', flexDirection: 'column', gap: 12, width: 360, maxWidth: '[calc(100vw - 32px)]', boxSizing: 'border-box' });
const popTitle = style({ margin: 0, font: 'title-sm', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const formatRow = style({ display: 'flex', alignItems: 'center', gap: 8 });
const formatLabel = style({ font: 'ui-sm', color: 'gray-700' });
const note = style({ margin: 0, font: 'ui-xs', color: 'gray-600' });
/** The preview box uses the same read-only monospace body as the export page (`export-transcript.tsx`), but a bit shorter. */
const previewText = style({
  font: 'code-xs',
  color: { default: 'gray-800', isStale: 'gray-500' },
  margin: 0,
  boxSizing: 'border-box',
  height: 160,
  paddingX: 12,
  paddingY: 8,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  overflow: 'auto',
  userSelect: 'text',
});
const foot = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 });
const receiptText = style({ font: 'ui-xs', color: 'gray-600', minWidth: 0 });

/** After a toggle changes, wait this long before rendering the preview: rapid clicks render only the last one (same as the export page). */
const DEBOUNCE_MS = 150;

/** The combination is built from parts (the copy button's hint, the post-copy receipt, the range menu's subtitle): the format, then the items this scope actually includes. */
export function copyParts(eff: TranscriptCopyPrefs, scope: CopyScope): string[] {
  const format = TRANSCRIPT_FORMATS.find((f) => f.key === eff.format) ?? TRANSCRIPT_FORMATS[0]!;
  return [format.label, ...copyIncludes(eff, scope).map((key) => (key === 'keepCut' ? T.keepCut : EXPORT_COPY[key]))];
}

/**
 * How the excerpt menu items (this chapter, this paragraph) are laid out. If the output with the settings is the same as text only (`plain`), only one “Copy text” item is shown. Otherwise there are two items, and the subtitle of “Per copy settings” is `summary`. Chapter header rows only exist when the video has chapters, so this is computed as having chapters.
 */
export function useScopeCopy(scope: Exclude<CopyScope, 'all'>): { plain: boolean; summary: string } {
  const prefs = useTranscriptCopyPrefs(useShallow(copyPrefsOf));
  const eff = copyEffective(prefs, { hasChapters: true, translationOnly: false });
  return { plain: scopeIsPlain(eff, scope), summary: copyParts(eff, scope).join(' · ') };
}

/** Copy items in the scope menus (this paragraph, this chapter): `copy-set` per the copy settings, `copy` text only. When the two are the same, there is only one “Copy text” item. */
export function scopeCopyItems(copy: { plain: boolean; summary: string }) {
  if (copy.plain)
    return [
      <MenuItem key="copy" id="copy" textValue={T.copyText}>
        <Copy />
        <Text slot="label">{T.copyText}</Text>
      </MenuItem>,
    ];
  return [
    <MenuItem key="copy-set" id="copy-set" textValue={T.copyWithSettings}>
      <Copy />
      <Text slot="label">{T.copyWithSettings}</Text>
      <Text slot="description">{copy.summary}</Text>
    </MenuItem>,
    <MenuItem key="copy" id="copy" textValue={T.copyTextOnly}>
      <Copy />
      <Text slot="label">{T.copyTextOnly}</Text>
    </MenuItem>,
  ];
}

/**
 * Copies one excerpt. With `withSettings`, the panel renders it using the remembered combination (no title or header; for this chapter the chapter heading follows the toggles). Otherwise it is the plain text of the current view.
 * The body text comes from the panel, and cut parts are not in it to begin with. `label` is the scope name shown in the receipt.
 */
export function copyScope(input: {
  scope: Exclude<CopyScope, 'all'>;
  label: string;
  paras: readonly CopyParagraph[];
  chapter: { title: string; start: number } | null;
  view: TranscriptView;
  withSettings: boolean;
}): Promise<boolean> {
  const { scope, paras, view } = input;
  const eff = copyEffective(copyPrefsOf(useTranscriptCopyPrefs.getState()), { hasChapters: !!input.chapter, translationOnly: false });
  const receipt = copyReceipt(paras, view);
  if (!input.withSettings || scopeIsPlain(eff, scope)) {
    return copyToClipboard(copyText(paras, { view }), T.copied(input.label, [T.textOnly, receipt].join(' · ')));
  }
  const heading = scope === 'chapter' && eff.chapters ? input.chapter : null;
  const text = writeTranscript([{ chapter: heading, paras }], { format: eff.format, view, speakers: eff.speakers, timestamps: eff.timestamps });
  return copyToClipboard(text, T.copied(input.label, [...copyParts(eff, scope), receipt].join(' · ')));
}

/** What the panel hands to the copy button. */
export interface TranscriptCopyInput {
  videoId: Id | null;
  /** Caught up, so Runtime can be asked to render the body. */
  ready: boolean;
  /** Version of the document the sequence and body come from: when it changes, the preview is re-rendered. */
  revision: string;
  /** Each transcript in the panel; in bilingual or translation-only view, paired with a translation in the same language. */
  sources: readonly { documentId: Id; translationId: Id | null }[];
  view: TranscriptView;
  /** The name shown on the language button (“English”, or “中文 + English” meaning Chinese + English). */
  viewLabel: string;
  hasChapters: boolean;
  chapters: readonly { title: string; start: number }[];
  /** Video name: when rendering translation only or Markdown, the level-1 heading the panel writes (the same one Runtime writes). */
  title: string | null;
  /** All paragraphs of the panel (rendered by the panel when translation only); computed only when needed. */
  paragraphs(): readonly CopyParagraph[];
  documents: Record<Id, DocumentRecord>;
  disabled: boolean;
}

interface Produced {
  text: string;
  receipt: string;
}

/** Renders the full text with the effective combination: when translation only, the panel renders it; otherwise Runtime does (each transcript is rendered separately, then they are joined). */
async function produceAll(runtime: RuntimeSession, input: TranscriptCopyInput, eff: TranscriptCopyPrefs): Promise<Produced> {
  if (input.view === 'translation') {
    const paras = input.paragraphs().filter((p) => p.translation.trim());
    const sections = eff.chapters ? chapterSections(paras, input.chapters) : [{ chapter: null, paras }];
    const body = writeTranscript(sections, {
      format: eff.format,
      view: 'translation',
      speakers: eff.speakers,
      timestamps: eff.timestamps,
      title: eff.format === 'md' ? input.title : null,
    });
    // Ends with a newline, like the file Runtime renders.
    return { text: body ? `${body}\n` : '', receipt: copyReceipt(paras, 'translation') };
  }
  if (!input.videoId) return { text: '', receipt: '' };
  const videoId = input.videoId;
  const results = await Promise.all(copyAllSettings(eff, input.sources).map((settings) => runtime.renderTextExport({ videoId, settings })));
  const outputs = results.flatMap((r) => (r.outputs[0] ? [r.outputs[0]] : []));
  const sum = (key: 'entries' | 'cjkCharacters' | 'words') => outputs.reduce((n, o) => n + o[key], 0);
  return { text: outputs.map((o) => o.content).join('\n'), receipt: lengthReceipt(sum('entries'), sum('cjkCharacters'), sum('words')) };
}

function copyFailed(error: unknown, documents: Record<Id, DocumentRecord>) {
  ToastQueue.negative(explainExportError(error, { kind: 'transcript', stage: 'rejected', documents }).title, { timeout: 6000 });
}

/** The copy button and the “Copy settings” dropdown in the panel header. */
export function TranscriptCopyButton({ input }: { input: TranscriptCopyInput }) {
  const runtime = useRuntime();
  const prefs = useTranscriptCopyPrefs(useShallow(copyPrefsOf));
  const setPrefs = useTranscriptCopyPrefs((s) => s.set);
  const [open, setOpen] = useState(false);
  const translationOnly = input.view === 'translation';
  const eff = copyEffective(prefs, { hasChapters: input.hasChapters, translationOnly });
  const parts = copyParts(eff, 'all');
  const summary = parts.join(' · ');

  // When the popover is open and caught up, render the preview. Re-render when the combination, view, or version changes, and discard late results from older renders.
  const key = open && input.ready ? JSON.stringify([eff, input.view, input.revision, input.sources]) : null;
  const [preview, setPreview] = useState<{ key: string; produced: Produced | null; problem: string | null } | null>(null);
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    const timer = setTimeout(() => {
      produceAll(runtime, input, eff).then(
        (produced) => live && setPreview({ key, produced, problem: null }),
        (error: unknown) =>
          live &&
          setPreview({
            key,
            produced: null,
            problem: explainExportError(error, { kind: 'transcript', stage: 'rejected', documents: input.documents }).title,
          }),
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `key` already includes the combination and version; also re-render when the paragraphs change (`paragraphs` changed). `input` is a new object on every render, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, key, input.paragraphs]);
  const fresh = !!preview && preview.key === key;

  const finish = async (produced: Produced, fromSettings: boolean) => {
    if (!(await copyToClipboard(produced.text, null))) return;
    const message = T.copied(T.scopeAll, [...parts, produced.receipt].join(' · '));
    ToastQueue.positive(
      message,
      fromSettings
        ? { timeout: 3000 }
        : { timeout: 5000, actionLabel: T.copySettings, onAction: () => setOpen(true), shouldCloseOnAction: true },
    );
  };

  const copy = (fromSettings: boolean) => {
    setOpen(false);
    // If the preview is already rendered, use it directly: the clipboard write must happen inside this click (Safari rejects a write that comes after an async wait).
    if (fromSettings && fresh && preview.produced) {
      void finish(preview.produced, true);
      return;
    }
    produceAll(runtime, input, eff).then(
      (produced) => finish(produced, fromSettings),
      (error: unknown) => copyFailed(error, input.documents),
    );
  };

  const shown = preview?.produced ?? null;
  const tip = `${T.copyAllHead(input.viewLabel)} · ${summary}`;
  return (
    <span className={pair}>
      <TooltipTrigger>
        <ActionButton isQuiet size="S" aria-label={T.copyMenu} isDisabled={input.disabled} onPress={() => copy(false)}>
          <Copy />
        </ActionButton>
        <Tooltip>{tip}</Tooltip>
      </TooltipTrigger>
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <TooltipTrigger>
          <ActionButton isQuiet size="S" styles={chevron} aria-label={T.copySettings} isDisabled={input.disabled}>
            <ChevronDown />
          </ActionButton>
          <Tooltip>{T.copySettings}</Tooltip>
        </TooltipTrigger>
        <Popover placement="bottom end" aria-label={T.copySettings}>
          <div className={pop}>
            <h3 className={popTitle}>{T.copyAllHead(input.viewLabel)}</h3>
            <div className={formatRow}>
              <span className={formatLabel}>{EXPORT_COPY.format}</span>
              <SegmentedControl
                aria-label={EXPORT_COPY.format}
                selectedKey={prefs.format}
                onSelectionChange={(format) => setPrefs({ format: format as TranscriptCopyPrefs['format'] })}>
                {TRANSCRIPT_FORMATS.map((f) => (
                  <SegmentedControlItem key={f.key} id={f.key}>
                    {f.label}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
            <TranscriptIncludeChecks
              value={eff}
              disabled={{ frontmatter: prefs.format !== 'md' || translationOnly, chapters: !input.hasChapters, skipCut: translationOnly }}
              onChange={(key, on) => setPrefs({ [key]: on })}
            />
            {translationOnly ? <p className={note}>{T.copyTranslationOnly}</p> : null}
            {fresh && preview.problem ? (
              <p className={note}>{preview.problem}</p>
            ) : (
              // A scrollable region must be reachable by keyboard (tabIndex); screen readers announce it as “预览” (Preview).
              <pre className={previewText({ isStale: !fresh })} tabIndex={0} aria-label={EXPORT_COPY.preview} aria-busy={!fresh}>
                {shown ? shown.text || T.copyEmpty : EXPORT_COPY.previewLoading}
              </pre>
            )}
            <div className={foot}>
              <span className={receiptText}>{fresh && shown ? shown.receipt || '—' : '—'}</span>
              <Button variant="accent" size="S" autoFocus isDisabled={fresh && !!preview.problem} onPress={() => copy(true)}>
                <Copy />
                <Text>{T.copyConfirm}</Text>
              </Button>
            </div>
          </div>
        </Popover>
      </DialogTrigger>
    </span>
  );
}
