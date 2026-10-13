import { useMemo, useState } from 'react';
import type { Id, JobRecord } from '@cuccut/protocol';
import { ProgressBar, SegmentedControl, SegmentedControlItem } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { durationSeconds } from '../../model/editor.ts';
import { EXPORT_TABS, tabOfKind, videoExports, type ExportTab } from '../../model/export-job.ts';
import { chapterPieces, clipPieces, initialRange, rangePlan, type RangeState } from '../../model/export-range.ts';
import { DEFAULT_LOUDNESS_FORM, type LoudnessForm } from '../../model/export-settings.ts';
import { jobLive } from '../../model/task-list.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { ExportAudioTab } from './export-audio.tsx';
import { EXPORT_COPY } from './export-copy.ts';
import { Note } from './export-parts.tsx';
import { ExportProjectTab } from './export-project.tsx';
import type { RangeBundle } from './export-range.tsx';
import { ExportJobView } from './export-status.tsx';
import { ExportSubtitlesTab } from './export-subtitles.tsx';
import { ExportTranscriptTab } from './export-transcript.tsx';
import { ExportVideoTab } from './export-video.tsx';
import { useExportSubmit, type ExportEnv } from './use-export-submit.ts';

/**
 * Export panel (design mockup export.jsx `ExportPopover`, product design §17.1): at the top, "Export" and five page tabs (Video / Audio / Subtitles / Transcript / Project); below, either this page's settings, or the export this page is watching (running / done / failed / cancelled).
 *
 * - Each page watches its own export: after a successful submit that page switches to progress; when the panel opens, each page attaches to this video's export that has not yet ended (no matter who submitted it).
 * - The Video and Audio pages share one range and one loudness (the mockup's single `range` / `loudness`).
 * - Closing the panel does not stop the export; after the panel unmounts, the watched state is dropped, and next time it reattaches to still-running jobs from the job records.
 */

const panel = style({
  display: 'flex',
  flexDirection: 'column',
  width: { default: 488, isWide: 728 },
  padding: 24,
  maxWidth: '[calc(100vw - 48px)]',
  boxSizing: 'border-box',
});
const header = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 });
const title = style({ margin: 0, font: 'title', color: 'gray-900' });
const waitBar = style({ marginTop: 16 });

/** Which export each page watches when opened: this video's most recent export for that page that has not ended; if a specific one is given (opened from a failure notice), that one is watched. */
function initialWatch(jobs: readonly JobRecord[], videoId: Id, focus: JobRecord | null): Partial<Record<ExportTab, Id>> {
  const watch: Partial<Record<ExportTab, Id>> = {};
  for (const job of videoExports(jobs, videoId)) {
    if (!job.export || !jobLive(job)) continue;
    const tab = tabOfKind(job.export.settings.kind);
    watch[tab] ??= job.jobId;
  }
  if (focus?.export) watch[tabOfKind(focus.export.settings.kind)] = focus.jobId;
  return watch;
}

export function ExportPanel({ env, initialJobId, onClose }: { env: ExportEnv; initialJobId: Id | null; onClose: () => void }) {
  const jobs = useJobs((s) => s.jobs);
  const [watch, setWatch] = useState<Partial<Record<ExportTab, Id>>>(() => {
    const focus = initialJobId ? (jobs.find((j) => j.jobId === initialJobId) ?? null) : null;
    return initialWatch(jobs, env.videoId, focus);
  });
  const [tab, setTab] = useState<ExportTab>(() => {
    const focus = initialJobId ? jobs.find((j) => j.jobId === initialJobId) : undefined;
    if (focus?.export) return tabOfKind(focus.export.settings.kind);
    const live = videoExports(jobs, env.videoId).find((j) => j.export && jobLive(j));
    return live?.export ? tabOfKind(live.export.settings.kind) : 'video';
  });

  // Range and loudness: shared by the Video and Audio pages (the mockup's export.jsx keeps `range` / `loudness` at panel level).
  const chapters = useMemo(() => chapterPieces(env.sequence), [env.sequence]);
  const clips = useMemo(() => clipPieces(env.sequence, env.assets, env.documents), [env.sequence, env.assets, env.documents]);
  const duration = durationSeconds(env.sequence);
  const [rangeState, setRangeState] = useState<RangeState>(() => initialRange(chapters, clips, env.playhead, env.selection, duration));
  const [loudness, setLoudness] = useState<LoudnessForm>(DEFAULT_LOUDNESS_FORM);
  const range: RangeBundle = {
    state: rangeState,
    onChange: setRangeState,
    chapters,
    clips,
    duration,
    plan: rangePlan(rangeState, chapters, clips, duration),
    playhead: env.playhead,
  };

  const submitter = useExportSubmit(env, (jobId, at) => {
    setWatch((w) => ({ ...w, [at]: jobId }));
    setTab(at);
  });

  const watchedId = watch[tab] ?? null;
  const watched = watchedId ? (jobs.find((j) => j.jobId === watchedId) ?? null) : null;
  const reset = () => {
    submitter.dismiss();
    setWatch((w) => {
      const next = { ...w };
      delete next[tab];
      return next;
    });
  };
  const switchTab = (next: ExportTab) => {
    submitter.dismiss();
    setTab(next);
  };

  return (
    <div className={panel({ isWide: tab === 'video' && !watchedId })}>
      <div className={header}>
        <h2 className={title}>{EXPORT_COPY.title}</h2>
        <SegmentedControl aria-label={EXPORT_COPY.tabsLabel} selectedKey={tab} onSelectionChange={(key) => switchTab(key as ExportTab)}>
          {EXPORT_TABS.map((t) => (
            <SegmentedControlItem key={t.key} id={t.key}>
              {t.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      {watchedId ? (
        watched ? (
          <ExportJobView job={watched} env={env} submitter={submitter} onReset={reset} onClose={onClose} />
        ) : (
          // Right after a successful submit, before the job record has arrived through the jobs topic.
          <>
            <Note>{EXPORT_COPY.waiting}</Note>
            <div className={waitBar}>
              <ProgressBar aria-label={EXPORT_COPY.waiting} isIndeterminate />
            </div>
          </>
        )
      ) : tab === 'video' ? (
        <ExportVideoTab env={env} submitter={submitter} range={range} loudness={loudness} onLoudness={setLoudness} onClose={onClose} />
      ) : tab === 'audio' ? (
        <ExportAudioTab env={env} submitter={submitter} range={range} loudness={loudness} onLoudness={setLoudness} onClose={onClose} />
      ) : tab === 'subtitles' ? (
        <ExportSubtitlesTab env={env} submitter={submitter} onClose={onClose} />
      ) : tab === 'transcript' ? (
        <ExportTranscriptTab env={env} submitter={submitter} onClose={onClose} />
      ) : (
        <ExportProjectTab env={env} submitter={submitter} onClose={onClose} />
      )}
    </div>
  );
}
