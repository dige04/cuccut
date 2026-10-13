import { useMemo, useState } from 'react';
import type { Id, SubtitleExportFormat } from '@cuccut/protocol';
import { SegmentedControl, SegmentedControlItem, Switch } from '@react-spectrum/s2';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { toggleId } from '../../model/export-range.ts';
import { defaultFileNames, initialSubtitlePick, SUBTITLE_FORMATS, subtitleLanes, subtitlePlan, subtitleSettings } from '../../model/export-settings.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { SubmitFoot } from './export-footer.tsx';
import { FileRows, Lane, Lanes, Note, PlaceRow, Quick, QuickField, Sec, SumRow, Summary } from './export-parts.tsx';
import type { ExportEnv, ExportSubmit } from './use-export-submit.ts';

/**
 * The "Subtitles" page (design mockup export.jsx `SubsPage`): which tracks to export, the format, how multiple tracks are output, and the summary.
 *
 * One export produces one subtitle file (`documentId`; with two tracks, `bilingual` merges them into bilingual, with the first one as the main text). The mockup's "one file each" and three or more tracks at once cannot be done by the Runtime, so they are disabled, with a note to export in several rounds. The whole sequence is exported (this page in the mockup has no range).
 */

const row = style({ marginTop: 12 });

export function ExportSubtitlesTab({ env, submitter, onClose }: { env: ExportEnv; submitter: ExportSubmit; onClose: () => void }) {
  const lanes = useMemo(() => subtitleLanes(env.sequence, env.documents), [env.sequence, env.documents]);
  const [picked, setPicked] = useState<Id[]>(() => initialSubtitlePick(lanes));
  const [format, setFormat] = useState<SubtitleExportFormat>('srt');
  const live = picked.filter((id) => lanes.some((l) => l.documentId === id));
  const plan = subtitlePlan(lanes, live, true);
  const formatChoice = SUBTITLE_FORMATS.find((f) => f.key === format) ?? SUBTITLE_FORMATS[0]!;
  const settings = plan.options ? subtitleSettings(format, plan.options, {}) : null;
  const files = settings ? defaultFileNames(env.videoName, settings, env.documents) : [];
  const chosen = lanes.filter((l) => live.includes(l.documentId));
  const what = chosen.length ? `${EXPORT_COPY.subtitlesWhat(chosen.map((l) => l.label))} · ${formatChoice.label}` : '—';

  return (
    <>
      <Sec first>{EXPORT_COPY.subtitleLanes}</Sec>
      <Lanes label={EXPORT_COPY.subtitleLanes}>
        {lanes.length ? (
          lanes.map((lane) => {
            const on = live.includes(lane.documentId);
            return (
              <Lane
                key={lane.documentId}
                icon={<CloseCaptions />}
                name={lane.label}
                sub={lane.shown ? lane.name : `${lane.name} · ${EXPORT_COPY.hiddenOnTimeline}`}
                off={!on}
                end={<Switch size="S" aria-label={`${lane.label} · ${lane.name}`} isSelected={on} onChange={() => setPicked(toggleId(live, lane.documentId))} />}
              />
            );
          })
        ) : (
          <Lane icon={<CloseCaptions />} name={EXPORT_COPY.noSubtitles} sub={EXPORT_COPY.noSubtitlesSub} off />
        )}
      </Lanes>
      {plan.block === 'none' && lanes.length ? <Note warn>{EXPORT_COPY.pickOne}</Note> : null}
      {plan.block === 'too-many' ? <Note warn>{EXPORT_COPY.tooMany}</Note> : null}

      <div className={row}>
        <Quick>
          <QuickField label={EXPORT_COPY.format}>
            <SegmentedControl aria-label={EXPORT_COPY.format} selectedKey={format} onSelectionChange={(key) => setFormat(key as SubtitleExportFormat)}>
              {SUBTITLE_FORMATS.map((f) => (
                <SegmentedControlItem key={f.key} id={f.key}>
                  {f.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </QuickField>
          {live.length === 2 ? (
            <QuickField label={EXPORT_COPY.multiTrack}>
              <SegmentedControl aria-label={EXPORT_COPY.multiTrack} selectedKey="one">
                <SegmentedControlItem id="one">{EXPORT_COPY.mergeOne}</SegmentedControlItem>
                <SegmentedControlItem id="each" isDisabled>
                  {EXPORT_COPY.eachOne}
                </SegmentedControlItem>
              </SegmentedControl>
            </QuickField>
          ) : null}
        </Quick>
      </div>
      <Note>{formatChoice.note}</Note>
      {live.length === 2 ? (
        <Note>
          {EXPORT_COPY.bilingualNote} · {EXPORT_COPY.eachBlocked}
        </Note>
      ) : null}

      <Summary>
        <SumRow label={EXPORT_COPY.willExport}>{what}</SumRow>
        <FileRows names={files} />
        <PlaceRow videoId={env.videoId} />
      </Summary>

      <SubmitFoot env={env} submitter={submitter} settings={settings} label={EXPORT_COPY.exportSubtitles} onClose={onClose} />
    </>
  );
}
