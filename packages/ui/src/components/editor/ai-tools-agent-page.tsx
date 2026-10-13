import { useMemo, useRef, useState, type ReactNode } from 'react';
import { getLocale, type DocumentRecord, type Id, type Sequence } from '@cuccut/protocol';
import { Checkbox, NumberField, Picker, PickerItem, TextField, ToastQueue } from '@react-spectrum/s2';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  agentStaysOnPage,
  aiTool,
  canvasRatio,
  CLEANUP_OPTIONS,
  cleanupExtra,
  COVER_COUNT,
  COVER_RATIOS,
  COVER_TEXT,
  hasScope,
  intentPrompt,
  isWritingTool,
  TITLE_COUNT,
  toolEffect,
  toolDraftKey,
  toolTemplate,
  writingExtra,
  type AgentToolId,
  type CleanupKey,
  type CoverRatio,
  type CoverText,
} from '../../model/ai-tools.ts';
import { chapterPieces } from '../../model/export-range.ts';
import { bundleName } from '../../model/models-local.ts';
import { readSpeechWords } from '../../model/speech-cues.ts';
import { transcriptParagraphs, transcriptWords } from '../../model/transcript-cut.ts';
import { transcribeModelInfo } from '../../model/transcribe-speakers.ts';
import { useAiToolRunner, type AiToolRunner } from '../../state/ai-tool-runner-store.ts';
import { useModels } from '../../state/models-store.ts';
import { AsrMoreOptions, useSpeakerState } from '../tools/asr-more-options.tsx';
import { directHasScope, directParams, directRefresh, directTool, scopedParagraphs } from './ai-tool-direct.ts';
import { DirectModelGate, DirectModelPicker, DirectProblem, DirectReceiptView, DirectResultView, DirectRunView, useDirectModel } from './ai-tool-direct-view.tsx';
import { AiToolAgentRun } from './ai-tool-agent-run.tsx';
import { refreshParts, StaleDirectStart, StaleRefreshView, translationLabel, useStaleDirect, useStaleRefreshLive } from './ai-tool-stale-direct.tsx';
import { AgentUseRow, AiToolPrompt, SessionRow, useToolHandoff, type DirectPrompt } from './ai-tool-prompt.tsx';
import { closeAiToolResult, runKey, startAiTool, useAiToolRun } from './ai-tool-run.ts';
import type { Handoff } from './ai-tools-handoff.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { setAiToolAgentRun, useAiToolAgentRuns, type AiToolPreset } from './ai-tools-nav.ts';
import { PanelHead } from './panel-head.tsx';
import { TranslateProblemAlert } from './translate-status.tsx';
import { useTranslateRun } from './translate-run.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';
import { useDocumentBody } from './use-document-body.ts';

const body = style({ flexGrow: 1, minHeight: 0, overflowY: 'auto', paddingX: 12, paddingTop: 12, paddingBottom: 16 });
/** The explanation card at the top of the tool page (prototype .aicard). */
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
const problemBox = style({ marginBottom: 12 });
const cardTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const secHead = style({ marginTop: 16, marginBottom: 8, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
/** A row in the settings state (prototype .tsetup__row): label on the left, control on the right. */
const rows = style({ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 });
const row = style({ display: 'flex', alignItems: 'start', gap: 8 });
const rowLabel = style({ flexShrink: 0, width: 56, paddingTop: 4, font: 'ui-sm', color: 'gray-700' });
const rowBody = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const options = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const option = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const optionSub = style({ paddingStart: 24, font: 'ui-xs', color: 'gray-600' });
const hint = style({ margin: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
/** The last line of the explanation card: whether pressing it will change the video (prototype .ail__effect). */
const effect = style({ display: 'flex', alignItems: 'start', gap: '[6px]', marginTop: 4, color: 'gray-700' });
const effectIcon = iconStyle({ size: 'S' });

/** A row in the settings state: label on the left, control on the right (also used by the short-video parameters page). */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={row}>
      <span className={rowLabel}>{label}</span>
      <div className={rowBody}>{children}</div>
    </div>
  );
}

/** A checkbox option, with a small line of explanation underneath. */
export function Option({
  label,
  sub,
  isSelected,
  isDisabled,
  onChange,
}: {
  label: string;
  sub: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange(on: boolean): void;
}) {
  return (
    <div className={option}>
      <Checkbox size="S" isSelected={isSelected} isDisabled={isDisabled} onChange={onChange}>
        {label}
      </Checkbox>
      <span className={optionSub}>{sub}</span>
    </div>
  );
}

/** The explanation card at the top of the tool page: name, description, and whether it changes the video (product design §5.10 “parameters page”, paragraph 1). */
export function ToolCard({ name, lines, effect: what }: { name: string; lines: readonly string[]; effect: string }) {
  return (
    <div className={card}>
      <span className={cardTitle}>{name}</span>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <span className={effect}>
        <InfoCircle styles={effectIcon} />
        {what}
      </span>
    </div>
  );
}

/**
 * The tool page for handing off to an Agent (prototype panel-aitools.jsx `DocFlow`, panel-aitools-write.jsx, and the settings states of panel-aitools-cover.jsx; product design §5.10 “parameters page”):
 * the explanation card (name, description, whether it changes the video), setting rows (“Use”, range, conversation, plus the tool's own checkboxes and numbers), the prompt box (pre-filled template, with this tool's skill attached),
 * the main button, and a destination line. Language, style, length and point of view are written in the prompt, no longer dropdowns. Pressing it sends and returns the tool page to the list; finding cut points and refreshing stale translations stay in place (`agentStaysOnPage`), and this page turns into a progress card (`AiToolAgentRun`); “Set up again” or “Done” after it finishes returns here.
 */
export function AiAgentToolPage({
  videoId,
  tool,
  preset,
  sequence,
  documents,
  onBack,
}: {
  videoId: Id;
  tool: AgentToolId;
  preset: AiToolPreset | null;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  onBack(): void;
}) {
  const handoff = useToolHandoff();
  const ref = handoff.ref;
  const info = aiTool(tool);
  const writing = isWritingTool(tool);

  const chapters = useMemo(() => chapterPieces(sequence), [sequence]);
  const [scopeKey, setScopeKey] = useState<string>('all');
  const scopeIndex = chapters.findIndex((c) => c.id === scopeKey);
  const scope = scopeIndex >= 0 ? C.scopeChapter(scopeIndex + 1, chapters[scopeIndex]!.label) : null;

  // “Use”: remembered per tool, whether to hand off to the Agent or call a model directly (tools that cannot call a model directly always go to the Agent). When refreshing stale translations by calling the model directly,
  // `ai-tool` is not used; the in-place refresh of the translation flow is used instead (`viaRefresh`).
  const kind = directTool(tool);
  const savedRunner = useAiToolRunner((s) => s.runners[tool]);
  const setRunner = useAiToolRunner((s) => s.setRunner);
  const runner: AiToolRunner = (kind || directRefresh(tool)) && savedRunner === 'model' ? 'model' : 'agent';
  const viaModel = runner === 'model' && kind ? kind : null;
  const viaRefresh = runner === 'model' && directRefresh(tool);
  const model = useDirectModel(directRefresh(tool) ? 'stale' : (kind ?? 'summary'));
  const staleDirect = useStaleDirect(documents, preset, viaRefresh);
  const refreshLive = useStaleRefreshLive(viaRefresh ? (staleDirect.record?.id ?? null) : null);
  const refreshProblem = useTranslateRun((s) => (viaRefresh && s.problems[videoId]?.refresh ? s.problems[videoId] : null));
  const key = kind ? runKey(videoId, kind) : '';
  const run = useAiToolRun((s) => s.runs[key] ?? null);
  const result = useAiToolRun((s) => s.results[key] ?? null);
  const receipt = useAiToolRun((s) => s.receipts[key] ?? null);
  const problem = useAiToolRun((s) => s.problems[key] ?? null);
  const modelSection = useRef<HTMLDivElement>(null);
  // The one-time handoff from a tool that stays in place: show the progress card if there is one.
  const stays = agentStaysOnPage(tool);
  const draftKey = toolDraftKey(videoId, tool);
  // Records read back after a restart that have not yet been adopted (`restored`) are not shown first: they are shown only once adopted; ones that already finished get dropped.
  const agentRun = useAiToolAgentRuns((s) => (stays ? (s.runs[draftKey] ?? null) : null));

  const [pre, setPre] = useState(true);
  const [cleanup, setCleanup] = useState<Record<CleanupKey, boolean>>({ fillers: true, pauses: true, repeats: true });
  const [stale, setStale] = useState({ edited: true, cut: true });

  const [platform, setPlatform] = useState('');
  // Blog's “Add keyframe illustrations” option: off by default. The picture is only available to the Agent, so when calling the model directly it is greyed out and not included in the template.
  const [frames, setFrames] = useState(false);
  const framesOn = tool === 'blog' && frames && !viaModel;
  const [count, setCount] = useState<number>(tool === 'cover' ? COVER_COUNT.initial : TITLE_COUNT.initial);
  const [idea, setIdea] = useState('');
  const [ratio, setRatio] = useState<CoverRatio>('project');
  const [coverText, setCoverText] = useState<CoverText>('phrase');
  const projectRatio = canvasRatio(sequence.canvas.width, sequence.canvas.height);

  // Re-transcribe's “More options › Identify speakers” (design draft panel-aitools.jsx): describes it using the default speech model in effect; it only changes the prompt,
  // and does not block “Hand to Agent” even when “speaker diarization” is not installed.
  const asrView = useModels((s) => s.capabilities);
  const asrRef = tool === 'retranscribe' ? (asrView?.transcribe.effective ?? null) : null;
  const asrInfo = asrView && asrRef ? transcribeModelInfo(asrView, asrRef) : null;
  const asrBundle = useModels((s) => (asrRef?.providerId === 'local' ? s.bundles.find((b) => b.bundleId === asrRef.modelId) : undefined));
  const [speakerPick, setSpeakerPick] = useState<boolean | null>(null);
  const speakers = useSpeakerState(asrInfo, speakerPick);

  const extra: (string | null)[] = writing
    ? writingExtra(tool, {
        scope,
        platform,
        idea,
        ratio: ratio === 'project' ? projectRatio : ratio,
        coverText,
        frames: framesOn,
      })
    : [
        tool === 'chapters' && pre && !viaModel ? C.chaptersPolishFirst : null,
        ...(tool === 'cleanup' ? cleanupExtra(cleanup) : []),
        tool === 'stale' && preset?.language ? C.staleOnly(preset.language) : null,
        tool === 'retranscribe' && speakers.s.step ? C.retranscribeSpeakers : null,
      ];
  const intent = intentPrompt({
    tool,
    title: ref?.name ?? null,
    scope: writing ? null : scope,
    edited: tool === 'stale' ? stale.edited : undefined,
    cut: tool === 'stale' ? stale.cut : undefined,
    count: tool === 'title' || tool === 'cover' ? count : null,
    extra,
  });
  // The language is written into the template: it follows the script (if the user wants another language, they change this sentence).
  const template = toolTemplate(tool, intent);
  const staleEmpty = tool === 'stale' && !stale.edited && !stale.cut;

  // Calling the model directly: which transcript is sent to the model, and how many segments are in the range (counted the same way as the script panel).
  const speech = useMemo(() => Object.values(documents).find((d) => d.kind === 'speech' && !!d.sourceAssetId) ?? null, [documents]);
  const speechBody = useDocumentBody(viaModel && speech ? speech : undefined);
  const range = viaModel && directHasScope(viaModel) && scopeIndex >= 0 ? chapters[scopeIndex]! : null;
  const paragraphs = useMemo(() => {
    const assetId = speech?.sourceAssetId;
    const read = speechBody === undefined || !assetId ? null : readSpeechWords(speechBody);
    return read && assetId ? transcriptParagraphs(transcriptWords(sequence, assetId, read.words)) : [];
  }, [speechBody, speech, sequence]);
  const direct: DirectPrompt | null = viaModel
    ? {
        context: {
          tool: viaModel,
          paragraphs: scopedParagraphs(paragraphs, range),
          scope: range ? scope : null,
          chapters: chapters.length,
        },
        model: { name: model.name, local: model.local, ready: model.ready },
        picker: <DirectModelPicker model={model} />,
        gate: (
          <div ref={modelSection}>
            <DirectModelGate model={model} />
          </div>
        ),
        onNotReady: () => {
          // The button is not greyed out: say clearly what is missing and bring the gate into view (same as the translation page).
          modelSection.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          ToastQueue.neutral(model.selected?.why ?? C.noTextModel, { timeout: 4000 });
        },
        onStart: (prompt, attachments, skills) =>
          startAiTool(
            directParams({
              videoId,
              tool: viaModel,
              prompt,
              range: range ? { start: range.start, end: range.end } : null,
              documentId: speech?.id ?? null,
              attachments,
              skills,
              model: model.ref,
              uiLanguage: getLocale(),
            }),
            model.name ?? '',
          ),
      }
    : null;

  if (agentRun && !agentRun.restored) return <AiToolAgentRun videoId={videoId} tool={tool} run={agentRun} onBack={onBack} />;

  // Refresh running in place: the parameters page turns into progress in place (the one started from the subtitle panel also counts); when done it returns to the parameters page, and the message offers undo (translate-run.ts).
  if (refreshLive) {
    return (
      <>
        <PanelHead title={info.name} back={{ label: C.back, onPress: onBack }} />
        <div className={`${body} cc-scroll`}>
          <StaleRefreshView live={refreshLive} />
        </div>
      </>
    );
  }

  // Calling the model directly is running, or has produced a result or receipt: this page turns into that state (same as the four-state page for identifying speakers). The “Back” and “Done” on the result and receipt pages both return to the parameters page
  // (settings and prompt still there); “Back” on the parameters page goes back to the list. While running there is no parameters page to return to, so “Back” goes to the list and the task keeps running in the background.
  if (kind && (run || result || receipt)) {
    return (
      <>
        <PanelHead title={info.name} back={{ label: C.back, onPress: run ? onBack : () => closeAiToolResult(key) }} />
        <div className={`${body} cc-scroll`}>
          {run ? (
            <DirectRunView run={run} />
          ) : result ? (
            <DirectResultView runKey={key} result={result} model={result.summary.modelId} />
          ) : receipt ? (
            <DirectReceiptView runKey={key} receipt={receipt} />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <PanelHead title={info.name} back={{ label: C.back, onPress: onBack }} />
      <div className={`${body} cc-scroll`}>
        {problem ? (
          <div className={problemBox}>
            <DirectProblem runKey={key} problem={problem} />
          </div>
        ) : null}
        {refreshProblem ? (
          <div className={problemBox}>
            <TranslateProblemAlert videoId={videoId} problem={refreshProblem} />
          </div>
        ) : null}
        <ToolCard name={info.name} lines={viaRefresh ? [C.staleDirectSetup] : (info.setup ?? [info.desc])} effect={toolEffect(tool)} />

        {tool === 'cover' ? (
          <>
            <h3 className={secHead}>{C.coverIdea}</h3>
            <TextField aria-label={C.coverIdea} size="S" styles={field} placeholder={C.coverIdeaPlaceholder} value={idea} onChange={setIdea} />
          </>
        ) : null}

        <div className={rows}>
          <AgentUseRow
            handoff={handoff}
            tool={tool}
            runner={runner}
            onRunner={(next) => setRunner(tool, next)}
            modelName={model.name}
          />

          {(viaModel ? directHasScope(viaModel) : hasScope(tool)) ? (
            <Row label={C.scope}>
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
                      {C.scopeChapter(i + 1, c.label)}
                    </PickerItem>
                  )),
                ]}
              </Picker>
              {chapters.length ? null : <p className={hint}>{C.scopeNoChapters}</p>}
            </Row>
          ) : null}

          {tool === 'blog' ? (
            <Option
              label={C.framesLabel}
              sub={viaModel ? C.framesSubModel : C.framesSub}
              isSelected={framesOn}
              isDisabled={!!viaModel}
              onChange={setFrames}
            />
          ) : null}
          {viaModel || viaRefresh ? null : <SessionRow handoff={handoff} />}

          {tool === 'chapters' && !viaModel ? <Option label={C.prePolish} sub={pre ? C.prePolishOn : C.prePolishOff} isSelected={pre} onChange={setPre} /> : null}
          {tool === 'cleanup' ? (
            <div className={options}>
              {CLEANUP_OPTIONS.map((o) => (
                <Option key={o.key} label={o.label} sub={o.sub} isSelected={cleanup[o.key]} onChange={(on) => setCleanup((c) => ({ ...c, [o.key]: on }))} />
              ))}
            </div>
          ) : null}
          {viaRefresh ? (
            <Row label={C.staleTranslation}>
              {staleDirect.translations.length ? (
                <Picker
                  aria-label={C.staleTranslation}
                  size="S"
                  styles={field}
                  isDisabled={staleDirect.translations.length < 2}
                  selectedKey={staleDirect.record?.id ?? null}
                  onSelectionChange={(key) => key && staleDirect.pick(String(key))}>
                  {staleDirect.translations.map((t) => (
                    <PickerItem key={t.id} id={t.id}>
                      {translationLabel(t, staleDirect.translations)}
                    </PickerItem>
                  ))}
                </Picker>
              ) : null}
              <p className={hint}>
                {!staleDirect.translations.length
                  ? C.staleNoTranslation
                  : !staleDirect.counts
                    ? C.staleReading
                    : staleDirect.counts.todo
                      ? C.staleCounts(refreshParts(staleDirect.counts))
                      : C.staleNothing}
              </p>
              <p className={hint}>{C.staleCutNeedsAgent}</p>
            </Row>
          ) : tool === 'stale' ? (
            <div className={options}>
              <Option label={C.staleEdited} sub={C.staleEditedSub} isSelected={stale.edited} onChange={(on) => setStale((s) => ({ ...s, edited: on }))} />
              <Option label={C.staleCut} sub={C.staleCutSub} isSelected={stale.cut} onChange={(on) => setStale((s) => ({ ...s, cut: on }))} />
              {staleEmpty ? <p className={hint}>{C.staleNone}</p> : null}
            </div>
          ) : null}
          {tool === 'retranscribe' ? <p className={hint}>{C.retranscribeModel}</p> : null}
          {asrInfo ? (
            <AsrMoreOptions state={speakers} name={asrBundle ? bundleName(asrBundle) : asrInfo.label} onPick={setSpeakerPick} />
          ) : null}

          {tool === 'title' || tool === 'cover' ? (
            <Row label={tool === 'title' ? C.titleCount : C.coverCount}>
              <NumberField
                aria-label={tool === 'title' ? C.titleCount : C.coverCount}
                size="S"
                minValue={tool === 'title' ? TITLE_COUNT.min : COVER_COUNT.min}
                maxValue={tool === 'title' ? TITLE_COUNT.max : COVER_COUNT.max}
                step={1}
                value={count}
                onChange={(n) => Number.isFinite(n) && setCount(n)}
              />
              {tool === 'title' ? <p className={hint}>{C.titleCountNote(TITLE_COUNT.min, TITLE_COUNT.max)}</p> : null}
            </Row>
          ) : null}
          {tool === 'cover' ? (
            <>
              <Row label={C.coverRatio}>
                <Picker aria-label={C.coverRatio} size="S" styles={field} selectedKey={ratio} onSelectionChange={(key) => key && setRatio(key as CoverRatio)}>
                  {COVER_RATIOS.map((r) => (
                    <PickerItem key={r} id={r}>
                      {r === 'project' ? E.withNote(C.coverRatioProject, projectRatio) : r}
                    </PickerItem>
                  ))}
                </Picker>
              </Row>
              <Row label={C.coverText}>
                <Picker
                  aria-label={C.coverText}
                  size="S"
                  styles={field}
                  selectedKey={coverText}
                  onSelectionChange={(key) => key && setCoverText(key as CoverText)}>
                  {COVER_TEXT.map((m) => (
                    <PickerItem key={m.key} id={m.key}>
                      {m.label}
                    </PickerItem>
                  ))}
                </Picker>
              </Row>
            </>
          ) : null}
          {tool === 'title' || tool === 'desc' ? (
            <Row label={C.platform}>
              <TextField aria-label={C.platform} size="S" styles={field} placeholder={C.platformPlaceholder} value={platform} onChange={setPlatform} />
            </Row>
          ) : null}
        </div>

        {viaRefresh ? (
          <StaleDirectStart
            videoId={videoId}
            stale={staleDirect}
            model={model}
            onNotReady={() => ToastQueue.neutral(model.selected?.why ?? C.noTextModel, { timeout: 4000 })}
          />
        ) : (
          <AiToolPrompt
            key={tool}
            videoId={videoId}
            tool={tool}
            template={template}
            handoff={handoff}
            isDisabled={staleEmpty}
            onDone={onBack}
            {...(stays ? { onHandedOff: (h: Handoff) => setAiToolAgentRun(draftKey, { conversationId: h.conversationId, taskId: h.taskId, handedAt: h.handedAt }) } : {})}
            direct={direct}
          />
        )}
      </div>
    </>
  );
}
