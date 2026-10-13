import { useEffect, useMemo, useState } from 'react';
import type { Id, TranscriptExportFormat } from '@cuccut/protocol';
import { ActionButton, Picker, PickerItem, SegmentedControl, SegmentedControlItem, Switch } from '@react-spectrum/s2';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import Copy from '@react-spectrum/s2/icons/Copy';
import Transcript from '@react-spectrum/s2/icons/Transcript';
import Translate from '@react-spectrum/s2/icons/Translate';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { languageName } from '../../model/caption-tracks.ts';
import { defaultFileNames, TRANSCRIPT_FORMATS, transcriptSettings, transcriptSources, type TranscriptForm } from '../../model/export-settings.ts';
import { lengthReceipt } from '../../model/transcript-text.ts';
import { useExportPrefs } from '../../state/export-prefs-store.ts';
import { copyToClipboard } from '../editor/transcript-actions.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { SubmitFoot } from './export-footer.tsx';
import { FileRows, Lane, Lanes, Note, PlaceRow, Quick, QuickField, Sec, SumRow, Summary } from './export-parts.tsx';
import { TranscriptIncludeChecks } from './transcript-include.tsx';
import type { ExportEnv, ExportSubmit } from './use-export-submit.ts';
import { useRenderedText } from './use-rendered-text.ts';

/**
 * The "Transcript" page (design mockup export-transcript.jsx, model-transcript.js): language, format, what to include, what the output looks like, and the summary.
 *
 * What lands in the Runtime (text-export.ts, see the command and protocol spec §4.4) is: the main document (the transcription; if there is none, the subtitles on the timeline), an optional translation as a bilingual comparison, md / txt, and five options: a metadata header at the top (Markdown only; the tick is remembered across sessions, unticked if never saved), chapter headings (from the sequence's chapter markers; disabled if the video has no chapters), paragraph timestamps, speaker, and skip cut segments (when off, the full original text from before the cuts, with times measured on the source). These five switches are shared with the transcript panel's copy settings (transcript-include.tsx).
 * Paragraph splitting uses the same rules as the transcript panel (`TRANSCRIPT_PARAGRAPH`).
 * Differences from the mockup: a translation cannot be a standalone document (the main document only accepts transcription and subtitles); the original-text row is locked on; only one translation language per export.
 *
 * The "what it looks like" preview, the copy button at the top right, and the length of the summary all use the body text that the Runtime renders without writing a file (`exports.renderText`), which is byte-identical to the exported file. The preview box has a fixed height and scrolls, showing the full text. On a successful copy the icon turns green with a check mark for 3 seconds, then changes back.
 */

const row = style({ marginTop: 12 });
/** How long the check mark stays after copying. */
const COPIED_MS = 3000;
/** Preview box (mockup `.xtxpv`): read-only, fixed height, scrolls; small monospace text showing the full text; leaves room at the top right for the copy button. */
const previewBox = style({ position: 'relative' });
const preview = style({
  font: 'code-sm',
  color: { default: 'gray-800', isStale: 'gray-500' },
  margin: 0,
  boxSizing: 'border-box',
  height: 240,
  paddingStart: 12,
  paddingEnd: 40,
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
const copyButton = style({ position: 'absolute', top: 4, insetEnd: 4 });
const copiedIcon = iconStyle({ color: 'positive' });

export function ExportTranscriptTab({ env, submitter, onClose }: { env: ExportEnv; submitter: ExportSubmit; onClose: () => void }) {
  const sources = useMemo(() => transcriptSources(env.sequence, env.documents), [env.sequence, env.documents]);
  const frontmatter = useExportPrefs((s) => s.transcriptFrontmatter);
  const setFrontmatter = useExportPrefs((s) => s.setTranscriptFrontmatter);
  const [form, setForm] = useState<Omit<TranscriptForm, 'frontmatter'>>(() => ({
    documentId: sources[0]?.documentId ?? null,
    translationId: null,
    format: 'md',
    timestamps: true,
    chapters: true,
    speakers: true,
    skipCut: true,
  }));
  const set = (patch: Partial<Omit<TranscriptForm, 'frontmatter'>>) => setForm((f) => ({ ...f, ...patch }));
  const hasChapters = env.sequence.markers.some((m) => m.kind === 'chapter');
  /** The effective options: the header only counts for Markdown, and chapters only count when the video has chapters (so the summary never mentions something that does not exist). */
  const effective: TranscriptForm = { ...form, frontmatter: frontmatter && form.format === 'md', chapters: form.chapters && hasChapters };
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const source = sources.find((s) => s.documentId === form.documentId) ?? sources[0] ?? null;
  const translation = source?.translations.find((t) => t.documentId === form.translationId) ?? null;
  const format = TRANSCRIPT_FORMATS.find((f) => f.key === form.format) ?? TRANSCRIPT_FORMATS[0]!;
  const settings = source
    ? transcriptSettings({ ...effective, translationId: translation?.documentId ?? null }, source.documentId, {})
    : null;
  const files = settings ? defaultFileNames(env.videoName, settings, env.documents) : [];
  const sourceLabel = source ? (source.language ? languageName(source.language) : EXPORT_COPY.original) : '';
  const what = source
    ? [
        translation ? EXPORT_COPY.transcriptPair(sourceLabel, translation.label) : sourceLabel,
        format.label,
        effective.frontmatter ? EXPORT_COPY.frontmatter : null,
        effective.chapters ? EXPORT_COPY.chapters : null,
        effective.timestamps ? EXPORT_COPY.timestamps : null,
        effective.speakers ? EXPORT_COPY.speakers : null,
        effective.skipCut ? EXPORT_COPY.skipCut : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '—';
  const rendered = useRenderedText(env, settings, source ? [source.documentId, ...(translation ? [translation.documentId] : [])] : []);
  const shown = rendered.shown;
  const receipt = rendered.output ? lengthReceipt(rendered.output.entries, rendered.output.cjkCharacters, rendered.output.words) : null;
  /** Success only swaps the icon (green check), with no toast; if the browser refuses, the negative notice still appears as usual. */
  const copy = async () => {
    if (rendered.output && (await copyToClipboard(rendered.output.content, null))) setCopied(true);
  };

  return (
    <>
      <Sec first>{EXPORT_COPY.language}</Sec>
      {sources.length > 1 ? (
        <div className={row}>
          <Quick>
            <QuickField label={EXPORT_COPY.sourceDocument}>
              <Picker
                size="S"
                aria-label={EXPORT_COPY.sourceDocument}
                selectedKey={source?.documentId ?? null}
                onSelectionChange={(key) => key !== null && set({ documentId: String(key) as Id, translationId: null })}>
                {sources.map((s) => (
                  <PickerItem key={s.documentId} id={s.documentId}>
                    {s.name}
                  </PickerItem>
                ))}
              </Picker>
            </QuickField>
          </Quick>
        </div>
      ) : null}
      <Lanes label={EXPORT_COPY.language}>
        {source ? (
          <>
            <Lane
              icon={<Transcript />}
              name={`${sourceLabel} · ${EXPORT_COPY.original}`}
              sub={source.name}
              end={<Switch size="S" aria-label={EXPORT_COPY.originalSwitch(source.name)} isSelected isDisabled />}
            />
            {source.translations.map((t) => {
              const on = translation?.documentId === t.documentId;
              return (
                <Lane
                  key={t.documentId}
                  icon={<Translate />}
                  name={`${t.label} · ${EXPORT_COPY.translation}`}
                  sub={env.documents[t.documentId]?.name}
                  off={!on}
                  end={<Switch size="S" aria-label={EXPORT_COPY.translationSwitch(t.label)} isSelected={on} onChange={(next) => set({ translationId: next ? t.documentId : null })} />}
                />
              );
            })}
          </>
        ) : (
          <Lane icon={<Transcript />} name={EXPORT_COPY.noTranscript} sub={EXPORT_COPY.noTranscriptSub} off />
        )}
      </Lanes>
      {source ? <Note>{source.translations.length > 1 ? `${EXPORT_COPY.sourceLocked} · ${EXPORT_COPY.oneTranslation}` : EXPORT_COPY.sourceLocked}</Note> : null}

      <Sec>{EXPORT_COPY.format}</Sec>
      <SegmentedControl aria-label={EXPORT_COPY.format} selectedKey={form.format} onSelectionChange={(key) => set({ format: key as TranscriptExportFormat })}>
        {TRANSCRIPT_FORMATS.map((f) => (
          <SegmentedControlItem key={f.key} id={f.key}>
            {f.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <Note>{format.note}</Note>

      <Sec>{EXPORT_COPY.include}</Sec>
      {/* The same group of switches as the transcript panel's copy settings (transcript-include.tsx) */}
      <TranscriptIncludeChecks
        value={effective}
        disabled={{ frontmatter: form.format !== 'md', chapters: !hasChapters }}
        onChange={(key, on) => (key === 'frontmatter' ? setFrontmatter(on) : set({ [key]: on }))}
      />
      {form.format !== 'md' ? <Note>{EXPORT_COPY.frontmatterMdOnly}</Note> : null}
      {!hasChapters ? <Note>{EXPORT_COPY.transcriptNoChapters}</Note> : null}
      {!form.skipCut ? <Note>{EXPORT_COPY.keepCutNote}</Note> : null}

      <Sec>{EXPORT_COPY.preview}</Sec>
      {rendered.problem ? (
        <Note warn>{rendered.problem.title}</Note>
      ) : (
        <div className={previewBox}>
          {/* A scrollable area must be reachable by keyboard (tabIndex); screen readers read "Preview" aloud. */}
          <pre
            className={preview({ isStale: rendered.loading })}
            tabIndex={0}
            aria-label={EXPORT_COPY.preview}
            aria-busy={rendered.loading}>
            {!source ? EXPORT_COPY.noTranscript : shown ? shown.content : EXPORT_COPY.previewLoading}
          </pre>
          <ActionButton
            isQuiet
            size="S"
            styles={copyButton}
            aria-label={copied ? EXPORT_COPY.copied : EXPORT_COPY.copyText}
            isDisabled={!rendered.output}
            onPress={() => void copy()}>
            {copied ? <Checkmark styles={copiedIcon} /> : <Copy />}
          </ActionButton>
        </div>
      )}

      <Summary>
        <SumRow label={EXPORT_COPY.willExport}>{what}</SumRow>
        <FileRows names={files} />
        <SumRow label={EXPORT_COPY.transcriptLength}>{receipt ?? '—'}</SumRow>
        <PlaceRow videoId={env.videoId} />
      </Summary>

      <SubmitFoot env={env} submitter={submitter} settings={settings} label={EXPORT_COPY.exportTranscript} onClose={onClose} />
    </>
  );
}
