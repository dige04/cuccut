import { useMemo, useRef, useState } from 'react';
import type { JobRecord, MusicMode } from '@cuccut/protocol';
import { ActionButton, Button, SegmentedControl, SegmentedControlItem, Slider, Text, TextField, ToastQueue, ToggleButton } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { downloadableBundle } from '../../model/models-install.ts';
import { modelReason, saveTarget, withSaveDir } from '../../model/tool-frame.ts';
import { findOption, initialModelKey } from '../../model/tools-models.ts';
import {
  DURATION,
  maxOf,
  maxSecOf,
  modeDesc,
  modeLabel,
  modesOf,
  musicAgainDraft,
  musicHeaderChip,
  musicModelLine,
  musicModelOptions,
  musicProblems,
  musicRequest,
  musicStatus,
  MUSIC_STYLES,
  planningDesc,
  planningFor,
  planningLabel,
  planningsOf,
  setTarget,
  soundtrackFor,
  styleLabel,
  switchMusicModel,
  tokens,
  TOKENS_PER_SEC,
  etaText,
} from '../../model/tools-music.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { useNow } from '../use-now.ts';
import { MusicIcon } from '../music-icon.tsx';
import { MUSIC_LOCAL_COPY } from '../models/music-local-copy.ts';
import { EmptyCard, PageStatus } from '../models/model-parts.tsx';
import { LocalDownloadGate } from './local-model-gate.tsx';
import { MusicRecord } from './music-record.tsx';
import { MUSIC_TOOL_COPY as COPY } from './music-tool-copy.ts';
import { ModelRow, SaveDirRow } from './tool-frame.tsx';
import {
  BarStatus,
  detail,
  detailGrow,
  HeaderChip,
  Row,
  Section,
  SectionLink,
  SideFoot,
  SideHead,
  submitOnModEnter,
  ToolPage,
  ToolTextArea,
  Workbench,
} from './tool-parts.tsx';
import { GALLERY_COPY, RECORD_COPY, SAVE_COPY } from './tools-copy.ts';
import { useSubmitFailed, useToolRecords } from './use-tool-records.ts';
import { useToolStatus } from './use-tool-status.ts';
import type { ToolPreset } from './use-video-tools.ts';
import { usePreset, useRerun } from './video-tool-parts.tsx';

/*
 * Design file tool-music.jsx `MusicToolPage`: form → style (an English description, chips can be filled) → lyrics (when sung) → duration (target and maximum) → plan → model and seed → save location,
 * with the generation records on the right. Only local models are used (music generation has no cloud provider). The fields have the same names as the Runtime's GenerateMusicRequest (model/tools-music.ts).
 * When entered from the editor's AI tool “Generate soundtrack” (`ToolPreset.soundtrack`), the duration is pre-filled from that video (if it is longer than the model's single-run maximum, the maximum is pre-filled and the banner states that it will loop to fill),
 * and the submission carries `videoId`. When done, the Runtime imports it into that video's assets, and the editor then lays the music track down (editor/soundtrack-bed.tsx).
 */

const chips = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 });
const slider = style({ flexGrow: 1, minWidth: 160 });
/** The slider's built-in readout is localized, e.g. “30 秒 / 30 sec”. The maximum does not snap to the 5-second step; it follows the target plus “20% more”, e.g. 36, and must display that value exactly. */
const SECONDS: Intl.NumberFormatOptions = { style: 'unit', unit: 'second', unitDisplay: 'short' };
const seedField = style({ width: 140 });
const card = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 4,
  padding: 12,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'informative-700',
  backgroundColor: 'informative-subtle',
  minWidth: 0,
});
const cardTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });

type Soundtrack = NonNullable<ToolPreset['soundtrack']>;

/** Generate music (local). Submission goes through `models.generateMusic`; the records are jobs of this kind in the `jobs` topic. */
export function MusicTool() {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const view = useModels((s) => s.capabilities);
  const bundles = useModels((s) => s.bundles);
  const draft = useTools((s) => s.music);
  const patch = useTools((s) => s.patchMusic);
  const records = useToolRecords('generateMusic');
  const now = useNow(30_000);
  const styleRef = useRef<HTMLTextAreaElement>(null);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitFailed = useSubmitFailed('generateMusic', COPY.submitFailed);
  const { saveDirectory } = useToolStatus();
  const [saveOverride, setSaveOverride] = useState<string | null>(null);
  // The video brought in by “Generate soundtrack”; it lives only on this page and is cleared after one submission.
  const [soundtrack, setSoundtrack] = useState<Soundtrack | null>(null);

  const options = useMemo(() => (view ? musicModelOptions(view) : []), [view]);
  const option = findOption(options, initialModelKey(options, draft.model, view?.generateMusic.effective ?? null));
  const info = option?.info ?? null;
  const limit = maxSecOf(info);

  usePreset('generate-music', (_entryId, preset) => {
    if (!preset.soundtrack) return;
    setSoundtrack(preset.soundtrack);
    patch(setTarget(draft, soundtrackFor(preset.soundtrack.videoSec, limit).targetDurationSec));
  });
  // The video is longer than the selected model's single-run maximum: the banner states that the maximum length will be generated and looped to fill (switching models re-evaluates against that model's maximum).
  const soundtrackLoop = soundtrack ? soundtrackFor(soundtrack.videoSec, limit).loop : false;

  const reason = view ? modelReason(options, option, COPY.noun) : null;
  const status = reason ? { text: reason, bad: true } : musicStatus(draft, option, tried);
  const toSettings = () => go({ tab: 'models', category: 'music', page: 'local' });
  const gateBundle = downloadableBundle(bundles, option);

  const generate = () => {
    setTried(true);
    if (!option || !option.usable || submitting) return;
    const problems = musicProblems(draft, option);
    if (problems.length) {
      ToastQueue.neutral(problems[0]!, { timeout: 4000 });
      return;
    }
    const target = soundtrack;
    setSubmitting(true);
    runtime
      .generateMusic(withSaveDir(musicRequest(draft, option, target?.videoId ?? null), saveTarget(saveDirectory, saveOverride)))
      .then((jobId) => {
        if (!target) {
          ToastQueue.positive(COPY.submitted, { timeout: 3000 });
          return;
        }
        // Jobs with a video are not listed in this page's records (tool records list only jobs without a video); a button to go to background jobs is shown instead.
        setSoundtrack(null);
        ToastQueue.positive(COPY.submittedFor(target.videoName), {
          actionLabel: COPY.viewTask,
          onAction: () => go({ tab: 'tasks', taskId: jobId }),
          shouldCloseOnAction: true,
        });
      }, submitFailed)
      .finally(() => setSubmitting(false));
  };

  const reuse = (job: JobRecord) => {
    const next = musicAgainDraft(job);
    if (!next) return;
    patch(next);
    styleRef.current?.focus();
    ToastQueue.neutral(COPY.reused, { timeout: 3000 });
  };
  useRerun('generate-music', reuse);

  const bar = (
    <>
      <BarStatus text={status.text} bad={status.bad} />
      <Button variant="accent" isDisabled={!option?.usable} isPending={submitting} onPress={generate}>
        <MusicIcon />
        <Text>{COPY.submit}</Text>
      </Button>
    </>
  );

  if (!view) {
    return (
      <ToolPage title={COPY.title}>
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      </ToolPage>
    );
  }

  const modes = modesOf(info);
  const mode = modes.includes(draft.mode) ? draft.mode : (modes[0] ?? draft.mode);
  const plannings = planningsOf(info);
  const planning = planningFor(draft, info);
  const max = maxOf(draft, limit);
  const modelName = (job: JobRecord) => options.find((o) => o.providerId === job.providerId && o.modelId === job.modelId)?.label ?? job.modelId;

  const main = (
    <>
      {soundtrack ? (
        <div className={card} role="note">
          <span className={cardTitle}>{COPY.soundtrackTitle(soundtrack.videoName)}</span>
          <span className={detail}>
            {soundtrackLoop ? COPY.soundtrackLoopBody(Math.round(soundtrack.videoSec), limit) : COPY.soundtrackBody(draft.targetDurationSec)}
          </span>
          <ActionButton isQuiet size="S" onPress={() => setSoundtrack(null)}>
            <Text>{COPY.soundtrackOff}</Text>
          </ActionButton>
        </div>
      ) : null}

      <Section title={COPY.mode}>
        <SegmentedControl aria-label={COPY.mode} selectedKey={mode} onSelectionChange={(key) => patch({ mode: key as MusicMode })}>
          {modes.map((m) => (
            <SegmentedControlItem key={m} id={m}>
              {modeLabel(m)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <span className={detail}>{modeDesc(mode)}</span>
      </Section>

      <Section title={COPY.style} aside={<span className={detail}>{COPY.styleAside}</span>}>
        <ToolTextArea label={COPY.style} inputRef={styleRef} value={draft.style} onChange={(s) => patch({ style: s })} placeholder={COPY.stylePlaceholder} compact />
        <div className={chips}>
          {MUSIC_STYLES.map((s) => (
            <ToggleButton key={s.key} size="S" isSelected={draft.style === s.style} onChange={() => patch({ style: s.style })}>
              {styleLabel(s.key)}
            </ToggleButton>
          ))}
          {draft.style ? <SectionLink onPress={() => patch({ style: '' })}>{COPY.clear}</SectionLink> : null}
        </div>
      </Section>

      {mode === 'song' ? (
        <Section title={COPY.lyrics} aside={<span className={detail}>{COPY.lyricsAside}</span>}>
          <ToolTextArea label={COPY.lyrics} value={draft.lyrics} onChange={(lyrics) => patch({ lyrics })} placeholder={COPY.lyricsPlaceholder} />
        </Section>
      ) : null}

      <Section title={COPY.duration} aside={<span className={detail}>{etaText(draft.targetDurationSec, { planning })}</span>}>
        <Row label={COPY.target}>
          <Slider
            aria-label={COPY.target}
            labelPosition="side"
            size="S"
            formatOptions={SECONDS}
            styles={slider}
            minValue={DURATION.min}
            maxValue={limit}
            step={DURATION.step}
            value={Math.min(draft.targetDurationSec, limit)}
            onChange={(sec) => patch(setTarget(draft, sec))}
          />
        </Row>
        <Row label={COPY.limit}>
          <Slider
            aria-label={COPY.limit}
            labelPosition="side"
            size="S"
            formatOptions={SECONDS}
            styles={slider}
            minValue={Math.min(draft.targetDurationSec, limit)}
            maxValue={limit}
            step={1}
            value={max}
            onChange={(sec) => patch({ maxDurationSec: sec })}
          />
          {draft.maxDurationSec !== null ? <SectionLink onPress={() => patch({ maxDurationSec: null })}>{COPY.followTarget}</SectionLink> : null}
        </Row>
        <span className={detail}>{COPY.durationNote(tokens(max), TOKENS_PER_SEC)}</span>
      </Section>

      <Section title={COPY.planning}>
        <div className={chips}>
          {plannings.map((p) => (
            <ToggleButton key={p} size="S" isSelected={planning === p} onChange={() => patch({ planning: p })}>
              {planningLabel(p)}
            </ToggleButton>
          ))}
        </div>
        <span className={detail}>{planningDesc(planning)}</span>
      </Section>

      <ModelRow
        noun={COPY.noun}
        manage={COPY.manage}
        onSettings={toSettings}
        options={options}
        selected={option}
        onSelect={(o) => patch(switchMusicModel(draft, o))}
        factsOf={(o) => musicModelLine(o.info)}
        localGate={!!gateBundle}>
        {gateBundle && option ? (
          <LocalDownloadGate
            bundle={gateBundle}
            name={option.label}
            category="music"
            licenseUse={MUSIC_LOCAL_COPY.licenseUse}
            body={(paused) => (paused ? COPY.downloadBodyPaused : COPY.downloadBody)}
          />
        ) : null}
        {info?.acceptsSeed ? (
          <Row label={COPY.seed}>
            <TextField
              aria-label={COPY.seed}
              size="S"
              styles={seedField}
              inputMode="numeric"
              placeholder={COPY.seedPlaceholder}
              value={draft.seed}
              onChange={(seed) => patch({ seed: seed.replace(/[^\d]/g, '') })}
            />
            <span className={detailGrow}>{COPY.seedNote}</span>
          </Row>
        ) : null}
      </ModelRow>

      <SaveDirRow saveDirectory={saveDirectory} override={saveOverride} onChange={setSaveOverride} note={COPY.saveNote} />
    </>
  );

  const list = records.list.filter((job) => job.state !== 'cancelled');
  const side = (
    <>
      <SideHead
        title={COPY.side}
        live={records.live ? RECORD_COPY.live(records.live) : null}
        count={RECORD_COPY.count(list.length)}
        extra={
          <ActionButton isQuiet size="S" onPress={() => go({ tab: 'space', category: 'audio', projectId: null })}>
            <Text>{SAVE_COPY.view}</Text>
          </ActionButton>
        }
      />
      {!records.ready ? (
        <PageStatus>{GALLERY_COPY.loading}</PageStatus>
      ) : list.length ? (
        list.map((job) => <MusicRecord key={job.jobId} job={job} all={records.all} modelName={modelName(job)} now={now} onReuse={reuse} />)
      ) : (
        <EmptyCard icon={<MusicIcon />} title={COPY.empty} body={COPY.emptyBody} />
      )}
      <SideFoot>{COPY.sideFoot}</SideFoot>
    </>
  );

  return (
    <ToolPage title={COPY.title} bar={bar} chip={<HeaderChip text={musicHeaderChip(option)} />}>
      <Workbench main={main} side={side} sideLabel={COPY.side} onKeyDown={submitOnModEnter(generate)} />
    </ToolPage>
  );
}
