import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AssetRecord, Id, JobRecord, ModelCapabilitiesView, Sequence } from '@cuccut/protocol';
import { EditLabel } from '@cuccut/protocol/messages/ui';
import { ActionButton, Badge, Button, Picker, PickerItem, ProgressBar, Slider, Text, TextField, ToastQueue } from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import CheckmarkCircle from '@react-spectrum/s2/icons/CheckmarkCircle';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { frameAt } from '../../model/editor.ts';
import { isPlaceable, placeAsset } from '../../model/editor-ops.ts';
import { editorSpeechRequest, ttsStage, withVideo } from '../../model/media-generation.ts';
import { cancellationCost } from '../../model/task-facts.ts';
import { jobPercent } from '../../model/task-list.ts';
import { cloudModelOptions, findOption, initialModelKey, languageOptions, languagesShort, providerName } from '../../model/tools-models.ts';
import { aheadOf, failureText, phaseLabel, queuedDetail } from '../../model/tools-records.ts';
import {
  audioOutput,
  customVoiceAllowed,
  rollVibe,
  sampleText,
  speechMeta,
  speechModelLine,
  speechRetry,
  speedValue,
  switchModel,
  textStats,
  ttsProblems,
  ttsStatus,
  voiceKeyFor,
  type MyVoices,
  type SpeechOption,
  type TtsDraft,
} from '../../model/tools-tts.ts';
import { cloneVoiceKey, voiceValueLine } from '../../model/voice-picker.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useVoices } from '../../state/voices-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { ModelGate, ModelLine } from '../tools/tool-model.tsx';
import { Gate, RecordCard, SectionLink, submitOnModEnter, ToolTextArea } from '../tools/tool-parts.tsx';
import { GATE_COPY, RECORD_COPY, TTS_COPY } from '../tools/tools-copy.ts';
import { useArtifactUrl, useCancelJob, useRecordRetry, useSubmitFailed } from '../tools/use-tool-records.ts';
import { VoicePicker } from '../voice-picker.tsx';
import { useEditorActions } from './editor-context.tsx';
import { AUDIO_GEN_COPY as C } from './media-gen-copy.ts';
import { useMediaGen, useMediaGenStore, type AudioSubpage } from './media-gen-store.ts';
import { PanelHead } from './panel-head.tsx';

/*
 * Cloud sub-page of the Audio tab, “生成语音 / 克隆声音” (Generate speech / Clone voice) (design panel-tts.jsx `TtsPanel`, cloud part): one form with two entry points. “克隆声音” (Clone voice) first selects one of my voices that has been cloned with this provider. Synthesis goes through `models.synthesizeSpeech` with `videoId`: when it finishes, the Runtime files the result into this video's asset library. Placing it on the timeline is a separate step. The local engine, phonetic annotation, emotion, and “按句放到时间轴” (place per sentence on the timeline) have no contract in this version and are not drawn.
 */

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 4, paddingBottom: 16 });
const secHead = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 });
const secTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const hint = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]', overflowWrap: 'anywhere' });
const status = style({ margin: 0, font: 'ui-xs', color: { default: 'gray-700', isBad: 'orange-1000' }, overflowWrap: 'anywhere' });
const field = style({ width: 'full' });
const customField = style({ width: 'full', marginTop: 8 });
const textFoot = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, minWidth: 0 });
const textStat = style({ flexGrow: 1, minWidth: 0, font: 'ui-xs', color: { default: 'gray-600', isOver: 'red-900' } });
const stack = style({ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 });
const footer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '[6px]',
  flexShrink: 0,
  paddingX: 12,
  paddingY: 12,
  borderTopWidth: 1,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const cardTitle = style({ margin: 0, font: 'ui-sm', fontWeight: 'bold', color: { default: 'gray-900', isFailed: 'orange-1000' }, overflowWrap: 'anywhere' });
const doneTitle = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  margin: 0,
  font: 'ui-sm',
  fontWeight: 'bold',
  color: 'gray-900',
  overflowWrap: 'anywhere',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const okIcon = style({ display: 'flex', flexShrink: 0, color: 'green-1000', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const actions = style({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 });
const quote = style({ margin: 0, font: 'ui-xs', color: 'gray-700', lineClamp: 3, overflowWrap: 'anywhere' });
const player = style({ display: 'block', width: 'full' });

export function TtsPanel({ videoId, page, sequence, assets }: { videoId: Id; page: AudioSubpage; sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const view = useModels((s) => s.capabilities);
  // My voices: null until read (library voices do not check clone status yet; the Runtime checks).
  const myVoices = useVoices((s) => (s.ready ? s.voices : null));
  const state = useMediaGen(videoId);
  const patch = useMediaGenStore((s) => s.patch);
  const patchTts = useMediaGenStore((s) => s.patchTts);
  const jobs = useJobs((s) => s.jobs);
  const editable = useVideo((s) => canEdit(s.video));
  const draft = state.tts;
  const job = state.ttsJob ? (jobs.find((j) => j.jobId === state.ttsJob) ?? null) : null;
  const stage = ttsStage(state.ttsJob, job);
  const clone = page === 'clone';
  const title = clone ? C.clone : C.generate;

  const options = useMemo(() => (view ? cloudModelOptions(view, 'synthesizeSpeech') : []), [view]);
  const option = findOption(options, initialModelKey(options, draft.model, view?.synthesizeSpeech.effective ?? null));
  const setDraft = (next: Partial<TtsDraft>) => patchTts(videoId, next);

  // Entering “克隆声音” (Clone voice) first selects one of my voices that has been cloned with this provider (chosen once, after my voices and models are read; after that, the user changes it).
  const picked = useRef(false);
  useEffect(() => {
    if (!clone || picked.current || !myVoices || !view) return;
    picked.current = true;
    const key = cloneVoiceKey(draft, option, myVoices);
    if (key && key !== draft.voice) patchTts(videoId, { voice: key });
  }, [clone, myVoices, view, draft, option, patchTts, videoId]);

  // Cancelled (here or on the background task page): return to the form and state the cost honestly.
  const cancelledId = job?.state === 'cancelled' ? job.jobId : null;
  useEffect(() => {
    if (!cancelledId || !job) return;
    const cost = job.cancellation ? cancellationCost(job.cancellation) : null;
    ToastQueue.neutral(cost ? `${C.cancelled} · ${cost}` : C.cancelled, { timeout: 4000 });
    patch(videoId, { ttsJob: null });
  }, [cancelledId, job, patch, videoId]);

  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitFailed = useSubmitFailed('synthesizeSpeech', TTS_COPY.submitFailed);
  const bar = ttsStatus(draft, option, tried, myVoices);

  const generate = () => {
    setTried(true);
    if (!option || !option.usable || submitting || !editable) return;
    const problems = ttsProblems(draft, option, myVoices);
    if (problems.length) {
      ToastQueue.neutral(problems[0]!, { timeout: 4000 });
      return;
    }
    setSubmitting(true);
    runtime
      .synthesizeSpeech(editorSpeechRequest(draft, option, videoId))
      // Once submitted, record this task: switching the panel away and back still shows its progress.
      .then((jobId) => patch(videoId, { ttsJob: jobId }), submitFailed)
      .finally(() => setSubmitting(false));
  };

  // Returning while it runs only collapses the sub-page. The task keeps running and can be seen again on return. Returning after it finishes or fails abandons this attempt.
  const back = () => patch(videoId, stage === 'run' ? { audio: null } : { audio: null, ttsJob: null });
  const head = (
    <PanelHead title={title} back={{ label: C.back, onPress: back }}>
      {stage === 'run' ? (
        <Badge variant="informative" size="S" fillStyle="subtle">
          {C.running}
        </Badge>
      ) : null}
    </PanelHead>
  );

  if (stage !== 'setup') {
    return (
      <>
        {head}
        <div className={`${body} cc-scroll`}>
          {stage === 'run' ? (
            <RunView title={title} job={job} all={jobs} view={view} />
          ) : job && stage === 'done' ? (
            <DoneView
              job={job}
              view={view}
              sequence={sequence}
              assets={assets}
              editable={editable}
              onAgain={() => patch(videoId, { ttsJob: null })}
              onBack={back}
            />
          ) : job ? (
            <FailedView job={job} videoId={videoId} onEdit={() => patch(videoId, { ttsJob: null })} />
          ) : null}
        </div>
      </>
    );
  }

  const toConnect = () => go({ tab: 'models', category: 'tts', page: 'cloud' });
  const maxChars = option?.info.maxInputChars ?? 0;
  const over = maxChars > 0 && Array.from(draft.text.trim()).length > maxChars;

  return (
    <>
      {head}
      <div className={`${body} cc-scroll`} onKeyDown={submitOnModEnter(generate)}>
        {clone && myVoices && !myVoices.length ? (
          <div className={stack}>
            <Gate
              title={C.noVoicesTitle}
              body={C.noVoicesBody}
              actions={
                <Button variant="secondary" size="S" onPress={() => go({ tab: 'models', category: 'tts', page: 'voices' })}>
                  {C.goVoices}
                </Button>
              }
            />
          </div>
        ) : null}

        <SubHead title={TTS_COPY.textLabel} />
        <ToolTextArea
          compact
          label={TTS_COPY.textLabel}
          value={draft.text}
          onChange={(text) => setDraft({ text })}
          placeholder={clone ? C.clonePlaceholder : C.textPlaceholder}
        />
        <div className={textFoot}>
          <span className={textStat({ isOver: over })}>{textStats(draft.text, maxChars || 4096)}</span>
          {draft.text ? (
            <SectionLink onPress={() => setDraft({ text: '' })}>{TTS_COPY.clear}</SectionLink>
          ) : (
            <SectionLink onPress={() => setDraft({ text: sampleText(draft, option?.info ?? null) })}>{TTS_COPY.sample}</SectionLink>
          )}
        </div>

        <SubHead title={TTS_COPY.model} aside={<SectionLink onPress={toConnect}>{TTS_COPY.manage}</SectionLink>} />
        {!view ? (
          <p className={hint}>{RECORD_COPY.loadingMedia}</p>
        ) : options.length ? (
          <>
            <ModelLine
              label={TTS_COPY.modelPicker}
              options={options}
              selected={option}
              onSelect={(o) => setDraft(switchModel(draft, o))}
              factsOf={(o) => speechModelLine(o.info)}
            />
            <ModelGate selected={option} options={options} body={GATE_COPY.ttsBody} onConnect={toConnect} onSwitch={(o) => setDraft(switchModel(draft, o))} />
          </>
        ) : (
          <Gate
            title={TTS_COPY.noModel}
            body={TTS_COPY.noModelBody}
            actions={
              <Button variant="secondary" size="S" onPress={toConnect}>
                {TTS_COPY.goConnect}
              </Button>
            }
          />
        )}

        {option ? <VoiceRows key={option.key} draft={draft} option={option} voices={myVoices} setDraft={setDraft} /> : null}
      </div>
      <div className={footer}>
        <Button variant="secondary" styles={field} isDisabled={!option?.usable || !editable} isPending={submitting} onPress={generate}>
          {clone ? C.cloneCta : C.cta}
        </Button>
        <p className={status({ isBad: bar.bad })} role="status" aria-live="polite">
          {bar.text}
        </p>
        <p className={hint}>{!editable ? C.readOnly : option ? C.hint(option.provider) : null}</p>
      </div>
    </>
  );
}

function SubHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className={secHead}>
      <h3 className={secTitle}>{title}</h3>
      {aside}
    </div>
  );
}

/** Voice, style, speed, language (design `CloudRows`): one item per row in the narrow column. */
function VoiceRows({ draft, option, voices, setDraft }: { draft: TtsDraft; option: SpeechOption; voices: MyVoices; setDraft: (p: Partial<TtsDraft>) => void }) {
  const info = option.info;
  const voiceKey = voiceKeyFor(draft, info);
  const range = info.speedRange;
  const languages = languageOptions(info.languages);
  const language = languages.some((l) => l.key === draft.language) ? draft.language : '';
  return (
    <>
      <SubHead title={TTS_COPY.voiceLabel} />
      <VoicePicker label={TTS_COPY.voiceLabel} styles={field} draft={draft} option={option} voices={voices} onChange={(voice) => setDraft({ voice })} />
      {voiceKey === 'custom' && customVoiceAllowed(info) ? (
        <TextField
          aria-label={TTS_COPY.customVoice}
          size="S"
          styles={customField}
          placeholder={TTS_COPY.customVoicePlaceholder}
          value={draft.customVoice}
          onChange={(customVoice) => setDraft({ customVoice })}
        />
      ) : null}
      <p className={hint}>{voiceValueLine(draft, option, voices)}</p>

      {info.acceptsInstructions ? (
        <>
          <SubHead title={TTS_COPY.style} aside={<SectionLink onPress={() => setDraft(rollVibe(draft, info))}>{TTS_COPY.roll}</SectionLink>} />
          <TextField
            aria-label={TTS_COPY.styleLabel}
            size="S"
            styles={field}
            placeholder={TTS_COPY.stylePlaceholder}
            value={draft.instructions}
            onChange={(instructions) => setDraft({ instructions })}
          />
        </>
      ) : null}

      {range ? (
        <>
          <SubHead
            title={TTS_COPY.speed}
            aside={draft.speed !== null ? <SectionLink onPress={() => setDraft({ speed: null })}>{TTS_COPY.resetSpeed}</SectionLink> : null}
          />
          <Slider
            aria-label={TTS_COPY.speed}
            labelPosition="side"
            size="S"
            styles={field}
            minValue={range.min}
            maxValue={range.max}
            step={0.05}
            formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            value={speedValue(draft, range)}
            onChange={(speed) => setDraft({ speed })}
          />
          <p className={hint}>{TTS_COPY.speedRange(option.provider, range.min, range.max, info.acceptsInstructions)}</p>
        </>
      ) : info.acceptsInstructions ? (
        <p className={hint}>{TTS_COPY.noSpeed(option.provider)}</p>
      ) : null}

      <SubHead title={TTS_COPY.language} />
      <Picker
        aria-label={TTS_COPY.language}
        size="S"
        styles={field}
        items={languages}
        selectedKey={language}
        onSelectionChange={(key) => key !== null && setDraft({ language: String(key) })}>
        {(l) => <PickerItem id={l.key}>{l.label}</PickerItem>}
      </Picker>
      <p className={hint}>{TTS_COPY.languageNote(option.provider, languagesShort(info.languages), !language)}</p>
    </>
  );
}

/** In progress (design `Job` progress card): stage, progress, cancel. If the task has not yet appeared in the task mirror, show an indeterminate bar first. */
function RunView({ title, job, all, view }: { title: string; job: JobRecord | null; all: readonly JobRecord[]; view: ModelCapabilitiesView | null }) {
  const cancel = useCancelJob();
  const pct = job ? jobPercent(job) : null;
  const provider = job ? providerName(view, 'synthesizeSpeech', job.providerId) : null;
  const line = job
    ? `${job.state === 'queued' ? (queuedDetail(job) ?? RECORD_COPY.ahead(aheadOf(all, job))) : phaseLabel(job)} · ${provider} · ${job.modelId}`
    : RECORD_COPY.loadingMedia;
  return (
    <div className={stack}>
      <RecordCard running={job?.state !== 'queued'} label={C.runTitle(title)}>
        <p className={cardTitle({})}>{C.runTitle(title)}</p>
        <ProgressBar size="S" styles={field} aria-label={line} isIndeterminate={pct === null} value={pct ?? undefined} />
        <span className={hint}>{line}</span>
      </RecordCard>
      <p className={hint}>{C.runNote}</p>
      <div className={actions}>
        <Button variant="secondary" size="S" isDisabled={!job} onPress={() => job && cancel(job.jobId)}>
          {C.cancel}
        </Button>
      </div>
    </div>
  );
}

/** Done (design `aplbar` + asset card + playback bar): already filed into the asset library; “加到时间线” (Add to timeline) sits at the playhead. */
function DoneView({
  job,
  view,
  sequence,
  assets,
  editable,
  onAgain,
  onBack,
}: {
  job: JobRecord;
  view: ModelCapabilitiesView | null;
  sequence: Sequence;
  assets: Record<Id, AssetRecord>;
  editable: boolean;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { apply } = useEditorActions();
  const out = audioOutput(job);
  const media = useArtifactUrl(out?.artifactId ?? null);
  const asset = out?.assetId ? (assets[out.assetId] ?? null) : null;
  const placeable = asset && isPlaceable(asset) ? asset : null;
  const provider = providerName(view, 'synthesizeSpeech', job.providerId);
  const add = () => {
    if (!placeable) return;
    void apply(placeAsset(sequence, placeable, frameAt(useEditor.getState().playhead, sequence.fps)), EditLabel.addClip());
  };
  return (
    <div className={stack}>
      <p className={doneTitle}>
        <span className={okIcon} aria-hidden>
          <CheckmarkCircle />
        </span>
        <span>{C.done(speechMeta(job, provider))}</span>
      </p>
      {media?.status === 'ready' ? (
        <audio className={player} controls preload="metadata" src={media.url} aria-label={asset?.name ?? C.generate} />
      ) : (
        <p className={hint}>{media?.status === 'failed' ? RECORD_COPY.openFailed(media.message) : RECORD_COPY.loadingMedia}</p>
      )}
      <p className={hint}>{asset ? C.inLibrary(asset.name) : C.importing}</p>
      <div className={actions}>
        <Button variant="secondary" size="S" isDisabled={!placeable || !editable} onPress={add}>
          <Add />
          <Text>{C.add}</Text>
        </Button>
        <ActionButton size="S" onPress={onAgain}>
          <Refresh />
          <Text>{C.again}</Text>
        </ActionButton>
        <ActionButton size="S" isQuiet onPress={onBack}>
          <Text>{C.backToAudio}</Text>
        </ActionButton>
      </div>
      <p className={hint}>{C.doneNote}</p>
    </div>
  );
}

/** Failed: the reason, retry (with the frozen parameters, still returning to this video), or edit and generate again. For an uncertain result, handle it in task details. */
function FailedView({ job, videoId, onEdit }: { job: JobRecord; videoId: Id; onEdit: () => void }) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const patch = useMediaGenStore((s) => s.patch);
  const again = useRecordRetry(
    job,
    'synthesizeSpeech',
    (j) => {
      const request = withVideo(speechRetry(j), videoId);
      return request ? runtime.synthesizeSpeech(request).then((jobId) => patch(videoId, { ttsJob: jobId })) : null;
    },
    { submitted: C.retried, failed: TTS_COPY.submitFailed },
  );
  const unknown = job.state === 'needs-reconciliation';
  return (
    <div className={stack}>
      <RecordCard failed label={C.failed(failureText(job))}>
        <p className={cardTitle({ isFailed: true })}>{C.failed(failureText(job))}</p>
        <p className={quote}>{job.generation?.capability === 'synthesizeSpeech' ? job.generation.text : ''}</p>
        {unknown ? <span className={hint}>{RECORD_COPY.reconcileNote}</span> : null}
        <div className={actions}>
          {unknown ? (
            <Button variant="secondary" size="S" onPress={() => go({ tab: 'tasks', taskId: job.jobId })}>
              <OpenIn />
              <Text>{RECORD_COPY.reconcile}</Text>
            </Button>
          ) : again.done ? null : (
            <Button variant="secondary" size="S" isPending={again.pending} onPress={again.retry}>
              <Refresh />
              <Text>{RECORD_COPY.retry}</Text>
            </Button>
          )}
          <ActionButton size="S" isQuiet onPress={onEdit}>
            <Text>{C.edit}</Text>
          </ActionButton>
        </div>
      </RecordCard>
    </div>
  );
}
