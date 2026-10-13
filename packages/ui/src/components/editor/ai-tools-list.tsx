import { useMemo, type ComponentType } from 'react';
import type { AiToolKind, DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { Badge, Button, Link } from '@react-spectrum/s2';
import ChevronRight from '@react-spectrum/s2/icons/ChevronRight';
import Comment from '@react-spectrum/s2/icons/Comment';
import DevicePhone from '@react-spectrum/s2/icons/DevicePhone';
import Cut from '@react-spectrum/s2/icons/Cut';
import Edit from '@react-spectrum/s2/icons/Edit';
import FileText from '@react-spectrum/s2/icons/FileText';
import Image from '@react-spectrum/s2/icons/Image';
import ListBulleted from '@react-spectrum/s2/icons/ListBulleted';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import Settings from '@react-spectrum/s2/icons/Settings';
import TextIcon from '@react-spectrum/s2/icons/Text';
import TextParagraph from '@react-spectrum/s2/icons/TextParagraph';
import UserGroup from '@react-spectrum/s2/icons/UserGroup';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { AI_TOOL_GROUP_LABEL, AI_TOOLS, groupSub, laterNote, LIST_GROUPS, listedTools, needsTranscript, toolDraftKey, type AiToolId } from '../../model/ai-tools.ts';
import { durationSeconds } from '../../model/editor.ts';
import { soundtrackFor } from '../../model/tools-music.ts';
import { chapterPieces } from '../../model/export-range.ts';
import { useConnection, defaultDriver } from '../../state/connection-store.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useEditor } from '../../state/editor-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { MusicIcon } from '../music-icon.tsx';
import { entryOfVideo } from '../tools/tool-run-view.tsx';
import { useVideoTools } from '../tools/use-video-tools.ts';
import { useGateFix } from '../start/gate-card.tsx';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { openAiTool, useAiToolAgentRuns } from './ai-tools-nav.ts';
import { ELEMENTS_COPY as EL } from './elements-copy.ts';
import { gateGuide, homeGate, type GateGuide } from '../../model/home-brief.ts';
import { PanelHead } from './panel-head.tsx';
import { useShallow } from 'zustand/react/shallow';
import { useSpeakersRun } from './speakers-run.ts';
import { useAiToolRun } from './ai-tool-run.ts';
import { aiToolJobFacts, aiToolRowState, EDITORIAL_PROPOSAL_KIND, pendingCutCount, soundtrackJobFacts, type AiToolRowState } from '../../model/ai-tool-row-state.ts';
import { agoLabel } from '../../model/format.ts';
import { isStale, pairRows, readTranslation, speechSentences } from '../../model/translation-doc.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useNow } from '../use-now.ts';
import { useDocumentBodies } from './use-document-body.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 16 });
/** The top card and the rows of the list (prototype .atagent, .drill.ail__row): icon on the left, two lines of text, status and arrow on the right; the whole row is clickable. */
const tile = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 'full',
  boxSizing: 'border-box',
  paddingX: 12,
  paddingY: 8,
  borderRadius: 'lg',
  borderWidth: 0,
  textAlign: 'start',
  font: 'ui-sm',
  color: { default: 'gray-800', isDisabled: 'gray-400' },
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isPressed: 'gray-200', isDisabled: 'transparent' },
  cursor: { default: 'pointer', isDisabled: 'default' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  transition: 'default',
});
const agentTile = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 'full',
  boxSizing: 'border-box',
  padding: 12,
  borderRadius: 'lg',
  borderWidth: 0,
  textAlign: 'start',
  font: 'ui-sm',
  color: 'gray-800',
  backgroundColor: { default: 'gray-75', isHovered: 'gray-100', isPressed: 'gray-200' },
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineWidth: 2,
  outlineColor: 'focus-ring',
  transition: 'default',
});
const setupCard = style({ display: 'flex', alignItems: 'start', gap: 12, padding: 12, borderRadius: 'lg', backgroundColor: 'gray-75', font: 'ui-sm' });
const text = style({ display: 'flex', flexDirection: 'column', gap: '[2px]', flexGrow: 1, minWidth: 0, lineHeight: '[1.4]' });
const name = style({ font: 'ui', fontWeight: 'bold', color: 'inherit' });
const sub = style({ font: 'ui-xs', color: 'gray-600' });
const iconBox = style({ display: 'flex', flexShrink: 0, color: 'gray-700' });
/** Status chip (prototype .ail__st; `Chip` is S2 Badge subtle): not squeezed narrow by the two lines of text. */
const stateChip = style({ flexShrink: 0 });
const chev = style({ display: 'flex', flexShrink: 0, color: 'gray-500' });
/** The explanation card shown when there is no script (prototype .aicard.ail__empty). */
const emptyCard = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'start',
  gap: 8,
  marginTop: 12,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-75',
  font: 'ui-sm',
  color: 'gray-800',
  lineHeight: '[1.5]',
});
const secHead = style({ marginTop: 20, marginBottom: 4, marginX: 12, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const groupNote = style({ marginTop: 0, marginBottom: 4, marginX: 12, font: 'ui-xs', color: 'gray-600' });
const footnote = style({ marginTop: 16, marginX: 12, marginBottom: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });

const TOOL_ICON: Partial<Record<AiToolId, ComponentType>> = {
  polish: Edit,
  chapters: ListBulleted,
  speakers: UserGroup,
  retranscribe: Refresh,
  cleanup: Cut,
  summary: FileText,
  blog: TextParagraph,
  title: TextIcon,
  desc: TextParagraph,
  cover: Image,
  shortscut: DevicePhone,
  soundtrack: MusicIcon,
};

const STALE_LISTED = AI_TOOLS.some((t) => t.id === 'stale' && LIST_GROUPS.includes(t.group));

type RowTone = 'informative' | 'notice' | 'neutral';
/** Tones match the prototype's Chip: running is accent → informative; notices that need a person's attention and stale items are notice; everything else (including the prototype's info) is neutral. */
const ROW_TONE: Record<AiToolRowState['kind'], RowTone> = {
  running: 'informative',
  result: 'notice',
  review: 'notice',
  pending: 'neutral',
  stale: 'notice',
  chapters: 'neutral',
  last: 'neutral',
  undone: 'neutral',
};

function rowText(state: AiToolRowState, now: number): string {
  switch (state.kind) {
    case 'running':
      return state.percent === null ? C.stateRunning : C.statePercent(state.percent);
    case 'result':
      return C.stateResult;
    case 'review':
      return C.stateReview;
    case 'pending':
      return C.statePending(state.count);
    case 'stale':
      return C.stateStale(state.count);
    case 'chapters':
      return C.stateChapters(state.count);
    case 'last':
      return C.stateLast(agoLabel(state.at, now));
    case 'undone':
      return C.undone;
  }
}

/** Stale translated sentences (the body text is not fetched when `enabled` is false): on the timeline, each translation is paired sentence by sentence with the transcript segment it was translated from (same judgment as the subtitle panel and the dubbing page). 0 when it cannot be read; no guessing. */
function useStaleSentences(documents: Record<Id, DocumentRecord>, enabled: boolean): number {
  const translations = useMemo(
    () =>
      enabled
        ? Object.values(documents).filter((d) => d.kind === 'translation' && d.sourceDocumentId && documents[d.sourceDocumentId]?.kind === 'speech')
        : [],
    [documents, enabled],
  );
  const speeches = useMemo(() => [...new Set(translations.map((t) => t.sourceDocumentId!))].map((id) => documents[id]!), [translations, documents]);
  const speechBodies = useDocumentBodies(speeches);
  const translationBodies = useDocumentBodies(translations);
  return useMemo(() => {
    const sentencesOf = new Map(speeches.map((s, i) => [s.id, speechBodies[i] === undefined ? null : speechSentences(speechBodies[i])]));
    let n = 0;
    translations.forEach((t, i) => {
      const sentences = sentencesOf.get(t.sourceDocumentId!);
      const parsed = readTranslation(translationBodies[i]);
      if (sentences && parsed) n += pairRows(sentences, parsed).filter((r) => r.unit && isStale(r.state)).length;
    });
    return n;
  }, [speeches, speechBodies, translations, translationBodies]);
}

/** Undecided suggestions in a cut proposal (written by finding cut points; video format spec §6.2). */
function usePendingCuts(documents: Record<Id, DocumentRecord>): number {
  const proposals = useMemo(() => Object.values(documents).filter((d) => d.kind === EDITORIAL_PROPOSAL_KIND), [documents]);
  const bodies = useDocumentBodies(proposals);
  return useMemo(() => pendingCutCount(proposals.map((record, i) => ({ record, body: bodies[i] })), documents), [proposals, bodies, documents]);
}

/**
 * The status on the right of a row (prototype panel-aitools-list.jsx `rowState`; judgment in `aiToolRowState`): running (direct model call tasks, speaker identification, in-place tools handed to the Agent whose conversation is still running),
 * results awaiting a person's look, suggestions left by finding cut points, stale translations, chapters on the timeline, the last finish time, or undone. It only reports facts the editor has.
 */
function useRowStates(videoId: Id, sequence: Sequence, documents: Record<Id, DocumentRecord>): Partial<Record<AiToolId, { text: string; tone: RowTone }>> {
  const chapters = useMemo(() => chapterPieces(sequence).length, [sequence]);
  const pendingCuts = usePendingCuts(documents);
  // The body text of the transcript and translation is fetched only when this refresh row is in the list (the translation group it belongs to is in its own panel, see `LIST_GROUPS`).
  const staleSentences = useStaleSentences(documents, STALE_LISTED);
  const speakersRunning = useSpeakersRun((s) => !!s.runs[videoId] || !!s.installs[videoId]);
  const speakersPending = useSpeakersRun((s) => !!s.proposals[videoId]);
  // Direct model tasks (key 「视频 · 工具」 (video · tool)): submitted from here and not yet given a task ID; results not yet looked at; undone.
  const prefix = `${videoId}:`;
  const submitting = useAiToolRun(useShallow((s) => Object.values(s.runs).filter((r) => r.videoId === videoId).map((r) => r.tool)));
  // An undone receipt does not count as unseen: that row says 「已撤销」 (Undone).
  const unread = useAiToolRun(
    useShallow((s) =>
      [...Object.keys(s.results), ...Object.entries(s.receipts).filter(([, r]) => !r.undone).map(([k]) => k)]
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length)),
    ),
  );
  const undoneJobs = useAiToolRun((s) => s.undoneJobs);
  // The `ai-tool` task for this video in the task mirror: includes ones submitted elsewhere (CLI, another window).
  const jobs = useJobs((s) => s.jobs);
  const jobFacts = useMemo(() => aiToolJobFacts(jobs, videoId), [jobs, videoId]);
  // Generating a soundtrack does not go through the `ai-tool` flow: it is the `generateMusic` task submitted from the tool page that carries this video.
  const soundtrackFacts = useMemo(() => soundtrackJobFacts(jobs, videoId), [jobs, videoId]);
  // After finding cut points and refreshing stale translations were handed to the Agent while staying in place: that conversation still has tasks running (queued ones count too).
  const agentRuns = useAiToolAgentRuns((s) => s.runs);
  const conversations = useDirectory((s) => s.conversations);
  const agentBusy = (tool: AiToolId) => {
    const run = agentRuns[toolDraftKey(videoId, tool)];
    if (run?.restored) return false;
    const active = run ? (conversations.find((c) => c.id === run.conversationId)?.activeTaskId ?? null) : null;
    return !!active && (run?.taskId === null || run?.taskId === active);
  };
  const now = useNow(30_000);
  const states: Partial<Record<AiToolId, { text: string; tone: RowTone }>> = {};
  for (const t of AI_TOOLS) {
    const job = t.id === 'soundtrack' ? soundtrackFacts : jobFacts[t.id];
    const running =
      job?.running ??
      (submitting.includes(t.id as AiToolKind) || (t.id === 'speakers' && speakersRunning) || agentBusy(t.id) ? { percent: null } : null);
    const state = aiToolRowState(t.id, {
      running,
      result: unread.includes(t.id),
      review: t.id === 'speakers' && speakersPending,
      pendingCuts,
      staleSentences,
      chapters,
      last: job?.last ? { at: job.last.at, undone: !!undoneJobs[job.last.jobId] } : null,
    });
    if (state) states[t.id] = { text: rowText(state, now), tone: ROW_TONE[state.kind] };
  }
  return states;
}

/** The card at the top: when the Agent is available, hand off in one sentence (starts a new conversation with this video as context); when not, replace it with setup guidance (product design §5.10). */
function AgentCard({ guide }: { guide: GateGuide | null }) {
  const source = useVideo((s) => s.video?.ref?.source ?? null);
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const driver = defaultDriver(drivers, checking);
  if (guide) return <SetupCard guide={guide} />;
  const inProject = !!source?.projectId;
  const open = () => {
    const shell = useShell.getState();
    const target = routeVideo(shell.route);
    // A video in a project: the project's new-conversation start page, with the video kept as a feature-area tab on the right. A video not in a project: the conversation it sits in (a conversation created from the start page does not share a working directory with it).
    const from = inProject ? { conversationId: null, projectId: source!.projectId } : { conversationId: source?.conversationId ?? null, projectId: null };
    if (target) shell.openPane({ kind: 'video', target }, from);
    else shell.go({ tab: 'home', ...from });
    useShell.getState().revealConversation();
  };
  return (
    <RACButton className={(state) => agentTile(state)} onPress={open}>
      <span className={iconBox}>
        <Comment />
      </span>
      <span className={text}>
        <span className={name}>{C.agentCardTitle}</span>
        <span className={sub}>{inProject ? C.agentCardNew(driver?.name ?? C.agentCardSomeAgent) : C.agentCardOutside}</span>
      </span>
      <span className={chev}>
        <ChevronRight />
      </span>
    </RACButton>
  );
}

function SetupCard({ guide }: { guide: GateGuide }) {
  const { busy, fix } = useGateFix(guide);
  return (
    <div className={setupCard} role="status">
      <span className={iconBox}>
        <Settings />
      </span>
      <span className={text}>
        <span className={name}>{guide.title}</span>
        <span className={sub}>{guide.body}</span>
        <Link variant="secondary" onPress={() => !busy && void fix()}>
          {guide.action}
        </Link>
      </span>
    </div>
  );
}

/**
 * Generate a soundtrack (prototype panel-aitools.jsx `openSoundtrack`): not done in this tab. Instead, this video is carried to Tools › Generate music, with the duration pre-filled from the video (rounded up to the nearest 5 seconds and clamped to the range; if the video is longer than a single generation's limit, the limit is pre-filled and the result loops to fill the whole video; product design §2.7 「生成配乐」 (generate soundtrack)).
 * On submit it carries `videoId`; once done, the Runtime imports that audio into this video's assets, and the editor then lays it down on a music track (soundtrack-bed.tsx).
 */
function openSoundtrack(videoId: Id, sequence: Sequence): void {
  const video = useVideo.getState().video;
  const videoName = video?.state?.video.name ?? video?.ref?.name ?? sequence.name;
  const entryId = entryOfVideo(useSpace.getState().entries, videoId)?.id ?? videoId;
  const videoSec = durationSeconds(sequence);
  useVideoTools.getState().setPreset({
    tool: 'generate-music',
    entryId,
    soundtrack: { videoId, videoName, videoSec, targetDurationSec: soundtrackFor(videoSec).targetDurationSec },
  });
  useShell.getState().go({ tab: 'tools', tool: 'generate-music' });
}

/**
 * The list page of the AI tools tab (prototype panel-aitools-list.jsx, product design §5.10 「分批」 (in batches)): a card at the top to hand off to the Agent; when there is no script, an explanation card is added and tool rows are greyed out (generating a soundtrack does not use the script, so it stays clickable).
 * Below, the first batch of tools grouped by category, plus the short-video cut in the 「画面」 (Visuals) group and generate-soundtrack in the 「声音」 (Sound) group, each row with one sentence of description and its status on this video; the footnote says which tools are still in their own panels.
 */
export function AiToolsList({ videoId, sequence, documents }: { videoId: Id; sequence: Sequence; documents: Record<Id, DocumentRecord> }) {
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const guide = gateGuide(homeGate(drivers, checking));
  const hasTranscript = Object.values(documents).some((d) => d.kind === 'speech');
  const states = useRowStates(videoId, sequence, documents);
  return (
    <>
      <PanelHead title={EL.tabAiTools} />
      <div className={`${body} cc-scroll`}>
        <AgentCard guide={guide} />
        {hasTranscript ? null : (
          <div className={emptyCard}>
            <span className={name}>{C.noTranscriptTitle}</span>
            <span>{C.noTranscriptBody}</span>
            <Button size="S" variant="secondary" onPress={() => useEditor.getState().showPanel('transcript')}>
              {C.goTranscribe}
            </Button>
          </div>
        )}
        {LIST_GROUPS.map((group) => (
          <section key={group} aria-label={AI_TOOL_GROUP_LABEL[group]}>
            <h3 className={secHead}>{AI_TOOL_GROUP_LABEL[group]}</h3>
            {groupSub(group) ? <p className={groupNote}>{groupSub(group)}</p> : null}
            {listedTools(group).map((t) => {
              const Icon = TOOL_ICON[t.id] ?? Edit;
              const state = states[t.id];
              return (
                <RACButton
                  key={t.id}
                  className={(s) => tile(s)}
                  isDisabled={!hasTranscript && needsTranscript(t.id)}
                  onPress={() => (t.tier === 'tool' ? openSoundtrack(videoId, sequence) : openAiTool(videoId, t.id))}>
                  <span className={iconBox}>
                    <Icon />
                  </span>
                  <span className={text}>
                    <span className={name}>{t.name}</span>
                    <span className={sub}>{t.desc}</span>
                  </span>
                  {state ? (
                    <Badge size="S" variant={state.tone} fillStyle="subtle" styles={stateChip}>
                      {state.text}
                    </Badge>
                  ) : null}
                  <span className={chev}>
                    <ChevronRight />
                  </span>
                </RACButton>
              );
            })}
          </section>
        ))}
        <p className={footnote}>{laterNote()}</p>
      </div>
    </>
  );
}
