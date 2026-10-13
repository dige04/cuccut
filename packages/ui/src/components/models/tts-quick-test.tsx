import { useMemo, useState, type ReactNode } from 'react';
import type { SpeechModelInfo } from '@cuccut/protocol';
import { ActionButton, Button, Picker, PickerItem, ProgressBar, Text, TextArea, ToggleButton } from '@react-spectrum/s2';
import AddIcon from '@react-spectrum/s2/icons/Add';
import EditIcon from '@react-spectrum/s2/icons/Edit';
import PlayIcon from '@react-spectrum/s2/icons/Play';
import RefreshIcon from '@react-spectrum/s2/icons/Refresh';
import UploadIcon from '@react-spectrum/s2/icons/Upload';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  noticeAfterTry,
  tryFailureKind,
  tryFailureView,
  type TryAction,
  type TryFailureInput,
  type TryNoteView,
} from '../../model/model-check.ts';
import { probeFromJob } from '../../model/models-probe.ts';
import { quickKind, quickNote } from '../../model/models-tts-local.ts';
import {
  builtinCredit,
  BUILTIN_VOICE_INFO,
  builtinLabel,
  chooseFile,
  chooseLang,
  chooseSample,
  chooseVoice,
  CUSTOM_DESCRIBE,
  DEFAULT_VOICE,
  DESCRIBE_VOICES,
  FILE_VOICE,
  moreVoices,
  MY_PREFIX,
  quickDefaults,
  quickForm,
  quickPhase,
  quickSummary,
  quickTones,
  quickVoices,
  sampleKinds,
  sampleLangs,
  sampleLine,
  type MyVoice,
  type QuickPick,
} from '../../model/tts-quick-test.ts';
import { VOICE_AUDIO_EXTENSIONS } from '../../model/voices-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useTtsQuick, type QuickDraft } from '../../state/tts-quick-store.ts';
import { useVoiceHandoff } from '../../state/voice-handoff-store.ts';
import { useVoices } from '../../state/voices-store.ts';
import { useArtifactUrl, useCancelJob, useDownloadArtifact } from '../tools/use-tool-records.ts';
import { ModelTryNote } from './model-check-line.tsx';
import { quoted } from './models-copy.ts';
import { TTS_LOCAL_COPY as COPY } from './tts-local-copy.ts';

/* Design mock settings-local.css .ttst: a light-background panel, with a 48px column of small titles on the left and rows of chips on the right; indented blocks align to the chip column. */
const panel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginTop: 12,
  marginStart: { default: 0, sm: 32 },
  padding: 16,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-25',
  minWidth: 0,
});
const row = style({ display: 'flex', alignItems: 'start', gap: 8, minWidth: 0 });
const lab = style({ flexShrink: 0, width: 48, paddingTop: 4, font: 'ui-sm', color: 'gray-700' });
const chips = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexGrow: 1, minWidth: 0 });
const indent = style({ marginStart: 56, minWidth: 0 });
const note = style({ margin: 0, marginStart: 56, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const cloneBox = style({ display: 'flex', flexDirection: 'column', gap: 8, marginStart: 56, minWidth: 0 });
const cloneGo = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 });
const detail = style({ margin: 0, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const grow = style({ flexGrow: 1, flexBasis: 0, minWidth: 160 });
const field = style({ width: 'full' });
const line = style({ margin: 0, marginStart: 56, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere', userSelect: 'text' });
const go = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 4 });
const busyBox = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, flexBasis: 0, minWidth: 160 });
const problem = style({ margin: 0, font: 'ui-xs', color: 'negative-900', overflowWrap: 'anywhere', userSelect: 'text' });
const failNote = style({ marginStart: { default: 0, sm: 56 }, minWidth: 0 });
const out = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 12,
  borderTopWidth: 1,
  borderXWidth: 0,
  borderBottomWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const outHead = style({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' });
const player = style({ width: 'full', height: 36, opacity: { default: 1, isStale: 0.6 } });

export interface TtsQuickTestProps {
  bundleId: string;
  name: string;
  model: SpeechModelInfo;
  /** Installed cloneable model names (on a preset model, says where to try “我的声音”(My Voices)). */
  cloneNames: readonly string[];
  /** Reminder at the top of the panel when the last check did not pass (model/model-check.ts `tryNotice`). */
  notice?: TryNoteView | null;
  /** Check can be run on the row: when “模型出错了”(Model errored) appears, offer “检查模型”(Check model). */
  canCheck?: boolean;
  /** The reminder and the failure's “修复… / 重新检查 / 检查模型”(Repair… / Re-check / Check model) are handed back to the row. */
  onCheck?: (k: 'repair' | 'recheck' | 'check') => void;
}

/** A row not yet touched: the model's default selection, no result. */
function freshDraft(model: SpeechModelInfo): QuickDraft {
  return { pick: quickDefaults(model), run: null, last: null };
}

/**
 * The “试听”(Trial listen) on a local model row (design mock settings-tts.jsx `TtsQuickTest`): pick a voice, a tone and a sentence to read, and submit one real `models.synthesizeSpeech` (`provider: 'local'`, `model` is the model package ID). Progress and results are read from the `jobs` topic, and the result can be played and downloaded.
 * The selection and the latest result are kept per model (state/tts-quick-store.ts), so they remain after collapsing and expanding again.
 * The panel keeps its own failures (form not filled in properly, submit rejected, task failed), using the check wording (what is wrong + what to do + buttons), and shows no toast.
 * If the model's last check did not pass, the panel opens by saying so (design mock model-local-check.js `tryNotice` / `tryFailure`); it stops saying so once a trial listen has succeeded after that check.
 */
export function TtsQuickTest({ bundleId, name, model, cloneNames, notice = null, canCheck = false, onCheck }: TtsQuickTestProps) {
  const runtime = useRuntime();
  const pickFiles = runtime.host.pickFiles?.bind(runtime.host);
  const saved = useTtsQuick((s) => s.drafts[bundleId]);
  const draft = useMemo(() => saved ?? freshDraft(model), [saved, model]);
  const setDraft = useTtsQuick((s) => s.setDraft);
  const jobs = useJobs((s) => s.jobs);
  const library = useVoices((s) => s.voices);
  const route = useShell((s) => s.route);
  const goTo = useShell((s) => s.go);
  const setHandoff = useVoiceHandoff((s) => s.setHandoff);
  const cancelJob = useCancelJob();
  const download = useDownloadArtifact();
  const [submitting, setSubmitting] = useState(false);
  // A submission that did not reach the Runtime: the form was not filled in properly, or the submit was rejected. Cleared when the selection changes.
  const [issue, setIssue] = useState<Omit<TryFailureInput, 'canCheck'> | null>(null);

  const mine = useMemo<MyVoice[]>(() => library.map((v) => ({ id: v.id, name: v.name })), [library]);
  const { pick, run, last } = draft;
  const kind = quickKind(model);
  const form = quickForm(model, pick, mine);

  const runState = run
    ? probeFromJob(
        run.jobId,
        jobs.find((j) => j.jobId === run.jobId),
      )
    : null;
  const runJob = run ? jobs.find((j) => j.jobId === run.jobId) : undefined;
  const busy = submitting || runState?.status === 'running';
  const shown = runState?.status === 'done' ? run : last;
  const shownState = shown
    ? shown === run
      ? runState
      : probeFromJob(
          shown.jobId,
          jobs.find((j) => j.jobId === shown.jobId),
        )
    : null;
  const result =
    shown && shownState?.status === 'done' && shownState.output ? { run: shown, state: shownState, output: shownState.output } : null;
  const stale = !!result && result.run.key !== form.key;
  const resultJob = result ? jobs.find((j) => j.jobId === result.run.jobId) : undefined;
  const shownNotice = noticeAfterTry(notice, resultJob?.endedAt ?? resultJob?.updatedAt);
  // A failed attempt is only mentioned while the selection has not changed: after changing the voice or the text, that sentence no longer describes “this time”.
  // Cancelling it oneself is not an error, so it is not shown in red.
  const jobFailed = runState?.status === 'failed' && runJob?.state !== 'cancelled' && run?.key === form.key;
  const failure: Omit<TryFailureInput, 'canCheck'> | null =
    issue ??
    (jobFailed && run
      ? {
          kind: tryFailureKind(runJob?.error?.code ?? null, runJob?.error?.details),
          message: runState.message,
          file: run.pick.file?.name ?? fileOf(runJob?.error?.details),
        }
      : null);
  const failureView = failure && !busy ? tryFailureView({ ...failure, canCheck: canCheck && !!onCheck }) : null;

  const update = (next: QuickPick) => {
    setIssue(null);
    setDraft(bundleId, { ...draft, pick: next });
  };

  const submit = async () => {
    if (busy) return;
    if (!form.request) {
      setIssue({ kind: 'invalid', message: form.problem });
      return;
    }
    setIssue(null);
    setSubmitting(true);
    try {
      const jobId = await runtime.synthesizeSpeech(form.request);
      // The last successful result is kept: when this attempt fails, the result area still shows it.
      const keep = run && runState?.status === 'done' ? run : last;
      // If the selection was changed while submitting, the changed version is kept.
      const latest = useTtsQuick.getState().drafts[bundleId]?.pick ?? pick;
      setDraft(bundleId, { pick: latest, run: { jobId, key: form.key, pick }, last: keep });
    } catch (error) {
      const details = (error as { details?: unknown } | null)?.details;
      const code = (details as { code?: unknown } | undefined)?.code;
      setIssue({
        kind: tryFailureKind(typeof code === 'string' ? code : null, details),
        message: (error as Error).message,
        file: pick.file?.name ?? fileOf(details),
        notStarted: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pickReference = async () => {
    if (!pickFiles) return;
    const [path] = await pickFiles({
      title: COPY.pickTitle,
      buttonLabel: COPY.pickButton,
      filters: [{ name: COPY.pickFilter, extensions: [...VOICE_AUDIO_EXTENSIONS, 'm4a', 'mp4', 'mov', 'mkv', 'webm'] }],
    });
    if (path) update(chooseFile(pick, path));
  };

  const onNote = (k: TryAction['k']) => {
    if (k === 'pickRef') void pickReference();
    else if (k === 'useSample') update(chooseSample(model, pick));
    else if (k === 'retry') void submit();
    else onCheck?.(k);
  };

  const cloneNew = () => {
    setHandoff({ key: `quick:${bundleId}`, from: name, route });
    goTo({ tab: 'models', category: 'tts', page: 'voices' });
  };

  const voices = quickVoices(model, mine);
  const rest = moreVoices(model);
  const restOn = rest.find((v) => v.key === pick.voice);
  const tones = quickTones(model);
  const langs = sampleLangs(model);
  const kinds = pick.lang ? sampleKinds(pick.lang) : [];
  const said = sampleLine(pick.lang, pick.kind);
  const isBuiltin = (id: string) => model.voices.some((v) => v.voiceId === id && v.source === 'builtin');
  const myOn = pick.voice.startsWith(MY_PREFIX) ? mine.find((v) => MY_PREFIX + v.id === pick.voice) : undefined;
  const slowNote = quickNote(model);
  const phase = quickPhase(runJob);

  const chip = (key: string, label: ReactNode, selected: boolean, onPress: () => void, icon?: ReactNode) => (
    <ToggleButton key={key} size="S" isSelected={selected} onChange={onPress}>
      {icon}
      <Text>{label}</Text>
    </ToggleButton>
  );

  const builtinInfo = (id: string) => BUILTIN_VOICE_INFO[id]?.seconds ?? null;
  const infoLines: ReactNode[] = [];
  if (kind === 'clone' && isBuiltin(pick.voice)) {
    infoLines.push(
      <p key="ref" className={note}>
        {COPY.builtinRef(builtinLabel(pick.voice), builtinInfo(pick.voice))}
      </p>,
    );
  }
  if (kind === 'preset' && mine.length) {
    infoLines.push(
      <p key="preset" className={note}>
        {COPY.presetOnly(cloneNames.length ? COPY.nameList(cloneNames) : null)}
      </p>,
    );
  }
  if (myOn)
    infoLines.push(
      <p key="my" className={note}>
        {COPY.myVoice(myOn.name)}
      </p>,
    );
  if (kind === 'describe' && isBuiltin(pick.voice)) {
    infoLines.push(
      <p key="described" className={note}>
        {COPY.describedBuiltin(builtinLabel(pick.voice))}
      </p>,
    );
  }
  const describePreset = kind === 'describe' ? DESCRIBE_VOICES.find((v) => v.k === pick.voice) : undefined;
  if (describePreset)
    infoLines.push(
      <p key="describe" className={note}>
        {COPY.describePreset(describePreset.text)}
      </p>,
    );

  const fileChipLabel = pick.file
    ? COPY.fileChip(pick.file.name, false)
    : pick.sample
      ? COPY.fileChip(builtinLabel(pick.sample), true)
      : null;
  const acceptsTranscript = !!model.local?.reference?.acceptsTranscript;

  const usedBuiltin = (p: QuickPick) =>
    kind === 'clone' && (p.voice === DEFAULT_VOICE || isBuiltin(p.voice) || (p.voice === FILE_VOICE && !!p.sample));

  return (
    <div className={panel} role="group" aria-label={`${COPY.audition} · ${name}`}>
      <ModelTryNote view={shownNotice} onAction={onNote} />
      <div className={row}>
        <span className={lab}>{COPY.voice}</span>
        <div className={chips}>
          {voices.map((v) =>
            chip(v.key, v.key === FILE_VOICE ? (fileChipLabel ?? v.label) : v.label, pick.voice === v.key, () =>
              update(chooseVoice(pick, v.key)),
            ),
          )}
          {kind === 'clone' ? (
            <ActionButton size="S" onPress={cloneNew}>
              <AddIcon />
              <Text>{COPY.cloneNew}</Text>
            </ActionButton>
          ) : null}
          {rest.length ? (
            <Picker
              aria-label={COPY.more}
              size="S"
              menuWidth={240}
              placeholder={COPY.more}
              selectedKey={restOn ? restOn.key : null}
              onSelectionChange={(key) => {
                if (key !== null) update(chooseVoice(pick, String(key)));
              }}>
              {rest.map((v) => (
                <PickerItem key={v.key} id={v.key} textValue={v.label}>
                  <Text slot="label">{v.label}</Text>
                  {v.sub ? <Text slot="description">{v.sub}</Text> : null}
                </PickerItem>
              ))}
            </Picker>
          ) : null}
        </div>
      </div>
      {infoLines}

      {pick.voice === FILE_VOICE ? (
        <div className={cloneBox}>
          <p className={detail}>
            {pick.sample
              ? COPY.sampleFile(builtinLabel(pick.sample))
              : pick.file
                ? COPY.yourFile(pick.file.name)
                : pickFiles
                  ? COPY.cloneHint
                  : COPY.noPicker}
          </p>
          <div className={cloneGo}>
            <Button variant="secondary" size="S" isDisabled={!pickFiles} onPress={() => void pickReference()}>
              <UploadIcon />
              <Text>{pick.file ? COPY.changeFile : COPY.pickFile}</Text>
            </Button>
            <Button variant="secondary" size="S" onPress={() => update(chooseSample(model, pick))}>
              <PlayIcon />
              <Text>{COPY.useSample}</Text>
            </Button>
            <span className={grow}>
              <span className={detail}>{COPY.crossLang}</span>
            </span>
          </div>
          {pick.file && acceptsTranscript ? (
            <TextArea
              label={COPY.transcriptLabel}
              description={COPY.transcriptHint}
              size="S"
              styles={field}
              value={pick.transcript}
              onChange={(transcript) => update({ ...pick, transcript })}
            />
          ) : null}
        </div>
      ) : null}

      {pick.voice === CUSTOM_DESCRIBE ? (
        <div className={indent}>
          <TextArea
            aria-label={COPY.describeLabel}
            size="S"
            styles={field}
            placeholder={COPY.describePlaceholder}
            value={pick.describe}
            onChange={(describe) => update({ ...pick, describe })}
          />
        </div>
      ) : null}

      {tones.length ? (
        <div className={row}>
          <span className={lab}>{COPY.tone}</span>
          <div className={chips}>{tones.map((t) => chip(t.k, t.label, pick.tone === t.k, () => update({ ...pick, tone: t.k })))}</div>
        </div>
      ) : null}

      <div className={row}>
        <span className={lab}>{COPY.say}</span>
        <div className={chips}>
          {langs.map((l) => chip(l.code, l.label, !pick.editing && pick.lang === l.code, () => update(chooseLang(model, pick, l.code))))}
          {chip('edit', COPY.writeOwn, pick.editing, () => update({ ...pick, editing: !pick.editing }), <EditIcon />)}
        </div>
      </div>

      {!pick.editing && kinds.length > 1 ? (
        <div className={row}>
          <span className={lab}>{COPY.lines}</span>
          <div className={chips}>{kinds.map((k) => chip(k.k, k.label, pick.kind === k.k, () => update({ ...pick, kind: k.k })))}</div>
        </div>
      ) : null}

      {pick.editing ? (
        <div className={indent}>
          <TextArea
            aria-label={COPY.ownLabel}
            size="S"
            styles={field}
            placeholder={COPY.ownPlaceholder}
            value={pick.draft}
            onChange={(text) => update({ ...pick, draft: text })}
          />
        </div>
      ) : (
        <p className={line}>{quoted(said.text)}</p>
      )}

      <div className={go}>
        {busy ? (
          <>
            <div className={busyBox}>
              <span className={detail}>{COPY.busy(phase.label)}</span>
              <ProgressBar
                size="S"
                aria-label={COPY.busy(phase.label)}
                isIndeterminate={phase.percent === null}
                value={phase.percent ?? undefined}
              />
            </div>
            {run && runState?.status === 'running' ? (
              <ActionButton size="S" isQuiet onPress={() => cancelJob(run.jobId)}>
                <Text>{COPY.cancel}</Text>
              </ActionButton>
            ) : null}
          </>
        ) : result && !stale ? (
          <Button variant="secondary" size="S" onPress={() => void submit()}>
            <RefreshIcon />
            <Text>{COPY.again}</Text>
          </Button>
        ) : (
          <Button variant="secondary" size="S" onPress={() => void submit()}>
            <PlayIcon />
            <Text>{COPY.generate}</Text>
          </Button>
        )}
        {slowNote && !busy ? (
          <span className={grow}>
            <span className={detail}>{slowNote}</span>
          </span>
        ) : null}
      </div>
      {failureView ? (
        <div className={failNote}>
          <ModelTryNote view={failureView} onAction={onNote} />
        </div>
      ) : null}

      {result ? (
        <QuickResult
          artifactId={result.output.artifactId}
          summary={quickSummary(model, result.run.pick, mine, {
            seconds: result.state.status === 'done' ? result.state.seconds : null,
            audioSec: result.output.media.kind === 'audio' ? result.output.media.durationSec : null,
          })}
          stale={stale}
          credit={usedBuiltin(result.run.pick)}
          fileName={COPY.fileName(name)}
          onDownload={download}
        />
      ) : null}
    </div>
  );
}

/** `details.file` of a failure (the full path of a recording that cannot be read). */
function fileOf(details: unknown): string | null {
  const file = (details as { file?: unknown } | null | undefined)?.file;
  return typeof file === 'string' ? file : null;
}

function QuickResult({
  artifactId,
  summary,
  stale,
  credit,
  fileName,
  onDownload,
}: {
  artifactId: string;
  summary: string;
  stale: boolean;
  credit: boolean;
  fileName: string;
  onDownload: (artifactId: string, fileName: string) => Promise<void>;
}) {
  const media = useArtifactUrl(artifactId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const save = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await onDownload(artifactId, fileName);
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className={out}>
      <div className={outHead}>
        <span className={grow}>
          <span className={detail}>
            {stale ? COPY.stalePrefix : ''}
            {summary}
          </span>
        </span>
        <Button variant="secondary" size="S" isPending={downloading} onPress={() => void save()}>
          {COPY.download}
        </Button>
      </div>
      {media?.status === 'ready' ? (
        <audio className={player({ isStale: stale })} controls preload="metadata" src={media.url} aria-label={COPY.resultLabel} />
      ) : media?.status === 'failed' ? (
        <p className={problem}>{COPY.audioFailed(media.message)}</p>
      ) : (
        <p className={detail}>{COPY.loadingAudio}</p>
      )}
      {stale ? <p className={detail}>{COPY.stale}</p> : null}
      {downloadError ? <p className={problem}>{COPY.downloadFailed(downloadError)}</p> : null}
      {credit ? <p className={detail}>{COPY.credit(builtinCredit())}</p> : null}
    </div>
  );
}
