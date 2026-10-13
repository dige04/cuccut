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
 * 刷新过期译文「用 › 直接调模型」（产品设计 §5.10「直接调模型」「逐句与过期译文」）：不走 `ai-tool`，走 `translate` 流程就地刷新
 * 选中的那份译文，不点名句子，由 Runtime 挑过期、原句改过与还没有译文的——与字幕面板 AI 钮的「用模型 API 重译这 N 句」是同一次刷新、
 * 同一份运行态（`useTranslateRun.refreshes`），两处互相看得见。这条路不带提示词、附件与 Skill，参数页不出提示词框；
 * 原文被剪切的句子要按剪后的原文重译，Runtime 判不出，只能交给 Agent。
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
  /** 要刷新的那份；视频里没有译文时 null。 */
  record: DocumentRecord | null;
  pick(id: Id): void;
  /** 译文的语言（就地刷新要与它一致）；读不出时空串。 */
  language: string;
  /** 要重译几句；正文还没读到时 null。 */
  counts: { todo: number; stale: number; untranslated: number } | null;
}

/** 刷新哪一份、要重译几句（口径同字幕面板的统计条）。 */
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

/** 要重译的句数拆成「N 过期 · N 未翻译」（同字幕面板统计条的短计数），零的不写。 */
export function refreshParts(counts: { stale: number; untranslated: number }): string {
  return [counts.stale ? T.staleShort(counts.stale) : '', counts.untranslated ? T.untranslatedShort(counts.untranslated) : ''].filter(Boolean).join(' · ');
}

/** 译文在菜单与提示里的名字：语言名；同一门语言有几份时接上文档名。 */
export function translationLabel(record: DocumentRecord, all: readonly DocumentRecord[]): string {
  const language = record.language ? languageName(record.language) : T.unnamed;
  const twins = all.filter((t) => t.language === record.language).length > 1;
  return twins && record.name ? `${language} · ${record.name}` : language;
}

/** 正在就地刷新这份译文：从这里或字幕面板提交的（回执到之前也算），或别处发起的。没有时 null。 */
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
 * 参数页下半截（代替提示词框）：说明这条路不带提示词、模型选择与门卡、主按钮「重译 N 句」与一行去向。没有要重译的句子时
 * 主按钮置灰并写原因。模型不能用时不灰掉按钮：按下说清差什么（`onNotReady`），并把门卡带到眼前。
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

/** 就地刷新跑着时参数页原地换成进度：重译几句、百分比与第几批、取消；任务在后台，回列表也接着跑。完成后回到参数页，提示里给撤销。 */
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
