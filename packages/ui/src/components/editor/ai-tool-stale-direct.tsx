import { useMemo, useRef, useState } from 'react';
import type { DocumentRecord, Id } from '@cuccut/protocol';
import { Button, ProgressBar } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { languageName } from '../../model/caption-tracks.ts';
import { liveRefresh, translateProgress } from '../../model/translate-progress.ts';
import { pairRows, readTranslation, speechSentences } from '../../model/translation-doc.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { pickTranslation, refreshableTranslations, refreshCounts } from './ai-tool-direct.ts';
import { DirectModelGate, DirectModelPicker, type DirectModel } from './ai-tool-direct-view.tsx';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import type { AiToolPreset } from './ai-tools-nav.ts';
import { cancelTranslate, startRefresh, useTranslateRun } from './translate-run.ts';
import { TRANSLATE_COPY as T } from './translate-copy.ts';
import { useDocumentBody } from './use-document-body.ts';

/*
 * Refresh stale translations, 「用 › 直接调模型」 (Use › Call model directly) (product design §5.10 「直接调模型」 and 「逐句与过期译文」): does not go through `ai-tool`; the `translate` flow refreshes the selected translation in place, without naming sentences; the Runtime picks the stale ones, the ones whose source was edited, and the ones with no translation yet. It is the same refresh and the same run state as the subtitle panel's AI button 「用模型 API 重译这 N 句」 (retranslate these N sentences with the model API) (`useTranslateRun.refreshes`), and the two places see each other.
 * This path carries no prompt, attachments or Skill, and the parameters page shows no prompt box. Sentences whose source was cut must be retranslated against the cut source, which the Runtime cannot tell, so those can only be handed to an Agent.
 */

const stack = style({ display: 'flex', flexDirection: 'column', gap: 12 });
const box = style({ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 });
const boxHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 });
const boxTitle = style({ flexGrow: 1, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const note = style({ margin: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const cta = style({ width: 'full' });
const head = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const titleRow = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui', color: 'gray-900' });
const liveDot = style({
  flexShrink: 0,
  width: 8,
  height: 8,
  borderRadius: 'full',
  backgroundColor: { default: 'blue-800', isQueued: 'gray-400' },
});
const headTitle = style({ flexGrow: 1, minWidth: 0, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const percent = style({ flexShrink: 0, font: 'ui-sm', color: 'gray-700' });
const activity = style({ font: 'ui-xs', color: 'gray-600' });
const field = style({ width: 'full' });

export interface StaleDirect {
  translations: DocumentRecord[];
  /** The one to refresh; null when the video has no translation. */
  record: DocumentRecord | null;
  pick(id: Id): void;
  /** The translation's language (in-place refresh must match it); empty string when it cannot be read. */
  language: string;
  /** How many sentences to retranslate; null when the body text has not been read yet. */
  counts: { todo: number; stale: number; untranslated: number } | null;
}

/** Which one to refresh and how many sentences to retranslate (counted the same way as the subtitle panel's stats bar). */
export function useStaleDirect(documents: Record<Id, DocumentRecord>, preset: AiToolPreset | null, enabled: boolean): StaleDirect {
  const translations = useMemo(() => (enabled ? refreshableTranslations(documents) : []), [documents, enabled]);
  const [picked, setPicked] = useState<Id | null>(null);
  const record = pickTranslation(translations, { picked, presetId: preset?.translationId ?? null, presetLanguage: preset?.language ?? null });
  const translationBody = useDocumentBody(record ?? undefined);
  const speechBody = useDocumentBody(record?.sourceDocumentId ? documents[record.sourceDocumentId] : undefined);
  const translation = useMemo(() => (translationBody === undefined ? null : readTranslation(translationBody)), [translationBody]);
  const counts = useMemo(() => {
    const sentences = speechBody === undefined ? null : speechSentences(speechBody);
    return translation && sentences ? refreshCounts(pairRows(sentences, translation)) : null;
  }, [translation, speechBody]);
  return {
    translations,
    record,
    pick: setPicked,
    language: translation?.language || record?.language || '',
    counts,
  };
}

/** Splits the number of sentences to retranslate into 「N 过期」 · 「N 未翻译」 (N stale · N untranslated) (the short counts of the subtitle panel's stats bar); zero counts are omitted. */
export function refreshParts(counts: { stale: number; untranslated: number }): string {
  return [counts.stale ? T.staleShort(counts.stale) : '', counts.untranslated ? T.untranslatedShort(counts.untranslated) : ''].filter(Boolean).join(' · ');
}

/** The translation's name in menus and hints: the language name; when the same language has several, the document name is appended. */
export function translationLabel(record: DocumentRecord, all: readonly DocumentRecord[]): string {
  const language = record.language ? languageName(record.language) : T.unnamed;
  const twins = all.filter((t) => t.language === record.language).length > 1;
  return twins && record.name ? `${language} · ${record.name}` : language;
}

/** This translation is being refreshed in place: submitted from here or from the subtitle panel (counts even before the receipt arrives), or started elsewhere. null when none. */
export function useStaleRefreshLive(translationId: Id | null) {
  const own = useTranslateRun((s) => (translationId ? (s.refreshes[translationId] ?? null) : null));
  const jobs = useJobs((s) => s.jobs);
  return useMemo(() => {
    if (!translationId) return null;
    const foreign = liveRefresh(jobs, translationId);
    const jobId = own?.jobId ?? foreign?.job.jobId ?? null;
    const job = jobId ? (jobs.find((j) => j.jobId === jobId) ?? null) : null;
    if (!own && !foreign) return null;
    return { count: own ? own.count : (foreign?.count ?? null), job, progress: job ? translateProgress(job, jobs) : null };
  }, [translationId, own, jobs]);
}

/**
 * The lower half of the parameters page (in place of the prompt box): explains that this path carries no prompt, shows the model picker and gate, the main button 「重译 N 句」 (Retranslate N sentences), and a line stating where the result goes. When there are no sentences to retranslate, the main button is greyed out with the reason.
 * When the model cannot be used the button is not greyed out: pressing it says what is missing (`onNotReady`) and brings the gate into view.
 */
export function StaleDirectStart({
  videoId,
  stale,
  model,
  onNotReady,
}: {
  videoId: Id;
  stale: StaleDirect;
  model: DirectModel;
  onNotReady(): void;
}) {
  const [sending, setSending] = useState(false);
  const gate = useRef<HTMLDivElement>(null);
  const todo = stale.counts?.todo ?? 0;
  const record = stale.record;
  const start = async () => {
    if (!record) return;
    if (!model.ready) {
      gate.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      onNotReady();
      return;
    }
    setSending(true);
    try {
      await startRefresh({ videoId, record, language: stale.language, count: todo, model: model.ref });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className={box}>
      <div className={boxHead}>
        <span className={boxTitle}>{C.modelPicker}</span>
        <DirectModelPicker model={model} />
      </div>
      <p className={note}>{C.staleNoPrompt}</p>
      <div ref={gate}>
        <DirectModelGate model={model} body={C.staleGateBody} />
      </div>
      <Button variant="secondary" styles={cta} isDisabled={!record || !todo} isPending={sending} onPress={() => void start()}>
        {C.ctaStale(todo)}
      </Button>
      <p className={note}>{C.modelHint(model.name, true, model.local)}</p>
    </div>
  );
}

/** While the in-place refresh runs, the parameters page turns into progress in place: how many sentences are being retranslated, the percentage and which batch, and cancel. The task runs in the background and keeps going when returning to the list. On completion it returns to the parameters page, and the message offers undo. */
export function StaleRefreshView({ live }: { live: NonNullable<ReturnType<typeof useStaleRefreshLive>> }) {
  const { job, progress } = live;
  const submitting = !job;
  const queued = !!progress?.queued;
  const heading = submitting ? C.runSubmitting : queued ? C.runQueued : T.refreshing(live.count);
  const pct = submitting || queued || !progress ? null : progress.percent;
  return (
    <div className={stack}>
      <div className={head} role="status" aria-live="polite">
        <div className={titleRow}>
          <span className={liveDot({ isQueued: queued })} aria-hidden />
          <span className={headTitle}>{heading}</span>
          {pct === null ? null : <span className={`${percent} cc-tabular`}>{pct}%</span>}
        </div>
        <ProgressBar size="S" aria-label={heading} isIndeterminate={pct === null} {...(pct === null ? {} : { value: pct })} styles={field} />
        {progress?.units?.total ? <span className={`${activity} cc-tabular`}>{T.stepUnits(progress.units.done, progress.units.total)}</span> : null}
        {job && isJobLive(job) ? (
          <div>
            <Button size="S" variant="secondary" onPress={() => void cancelTranslate(job.jobId)}>
              {C.cancel}
            </Button>
          </div>
        ) : null}
      </div>
      <p className={note}>{C.agentNoteStale}</p>
    </div>
  );
}
