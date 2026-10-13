import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Id } from '@cuccut/protocol';
import { ActionButton, Button, ProgressBar, Text, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import Close from '@react-spectrum/s2/icons/Close';
import Download from '@react-spectrum/s2/icons/Download';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { KERNEL_FALLBACK, familyKey, fontBar, liveFontJobs, liveRow, type FontRow } from '../../model/font-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import {
  cancelBatch,
  dismissBatch,
  downloadBatch,
  downloadFamily,
  leaveVideoFonts,
  openVideoFonts,
  skipCurrent,
  startFontLibrarySync,
  useFontLibrary,
} from '../../state/font-library-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { toastError } from './font-detail.tsx';
import { FONT_COPY as FC } from './font-copy.ts';

/**
 * Font bar shown when a video opens (product design §5.9 “字体” (Fonts); prototype font-downloads.jsx's FontOpenStrip): a strip above the stage, and the only place in the whole video that talks about font downloads. The Runtime checks which families are used (`fonts.usage`) and starts downloads according to the auto-download setting; families that failed within the last ten minutes are not retried automatically. This bar shows: downloads in progress (which one, the family name and progress, with skip-this and cancel-all), all downloaded (collapses itself after 3 seconds), failed (view: family → fallback font · reason, with retry), and auto-download off (download / settings). While downloading, the picture is drawn in the fallback font and switches once the font arrives (the preview itself needs the font).
 */

const strip = style({
  flexShrink: 0,
  marginBottom: 8,
  paddingX: 16,
  paddingY: '[6px]',
  borderRadius: 'xl',
  font: 'ui-sm',
  backgroundColor: { default: 'gray-100', tone: { ready: 'green-100', notice: 'orange-100' } },
  color: { default: 'gray-900', tone: { ready: 'green-1000', notice: 'orange-1000' } },
});
const line = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24 });
const text = style({ flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const meta = style({ color: 'gray-700' });
const mono = style({ fontFamily: 'code' });
const bar = style({ width: 'full', marginTop: 4 });
const list = style({ display: 'grid', gap: 4, marginTop: '[6px]', marginBottom: 0, padding: 0, listStyleType: 'none' });
const item = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const detail = style({ flexGrow: 1, minWidth: 0, color: 'gray-700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const icon = style({ display: 'flex', flexShrink: 0 });
const nowrap = style({ flexShrink: 0 });

export function FontBar({ videoId }: { videoId: Id | null }) {
  const { client, host } = useRuntime();
  // The browser session has no `fonts.*`: the Web entry does not check and does not draw this bar.
  const web = host.platform === 'web';
  const auto = useSetting('fonts.autoDownload');
  const settingsLoaded = auto !== null;
  const batch = useFontLibrary((s) => s.batch);
  const statuses = useFontLibrary((s) => s.statuses);
  const usage = useFontLibrary((s) => (videoId ? s.usage[videoId] : undefined));
  const jobs = useJobs((s) => s.jobs);
  const [open, setOpen] = useState(false);

  useEffect(() => (web ? undefined : startFontLibrarySync(client)), [client, web]);
  // Check once when the video opens (only then does the mirrored setting show whether auto-download is on).
  useEffect(() => {
    if (web || !settingsLoaded || !videoId) return;
    void openVideoFonts(client, videoId, auto !== false).catch(() => {});
    return () => leaveVideoFonts(videoId);
    // Check only on open: changing the settings later does not trigger a new check.
  }, [client, videoId, settingsLoaded, web]);

  const live = useMemo(() => liveFontJobs(jobs), [jobs]);
  const shown = useMemo(() => {
    if (!batch || batch.videoId !== videoId) return null;
    const byName = new Map<string, FontRow>();
    for (const family of batch.families) {
      const status = statuses[familyKey(family)];
      if (status) byName.set(familyKey(family), liveRow(status, live.get(familyKey(family))));
    }
    const fallbackOf = (family: string) =>
      usage?.families.find((f) => familyKey(f.family) === familyKey(family))?.fallback ?? usage?.fallback ?? KERNEL_FALLBACK;
    return fontBar(batch, byName, fallbackOf);
  }, [batch, videoId, statuses, live, usage]);

  const kind = shown?.kind;
  useEffect(() => {
    if (kind !== 'ready') return;
    const timer = setTimeout(dismissBatch, 3000);
    return () => clearTimeout(timer);
  }, [kind]);

  if (!shown) return null;
  const tone = shown.kind === 'ready' ? 'ready' : shown.kind === 'running' ? undefined : 'notice';
  const goSettings = () => useShell.getState().go({ tab: 'settings', section: 'fonts' });
  return (
    <div className={strip({ tone })} role="status" aria-live="polite">
      <div className={line}>
        <span className={icon}>
          {shown.kind === 'ready' ? <CheckmarkCircle /> : shown.kind === 'running' ? <Download /> : <AlertTriangle />}
        </span>
        <span className={text}>
          {shown.title}
          {shown.kind === 'running' ? (
            <span className={meta}>
              {' '}
              · {shown.count} · {shown.current} <span className={mono}>{shown.progress}</span>
            </span>
          ) : null}
        </span>
        {shown.kind === 'running' ? (
          <>
            <ActionButton isQuiet size="S" styles={nowrap} onPress={() => void skipCurrent(client).catch(toastError)}>
              {FC.skipThis}
            </ActionButton>
            <Tip text={FC.cancelAllTip}>
              <ActionButton isQuiet size="S" aria-label={FC.cancelAll} onPress={() => void cancelBatch(client).catch(toastError)}>
                <Close />
              </ActionButton>
            </Tip>
          </>
        ) : null}
        {shown.kind === 'missed' ? (
          <>
            <ActionButton isQuiet size="S" styles={nowrap} onPress={() => setOpen(!open)}>
              {open ? FC.collapse : FC.view}
            </ActionButton>
            <Tip text={FC.gotIt}>
              <ActionButton isQuiet size="S" aria-label={FC.gotIt} onPress={dismissBatch}>
                <Close />
              </ActionButton>
            </Tip>
          </>
        ) : null}
        {shown.kind === 'off' ? (
          <>
            <Button variant="secondary" size="S" onPress={() => void downloadBatch(client).catch(toastError)}>
              {FC.download}
            </Button>
            <ActionButton isQuiet size="S" styles={nowrap} onPress={goSettings}>
              {FC.settings}
            </ActionButton>
            <Tip text={FC.gotIt}>
              <ActionButton isQuiet size="S" aria-label={FC.gotIt} onPress={dismissBatch}>
                <Close />
              </ActionButton>
            </Tip>
          </>
        ) : null}
      </div>
      {shown.kind === 'running' ? (
        <ProgressBar
          aria-label={FC.progress}
          size="S"
          styles={bar}
          value={shown.value ?? undefined}
          isIndeterminate={shown.value === null}
        />
      ) : null}
      {(shown.kind === 'missed' && open) || shown.kind === 'off' ? (
        <ul className={list}>
          {shown.rows.map((r) => (
            <li key={r.family} className={item}>
              <b>{r.family}</b>
              <span className={detail}>
                → {r.fallback} · {r.reason}
              </span>
              {shown.kind === 'missed' ? (
                <ActionButton isQuiet size="S" styles={nowrap} onPress={() => void downloadFamily(client, r.family).catch(toastError)}>
                  <Refresh />
                  <Text>{FC.retry}</Text>
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Tip({ text: label, children }: { text: string; children: ReactElement }) {
  return (
    <TooltipTrigger placement="top">
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
