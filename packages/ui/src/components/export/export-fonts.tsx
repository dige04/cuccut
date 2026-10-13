import { useEffect, useMemo } from 'react';
import type { Id, JobRecord } from '@cuccut/protocol';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Download from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  exportFontFallbacks,
  exportFontNote,
  exportFontPhase,
  familyKey,
  liveFontJobs,
  liveRow,
  type FontRow,
} from '../../model/font-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  downloadFamily,
  exportUsageKey,
  refreshExportUsage,
  refreshFamilies,
  refreshUsage,
  startFontLibrarySync,
  useFontLibrary,
} from '../../state/font-library-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { toastError } from '../editor/font-detail.tsx';
import { TextLink } from './export-parts.tsx';

/**
 * Fonts for export and on-demand download (product design §5.9 "Fonts", §8.1; prototype export.jsx and font-downloads.jsx's ExportFontNote):
 * - Before export (top of the video page): families in use that are still downloading (export waits for them), families whose download failed (a fallback font is used instead, retry possible), and families not downloaded (with auto-download on, export starts by downloading them first; with it off, export uses the fallback font and the user can download now).
 * - During export: the preparation phase reads "Downloading fonts · family percent".
 * - After export: families that could not be obtained are listed with what replaced them and why (the Runtime's `FONT_NOT_DOWNLOADED` warning).
 * A failed download does not block export, and the user is not asked to pick a substitute first: export with the fallback font and give a warning (settled in product design §12). Desktop only: browser sessions have no `fonts.*`.
 */

const notes = style({ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 });
const note = style({
  display: 'flex',
  alignItems: 'center',
  gap: '[6px]',
  font: 'ui-xs',
  color: { default: 'gray-700', isNotice: 'orange-1000' },
  minWidth: 0,
  overflowWrap: 'anywhere',
});
const grow = style({ flexGrow: 1, minWidth: 0 });
const icon = style({ display: 'flex', flexShrink: 0 });
const doneNote = style({
  display: 'flex',
  alignItems: 'center',
  gap: '[6px]',
  marginTop: 12,
  font: 'ui-xs',
  color: 'orange-1000',
  overflowWrap: 'anywhere',
});

/**
 * Font notice at the top of the video page in the export panel: checked again when opened and when "Burn subtitles" is toggled, against this export's parameters (no download). When subtitles are not burned into the picture, only the families used by subtitles are left out of the list and are not offered for download (export does not download them either).
 */
export function ExportFontNote({ videoId, burnCaptions }: { videoId: Id; burnCaptions: boolean }) {
  const { client, host } = useRuntime();
  const web = host.platform === 'web';
  const usage = useFontLibrary((s) => s.exportUsage[exportUsageKey(videoId, burnCaptions)]);
  const statuses = useFontLibrary((s) => s.statuses);
  const jobs = useJobs((s) => s.jobs);
  const auto = useSetting('fonts.autoDownload') !== false;

  useEffect(() => (web ? undefined : startFontLibrarySync(client)), [client, web]);
  useEffect(() => {
    if (!web) void refreshExportUsage(client, videoId, burnCaptions).catch(() => {});
  }, [client, videoId, burnCaptions, web]);

  const lines = useMemo(() => {
    if (!usage) return [];
    const live = liveFontJobs(jobs);
    const byName = new Map<string, FontRow>();
    for (const f of usage.families) {
      const status = statuses[familyKey(f.family)] ?? f.status;
      byName.set(familyKey(f.family), liveRow(status, live.get(familyKey(f.family))));
    }
    return exportFontNote(usage.families, byName, auto);
  }, [usage, statuses, jobs, auto]);

  if (web || !lines.length) return null;
  return (
    <div className={notes}>
      {lines.map((l) => (
        <div key={l.tone + l.families.join()} className={note({ isNotice: l.tone === 'notice' })}>
          <span className={icon}>{l.tone === 'notice' ? <AlertTriangle /> : <Download />}</span>
          <span className={grow}>{l.text}</span>
          {l.action ? (
            <TextLink onPress={() => l.families.forEach((family) => void downloadFamily(client, family).catch(toastError))}>
              {l.action}
            </TextLink>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * During export, the font download phase (task phase `downloading`) reads "Downloading fonts · family percent". Faces that export downloads itself are not `fontDownload` tasks, so to find which one is downloading, look it up by family state (`downloading`): during this time, the state of the families this video uses is re-fetched every so often.
 */
export function useExportFontPhase(job: JobRecord): string | null {
  const { client } = useRuntime();
  const videoId = job.videoId;
  const usage = useFontLibrary((s) => (videoId ? s.usage[videoId] : undefined));
  const statuses = useFontLibrary((s) => s.statuses);
  const downloading = job.state === 'running' && job.phase === 'downloading';
  const families = useMemo(() => usage?.families.map((f) => f.family) ?? [], [usage]);

  useEffect(() => {
    if (!downloading || !videoId) return;
    let stopped = false;
    const tick = async () => {
      if (!usage) await refreshUsage(client, videoId).catch(() => {});
      const names = useFontLibrary.getState().usage[videoId]?.families.map((f) => f.family) ?? [];
      if (!stopped && names.length) await refreshFamilies(client, names).catch(() => {});
    };
    void tick();
    const timer = setInterval(() => void tick(), 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [client, downloading, videoId, usage]);

  if (!downloading) return null;
  const now = families.map((f) => statuses[familyKey(f)]).filter((s) => s?.state === 'downloading');
  return exportFontPhase(job, now as NonNullable<(typeof now)[number]>[]);
}

/** Export complete: which families could not be obtained, what replaces them, and why (does not block export; it is stated clearly afterwards). */
export function ExportFontFallbacks({ job }: { job: JobRecord }) {
  const text = exportFontFallbacks(job.warnings);
  if (!text) return null;
  return (
    <div className={doneNote}>
      <span className={icon}>
        <AlertTriangle />
      </span>
      <span className={grow}>{text}</span>
    </div>
  );
}
