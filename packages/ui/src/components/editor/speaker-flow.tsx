import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentRecord, Id, JobRecord, ProposedSpeaker, Sequence, SpeakersSummary } from '@cuccut/protocol';
import {
  ActionButton,
  Badge,
  Button,
  Content,
  Heading,
  InlineAlert,
  Picker,
  PickerItem,
  ProgressBar,
  Radio,
  RadioGroup,
  TextField,
  ToastQueue,
  ToggleButton,
} from '@react-spectrum/s2';
import Edit from '@react-spectrum/s2/icons/Edit';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { intentPrompt, toolTemplate } from '../../model/ai-tools.ts';
import { chapterPieces } from '../../model/export-range.ts';
import {
  clipLabel,
  clipWindow,
  diarizePack,
  diarizePackReady,
  finalName,
  nameProblem,
  SPEAKER_STAGES,
  speakersReceiptText,
  speakersStage,
} from '../../model/speakers-proposal.ts';
import { fmtSize } from '../../model/task-facts.ts';
import { speakerPackFacts } from '../../model/transcribe-speakers.ts';
import { staleCaptions } from '../../model/transcript-cut.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useEditor } from '../../state/editor-store.ts';
import { isJobLive, useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { canEdit, useVideo } from '../../state/video-store.ts';
import { InstallDialog } from '../models/install-dialog.tsx';
import { AgentGateLine } from './agent-gate-line.tsx';
import { closeAiTool } from './ai-tools-nav.ts';
import { AiToolPrompt, SessionRow, useToolHandoff } from './ai-tool-prompt.tsx';
import { harnessLabel } from '../../model/agent-choice.ts';
import { useEditorActions } from './editor-context.tsx';
import { PanelHead } from './panel-head.tsx';
import { SPEAKERS_COPY as C } from './speakers-copy.ts';
import {
  applySpeakers,
  awaitInstall,
  bindSpeakers,
  cancelSpeakers,
  closeSpeakers,
  dismissSpeakersProblem,
  redoSpeakers,
  renameSpeaker,
  retrySpeakers,
  startSpeakers,
  undoSpeakers,
  useSpeakersRun,
  type SpeakersDeps,
  type SpeakersProblem,
  type SpeakersReceipt,
  type SpeakersRun,
} from './speakers-run.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 16 });
const stack = style({ display: 'flex', flexDirection: 'column', gap: 12 });
/** Explainer card (prototype .aicard). */
const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-75',
  font: 'ui-sm',
  color: 'gray-800',
  lineHeight: '[1.5]',
});
const cardTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
/** Signpost (prototype .signpost): one line explaining what will happen next. */
const signpost = style({ margin: 0, font: 'ui-sm', color: 'gray-700', lineHeight: '[1.5]' });
const rows = style({ display: 'flex', flexDirection: 'column', gap: 12 });
const row = style({ display: 'flex', alignItems: 'start', gap: 8 });
const rowLabel = style({ flexShrink: 0, width: 56, paddingTop: 4, font: 'ui-sm', color: 'gray-700' });
const rowBody = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const rowText = style({ paddingTop: 4, font: 'ui-sm', color: 'gray-900' });
const hint = style({ margin: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
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
const alertActions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 });

// Running-state header (same look as dub-status.tsx).
const head = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const titleRow = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui', color: 'gray-900' });
const liveDot = style({
  flexShrink: 0,
  width: 8,
  height: 8,
  borderRadius: 'full',
  backgroundColor: { default: 'blue-800', isQueued: 'gray-400' },
});
const headTitle = style({
  flexGrow: 1,
  minWidth: 0,
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const activity = style({ font: 'ui-xs', color: 'gray-600' });
const ladder = style({ display: 'flex', gap: 4 });
const step = style({ flexGrow: 1, flexBasis: 0, minWidth: 0 });
const stepBar = style({
  display: 'block',
  height: 4,
  borderRadius: 'full',
  backgroundColor: { default: 'gray-300', isDone: 'green-900', isCurrent: 'blue-900' },
});
const stepLabel = style({
  display: 'block',
  marginTop: 4,
  fontSize: '[10px]',
  color: { default: 'gray-500', isDone: 'green-1000', isCurrent: 'blue-1000' },
  fontWeight: { default: 'normal', isCurrent: 'bold' },
});
const headActions = style({ display: 'flex', alignItems: 'center', gap: 8 });

// Speaker card (prototype .spkc).
const speakerCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const speakerHead = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
/** Same color set as the speaker names in the script (transcript-paragraph.tsx), assigned in order of first appearance. */
const dot = style({
  flexShrink: 0,
  width: 10,
  height: 10,
  borderRadius: 'full',
  backgroundColor: {
    default: 'gray-500',
    hue: { 0: 'blue-900', 1: 'green-900', 2: 'orange-900', 3: 'purple-900', 4: 'cyan-900', 5: 'magenta-900' },
  },
});
const speakerName = style({
  flexGrow: 1,
  minWidth: 0,
  font: 'ui',
  fontWeight: 'bold',
  color: 'gray-900',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const nameButton = style({
  flexGrow: 1,
  minWidth: 0,
  padding: 0,
  borderWidth: 0,
  backgroundColor: 'transparent',
  textAlign: 'start',
  cursor: 'text',
});
const clips = style({ display: 'flex', flexWrap: 'wrap', gap: '[6px]' });
const doneRow = style({ display: 'flex', alignItems: 'center', gap: 8, paddingY: 4 });

const HUES = 6;
const hueOf = (index: number) => String(index % HUES) as '0';

const speakersToast: SpeakersDeps['toast'] = (kind, message) => ToastQueue[kind](message, { timeout: 5000 });

/**
 * Tools page › Identify speakers (prototype panel-aitools-flows.jsx `SpeakerFlow`): settings → run → confirm → receipt. Identification runs locally in the “speaker diarization” model pack (the Runtime's `speakers` flow, without re-transcribing).
 * The result goes to the confirm page first: preview clips and rename speakers. Only “apply” writes it into the video (a single undoable transaction).
 * “use” can also be set to hand off to the Agent (sends an intent sentence to this video's session). CucCut in the browser does not have this page (the Tools page does not appear on the web host), but the guard is still kept here.
 */
export function SpeakerFlow({
  videoId,
  sequence,
  documents,
  onBack,
}: {
  videoId: Id;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  onBack(): void;
}) {
  const runtime = useRuntime();
  useEffect(
    () =>
      bindSpeakers({
        runtime: {
          startPipeline: (pipeline, params) => runtime.startPipeline(pipeline, params),
          retryPipeline: (jobId) => runtime.retryPipeline(jobId),
          cancelJob: (jobId) => runtime.cancelJob(jobId),
          videos: runtime.videos,
        },
        toast: speakersToast,
      }),
    [runtime],
  );
  const run = useSpeakersRun((s) => s.runs[videoId] ?? null);
  const proposal = useSpeakersRun((s) => s.proposals[videoId] ?? null);
  const receipt = useSpeakersRun((s) => s.receipts[videoId] ?? null);
  const problem = useSpeakersRun((s) => s.problems[videoId] ?? null);

  if (runtime.host.platform === 'web') {
    return (
      <>
        <PanelHead title={C.title} back={{ label: C.back, onPress: onBack }} />
        <div className={body}>
          <InlineAlert variant="informative">
            <Heading>{C.web}</Heading>
            <Content>{C.webBody}</Content>
          </InlineAlert>
        </div>
      </>
    );
  }

  // “back” on the receipt page, like “done”, returns to the settings page (the prompt is still there). “返回” (back) on the settings page is what goes back to the list.
  const showsReceipt = !run && !proposal && !!receipt;
  return (
    <>
      <PanelHead title={C.title} back={{ label: C.back, onPress: showsReceipt ? () => closeSpeakers(videoId) : onBack }}>
        {run ? (
          <Badge size="S" variant="informative">
            {C.background}
          </Badge>
        ) : null}
      </PanelHead>
      {run ? (
        <RunView run={run} />
      ) : proposal ? (
        <ConfirmView
          videoId={videoId}
          sequence={sequence}
          documents={documents}
          summary={proposal.summary}
          names={proposal.names}
          applying={proposal.applying}
        />
      ) : receipt ? (
        <DoneView videoId={videoId} receipt={receipt} sequence={sequence} documents={documents} />
      ) : (
        <SetupView videoId={videoId} sequence={sequence} documents={documents} problem={problem} onBack={onBack} />
      )}
    </>
  );
}

// ---- Settings ----

function SetupView({
  videoId,
  sequence,
  documents,
  problem,
  onBack,
}: {
  videoId: Id;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  problem: SpeakersProblem | null;
  onBack(): void;
}) {
  const handoff = useToolHandoff();
  const ref = handoff.ref;
  const editable = useVideo((s) => canEdit(s.video));
  const guide = handoff.guide;
  const pack = useModels((s) => diarizePack(s.bundles));
  const ready = diarizePackReady(pack);
  const facts = speakerPackFacts(pack, fmtSize);
  const waiting = useSpeakersRun((s) => s.installs[videoId] ?? null);
  const speeches = useMemo(() => Object.values(documents).filter((d) => d.kind === 'speech' && !!d.sourceAssetId), [documents]);
  const speech = speeches[0] ?? null;

  const [who, setWho] = useState<'local' | 'agent'>(pack ? 'local' : 'agent');
  const agent = who === 'agent';
  const chapters = useMemo(() => chapterPieces(sequence), [sequence]);
  const [scopeKey, setScopeKey] = useState('all');
  const scopeIndex = chapters.findIndex((c) => c.id === scopeKey);
  const scope = scopeIndex >= 0 ? C.chapterScope(scopeIndex + 1, chapters[scopeIndex]!.label) : null;

  const [installing, setInstalling] = useState(false);
  const install = pack?.install;
  const downloading = !!install && install.state !== 'paused';
  const pct = downloading && install.totalBytes ? Math.min(100, Math.floor((install.receivedBytes / install.totalBytes) * 100)) : null;

  const blocked = !pack || !speech || !editable || downloading || !!waiting;
  // Handing off to the Agent: the template in the prompt box (intent sentence plus fixed constraints), with the speaker-labeling skill attached (product design §5.10).
  const template = toolTemplate('speakers', intentPrompt({ tool: 'speakers', title: ref?.name ?? null, scope }));
  const start = async () => {
    if (!ready) {
      setInstalling(true);
      return;
    }
    await startSpeakers(videoId, speech?.id);
  };

  const localHint = !pack
    ? C.packUnlisted
    : downloading || waiting
      ? C.packDownloading(pct)
      : !speech
        ? C.noSpeech
        : !editable
          ? C.readOnly
          : ready
            ? null
            : C.packHint(facts.size);

  return (
    <>
      <div className={`${body} cc-scroll`}>
        <div className={stack}>
          {problem ? <ProblemAlert videoId={videoId} problem={problem} /> : null}
          <div className={card}>
            <span className={cardTitle}>{C.cardTitle}</span>
            <span>{C.cardBody}</span>
          </div>
          <div className={rows}>
            <div className={row}>
              <span className={rowLabel}>{C.who}</span>
              <div className={rowBody}>
                <RadioGroup aria-label={C.who} size="S" value={who} onChange={(value) => setWho(value as 'local' | 'agent')}>
                  <Radio value="local" isDisabled={!pack}>
                    {C.local} · {C.localSub}
                  </Radio>
                  <Radio value="agent">
                    {C.agent} · {agent ? harnessLabel(handoff.driver, handoff.model) : C.agentSub}
                  </Radio>
                </RadioGroup>
                {agent && guide ? <AgentGateLine guide={guide} /> : null}
              </div>
            </div>
            <div className={row}>
              <span className={rowLabel}>{C.scope}</span>
              <div className={rowBody}>
                {agent ? (
                  <Picker
                    aria-label={C.scope}
                    size="S"
                    styles={field}
                    isDisabled={!chapters.length}
                    selectedKey={scopeIndex >= 0 ? scopeKey : 'all'}
                    onSelectionChange={(key) => setScopeKey(String(key ?? 'all'))}>
                    {[
                      <PickerItem key="all" id="all">
                        {C.scopeAll}
                      </PickerItem>,
                      ...chapters.map((c, i) => (
                        <PickerItem key={c.id} id={c.id}>
                          {C.chapterScope(i + 1, c.label)}
                        </PickerItem>
                      )),
                    ]}
                  </Picker>
                ) : (
                  <>
                    <span className={rowText}>
                      {C.scopeAll}
                      {speeches.length > 1 && speech ? ` · ${C.manySpeechNamed(speech.name)}` : ''}
                    </span>
                    {scope ? <p className={hint}>{C.scopeLocal(scope)}</p> : null}
                  </>
                )}
              </div>
            </div>
            {agent ? <SessionRow handoff={handoff} /> : null}
          </div>
          {agent ? <AiToolPrompt videoId={videoId} tool="speakers" template={template} handoff={handoff} onDone={onBack} /> : null}
          {!agent && localHint ? (
            <div className={stack} role={downloading || waiting ? 'status' : undefined}>
              <p className={hint}>{localHint}</p>
              {downloading || waiting ? (
                <ProgressBar
                  size="S"
                  aria-label={localHint}
                  isIndeterminate={pct === null}
                  {...(pct === null ? {} : { value: pct })}
                  styles={field}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {agent ? null : (
        <div className={footer}>
          <Button variant="secondary" styles={field} isDisabled={blocked} onPress={() => void start()}>
            {C.start}
          </Button>
          <p className={hint}>{C.startHint}</p>
        </div>
      )}
      {installing && pack ? (
        <InstallDialog
          bundleId={pack.bundleId}
          name={facts.name}
          license={pack.license ?? null}
          mode="install"
          onClose={() => setInstalling(false)}
          onStarted={(jobId) => {
            setInstalling(false);
            awaitInstall(videoId, jobId);
          }}
        />
      ) : null}
    </>
  );
}

function ProblemAlert({ videoId, problem }: { videoId: Id; problem: SpeakersProblem }) {
  const go = useShell((s) => s.go);
  const busy = useSpeakersRun((s) => !!s.runs[videoId]);
  return (
    <InlineAlert variant={problem.kind === 'decide' ? 'notice' : 'negative'}>
      <Heading>{problem.title}</Heading>
      <Content>
        {problem.message ? <div>{problem.message}</div> : null}
        <div className={alertActions}>
          {problem.retryJobId ? (
            <Button size="S" variant="secondary" isDisabled={busy} onPress={() => void retrySpeakers(videoId)}>
              {C.retry}
            </Button>
          ) : null}
          {problem.taskId ? (
            <Button size="S" variant="secondary" onPress={() => go({ tab: 'tasks', taskId: problem.taskId! })}>
              {C.decide}
            </Button>
          ) : null}
          <Button size="S" variant="secondary" fillStyle="outline" onPress={() => dismissSpeakersProblem(videoId)}>
            {C.dismiss}
          </Button>
        </div>
      </Content>
    </InlineAlert>
  );
}

// ---- Run ----

function RunView({ run }: { run: SpeakersRun }) {
  const jobs = useJobs((s) => s.jobs);
  const job: JobRecord | null = run.jobId ? (jobs.find((j) => j.jobId === run.jobId) ?? null) : null;
  const stale = !!job && !isJobLive(job);
  const submitting = run.status === 'submitting' || !job || stale;
  const queued = !submitting && job.state === 'queued';
  const current = submitting ? 0 : speakersStage(job, jobs);
  const heading = submitting ? C.submitting : queued ? C.queued : C.running;
  return (
    <div className={`${body} cc-scroll`}>
      <div className={stack}>
        <div className={head} role="status" aria-live="polite">
          <div className={titleRow}>
            <span className={liveDot({ isQueued: queued })} aria-hidden />
            <span className={headTitle}>{heading}</span>
          </div>
          <ProgressBar size="S" aria-label={heading} isIndeterminate styles={field} />
          {submitting || queued ? null : <span className={activity}>{C.activity(SPEAKER_STAGES[current]!)}</span>}
          <div className={ladder}>
            {SPEAKER_STAGES.map((label, index) => {
              const isDone = !submitting && index < current;
              const isCurrent = !submitting && !queued && index === current;
              return (
                <div key={label} className={step}>
                  <span className={stepBar({ isDone, isCurrent })} />
                  <span className={stepLabel({ isDone, isCurrent })}>{label}</span>
                </div>
              );
            })}
          </div>
          {job && isJobLive(job) && !stale ? (
            <div className={headActions}>
              <Button size="S" variant="secondary" onPress={() => void cancelSpeakers(job.jobId)}>
                {C.cancel}
              </Button>
            </div>
          ) : null}
        </div>
        <p className={signpost}>{C.runNote}</p>
      </div>
    </div>
  );
}

// ---- Confirm ----

/** Preview: seeks to this sentence and plays it, stopping at the end of the sentence; click again to stop. */
function useClipPlayer() {
  const actions = useEditorActions();
  const [on, setOn] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOn(null);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const toggle = (key: string, window: { start: number; end: number }) => {
    if (timer.current) clearTimeout(timer.current);
    if (on === key) {
      actions.pause();
      stop();
      return;
    }
    setOn(key);
    actions.seek(window.start);
    if (!useEditor.getState().playing) actions.togglePlay();
    timer.current = setTimeout(
      () => {
        if (useEditor.getState().playing) actions.pause();
        stop();
      },
      Math.max(200, (window.end - window.start) * 1000),
    );
  };
  return { on, toggle };
}

function ConfirmView({
  videoId,
  sequence,
  documents,
  summary,
  names,
  applying,
}: {
  videoId: Id;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  summary: SpeakersSummary;
  names: Record<Id, string>;
  applying: boolean;
}) {
  const editable = useVideo((s) => canEdit(s.video));
  const assetId = documents[summary.source.documentId]?.sourceAssetId ?? null;
  const player = useClipPlayer();
  const invalid = summary.speakers.some((s) => names[s.id] !== undefined && nameProblem(names[s.id]!) !== null);
  return (
    <>
      <div className={`${body} cc-scroll`}>
        <div className={stack}>
          <p className={signpost}>{C.found(summary.speakers.length)}</p>
          {summary.relabeled === 0 ? <p className={hint}>{C.same}</p> : null}
          {summary.speakers.map((speaker, index) => (
            <SpeakerCard
              key={speaker.id}
              videoId={videoId}
              speaker={speaker}
              index={index}
              name={names[speaker.id]}
              timescale={summary.timescale}
              window={(clip) => (assetId ? clipWindow(sequence, assetId, clip, summary.timescale) : null)}
              player={player}
            />
          ))}
          {summary.translationsSplit > 0 ? (
            <div className={card}>
              <span className={cardTitle}>{C.splitTitle(summary.translationsSplit)}</span>
              <span>{C.splitBody}</span>
            </div>
          ) : null}
          {summary.skippedTranslations > 0 ? <p className={hint}>{C.skipped(summary.skippedTranslations)}</p> : null}
        </div>
      </div>
      <div className={footer}>
        <Button
          variant="secondary"
          styles={field}
          isDisabled={!editable || invalid}
          isPending={applying}
          onPress={() => void applySpeakers(videoId)}>
          {C.apply}
        </Button>
        <p className={hint}>{editable ? C.applyHint : C.readOnly}</p>
        <Button variant="secondary" fillStyle="outline" size="S" isDisabled={applying} onPress={() => closeSpeakers(videoId)}>
          {C.discard}
        </Button>
      </div>
    </>
  );
}

function SpeakerCard({
  videoId,
  speaker,
  index,
  name,
  timescale,
  window,
  player,
}: {
  videoId: Id;
  speaker: ProposedSpeaker;
  index: number;
  name: string | undefined;
  timescale: number;
  window(clip: ProposedSpeaker['clips'][number]): { start: number; end: number } | null;
  player: ReturnType<typeof useClipPlayer>;
}) {
  const [editing, setEditing] = useState(false);
  const shown = name ?? speaker.name;
  const problem = name === undefined ? null : nameProblem(name);
  return (
    <div className={speakerCard}>
      <div className={speakerHead}>
        <span className={dot({ hue: hueOf(index) })} aria-hidden />
        {editing ? (
          <TextField
            aria-label={C.renameLabel(speaker.name)}
            size="S"
            styles={field}
            autoFocus
            value={shown}
            maxLength={100}
            isInvalid={!!problem}
            errorMessage={problem ?? undefined}
            onChange={(value) => renameSpeaker(videoId, speaker.id, value)}
            onFocus={(event) => (event.target as HTMLInputElement).select()}
            onBlur={() => !problem && setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !problem) setEditing(false);
            }}
          />
        ) : (
          <button type="button" className={nameButton} title={C.rename} onClick={() => setEditing(true)}>
            <span className={speakerName}>{finalName(speaker, name === undefined ? {} : { [speaker.id]: name })}</span>
          </button>
        )}
        {editing ? null : (
          <ActionButton isQuiet size="XS" aria-label={C.renameLabel(speaker.name)} onPress={() => setEditing(true)}>
            <Edit />
          </ActionButton>
        )}
        {speaker.isNew ? (
          <Badge size="S" variant="informative">
            {C.newSpeaker}
          </Badge>
        ) : null}
        <Badge size="S" variant="neutral">
          {C.sentences(speaker.sentences)}
        </Badge>
      </div>
      {speaker.clips.length ? (
        <div className={clips}>
          {speaker.clips.map((clip) => {
            const key = `${speaker.id}:${clip.sentenceId}`;
            const at = window(clip);
            return (
              <ToggleButton
                key={key}
                size="XS"
                isQuiet
                isSelected={player.on === key}
                isDisabled={!at}
                aria-label={at ? clip.text : E.withNote(clip.text, C.clipOff)}
                onChange={() => at && player.toggle(key, at)}>
                <span className="cc-tabular">{clipLabel(clip, timescale)}</span>
              </ToggleButton>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ---- Receipt ----

function DoneView({
  videoId,
  receipt,
  sequence,
  documents,
}: {
  videoId: Id;
  receipt: SpeakersReceipt;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
}) {
  const { summary, names } = receipt;
  const speech = documents[summary.source.documentId];
  const stale = useMemo(() => (speech ? staleCaptions(sequence, documents, speech) : []), [sequence, documents, speech]);
  const running = useSpeakersRun((s) => !!s.runs[videoId]);
  // “done” returns to the settings page, not the list.
  const finish = () => closeSpeakers(videoId);
  return (
    <div className={`${body} cc-scroll`}>
      <div className={stack}>
        <InlineAlert variant={receipt.undone ? 'neutral' : 'positive'}>
          <Heading>{receipt.undone ? C.undoneReceipt : speakersReceiptText(summary, C.engine)}</Heading>
          <Content>
            {!receipt.undone && !receipt.transactionId ? <div>{C.noUndo}</div> : null}
            <div className={alertActions}>
              {receipt.undone ? (
                <Button size="S" variant="secondary" isPending={receipt.busy} onPress={() => void redoSpeakers(videoId)}>
                  {C.redo}
                </Button>
              ) : receipt.transactionId ? (
                <Button size="S" variant="secondary" isPending={receipt.busy} onPress={() => void undoSpeakers(videoId)}>
                  {C.undo}
                </Button>
              ) : null}
              <Button
                size="S"
                variant="secondary"
                isDisabled={running || receipt.busy}
                onPress={() => void startSpeakers(videoId, summary.source.documentId)}>
                {C.again}
              </Button>
              <Button size="S" variant="secondary" fillStyle="outline" onPress={finish}>
                {C.done}
              </Button>
            </div>
          </Content>
        </InlineAlert>
        {receipt.undone ? (
          <div className={card}>
            <span className={cardTitle}>{C.undoneTitle}</span>
            <span>{C.undoneBody}</span>
          </div>
        ) : (
          <>
            <div>
              {summary.speakers.map((speaker, index) => (
                <div key={speaker.id} className={doneRow}>
                  <span className={dot({ hue: hueOf(index) })} aria-hidden />
                  <span className={speakerName}>{finalName(speaker, names)}</span>
                  <Badge size="S" variant="positive">
                    {C.sentences(speaker.sentences)}
                  </Badge>
                </div>
              ))}
            </div>
            {summary.translationsSplit > 0 ? <p className={signpost}>{C.splitDone(summary.translationsSplit)}</p> : null}
            {stale.length ? (
              <div className={headActions}>
                <p className={hint}>{C.captionsStale(stale.length)}</p>
                <ActionButton isQuiet size="XS" onPress={() => closeAiTool(videoId, 'subtitle')}>
                  {C.gotoCaptions}
                </ActionButton>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
