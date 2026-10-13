import { useState } from 'react';
import { Button, NumberField, SegmentedControl, SegmentedControlItem, Text, ToastQueue } from '@react-spectrum/s2';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Layers from '@react-spectrum/s2/icons/Layers';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  AUDIO_RATES,
  CODECS,
  crfOf,
  HEIGHT_CAPS,
  heightKey,
  LIMITS,
  QUALITIES,
  rejectionText,
  settingsLine,
  addEntryInput,
  againTranscodeDraft,
  BLANK_COMPRESS,
  BLANK_EXTRACT,
  BLANK_MERGE,
  sortByName,
  TRANSCODE_PIPELINE,
  transcodeProblems,
  transcodeRequest,
  type TranscodeAction,
  type TranscodeCodec,
  type TranscodeDraft,
  type TranscodeQuality,
  type TranscodeRate,
} from '../../model/tools-transcode.ts';
import type { FileVideoToolId } from '../../model/tool-catalog.ts';
import { saveTarget } from '../../model/tool-frame.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { BarStatus, detail, detailGrow, Gate, HeaderChip, hintText, Row, Section, SectionLink, submitOnModEnter, ToolPage, Workbench } from './tool-parts.tsx';
import { FORM_COPY, TRANSCODE_COPY } from './tools-copy.ts';
import { SaveDirRow } from './tool-frame.tsx';
import { FfmpegGate, FilePicker, InputList, TranscodeSide, useFfmpeg, type FfmpegState } from './transcode-parts.tsx';
import { SpaceInputs, useInputName } from './transcode-space.tsx';
import { blockOf, useToolStatus } from './use-tool-status.ts';
import { usePreset, useRerun } from './video-tool-parts.tsx';

/*
 * Design mockup tool-video.jsx `VideoToolShell`, tool-video-compress.jsx, tool-video-merge.jsx and tool-video-extract.jsx: compress, merge and extract audio share one page; a switch at the top switches the route, and each keeps its tool ID and draft; files and settings on the left, “处理记录” (processing records) on the right.
 * Submission goes through the Runtime's fixed `transcode` flow (`pipelines.start`): read input → encode → verify output → publish to the save location (“更改…” (change…) only changes it this once).
 * Options in the mockup that the Runtime cannot do (frame rate, hardware encoding, removing the audio track, targeting a file size, forcing stream copy or re-encoding when merging) are not drawn; the differences are described in the commit message.
 */

const lede = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });
const kbpsField = style({ width: 160 });
const subHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, marginTop: 8 });
const subTitle = style({ flexGrow: 1, margin: 0, font: 'detail', fontWeight: 'bold', color: 'gray-700' });

/** Compress video. */
export function CompressTool() {
  return <TranscodeTool action="compress" />;
}

/** Merge videos. */
export function MergeTool() {
  return <TranscodeTool action="merge" />;
}

/** Extract audio. */
export function ExtractAudioTool() {
  return <TranscodeTool action="extract-audio" />;
}

/** Tool ID for each action and several UI strings (strings are read at render time). */
type ActionText = { title: string; lede: string; submit: string; files: string; drop: string; dropSub: string };
const ACTIONS: Record<TranscodeAction, { tool: FileVideoToolId; text: () => ActionText }> = {
  compress: {
    tool: 'compress-video',
    text: () => ({
      title: TRANSCODE_COPY.compressTitle,
      lede: TRANSCODE_COPY.compressLede,
      submit: TRANSCODE_COPY.compressSubmit,
      files: TRANSCODE_COPY.filesCompress,
      drop: TRANSCODE_COPY.dropCompress,
      dropSub: TRANSCODE_COPY.dropCompressSub,
    }),
  },
  merge: {
    tool: 'merge-video',
    text: () => ({
      title: TRANSCODE_COPY.mergeTitle,
      lede: TRANSCODE_COPY.mergeLede,
      submit: TRANSCODE_COPY.mergeSubmit,
      files: TRANSCODE_COPY.filesMerge,
      drop: TRANSCODE_COPY.dropMerge,
      dropSub: TRANSCODE_COPY.dropMergeSub,
    }),
  },
  'extract-audio': {
    tool: 'extract-audio',
    text: () => ({
      title: TRANSCODE_COPY.extractTitle,
      lede: TRANSCODE_COPY.extractLede,
      submit: TRANSCODE_COPY.extractSubmit,
      files: TRANSCODE_COPY.filesExtract,
      drop: TRANSCODE_COPY.dropExtract,
      dropSub: TRANSCODE_COPY.dropExtractSub,
    }),
  },
};

/** The switch at the top of the page: compress / merge / extract audio; switching changes the route. */
function ActionSwitch({ action }: { action: TranscodeAction }) {
  const go = useShell((s) => s.go);
  return (
    <SegmentedControl
      aria-label={TRANSCODE_COPY.switchLabel}
      selectedKey={ACTIONS[action].tool}
      onSelectionChange={(key) => {
        if (key !== ACTIONS[action].tool) go({ tab: 'tools', tool: key as FileVideoToolId });
      }}>
      <SegmentedControlItem id="compress-video">{TRANSCODE_COPY.switchCompress}</SegmentedControlItem>
      <SegmentedControlItem id="merge-video">{TRANSCODE_COPY.switchMerge}</SegmentedControlItem>
      <SegmentedControlItem id="extract-audio">{TRANSCODE_COPY.switchExtract}</SegmentedControlItem>
    </SegmentedControl>
  );
}

/** The status line in the page header: `tools.list` says the tool cannot be used (the Web reason is also shown here), the ffmpeg detection, a problem before submitting, or how many files and settings have been chosen. */
function barLine(
  block: string | null | undefined,
  ffmpeg: FfmpegState,
  draft: TranscodeDraft,
  action: TranscodeAction,
  problems: readonly string[],
  tried: boolean,
): { text: string; bad: boolean } {
  if (block === undefined) return { text: FORM_COPY.loading, bad: false };
  // The full reason is in the "Not available right now" card on the page; the header only says so.
  if (block) return { text: TRANSCODE_COPY.unavailable, bad: true };
  if (ffmpeg.status === 'checking') return { text: TRANSCODE_COPY.ffmpegChecking, bad: false };
  if (ffmpeg.status === 'done' && !ffmpeg.line.ready) return { text: ffmpeg.line.text, bad: true };
  if (problems.length) return { text: problems[0]!, bad: tried };
  const count = action === 'merge' ? TRANSCODE_COPY.clips(draft.inputs.length) : TRANSCODE_COPY.files(draft.inputs.length);
  if (ffmpeg.status === 'failed') return { text: `${count} · ${TRANSCODE_COPY.ffmpegCheckFailed(ffmpeg.message)}`, bad: false };
  return { text: `${count} · ${ffmpeg.line.text}`, bad: false };
}

function TranscodeTool({ action }: { action: TranscodeAction }) {
  const runtime = useRuntime();
  const merge = action === 'merge';
  const extract = action === 'extract-audio';
  const meta = { tool: ACTIONS[action].tool, ...ACTIONS[action].text() };
  const draft = useTools((s) => (merge ? s.merge : extract ? s.extract : s.compress));
  const patchCompress = useTools((s) => s.patchCompress);
  const patchMerge = useTools((s) => s.patchMerge);
  const patchExtract = useTools((s) => s.patchExtract);
  const patch = merge ? patchMerge : extract ? patchExtract : patchCompress;
  // Availability is decided by `tools.list`: on the Web service the fixed flow is not allowed by default (`WEB_METHOD_NOT_ALLOWED`), and when the save location is outside the project directory, the flow that writes only to the save location is unavailable (`PATH_OUTSIDE_PROJECT`); the form is still drawn, the buttons are disabled, and the reason is written in the header and on the page.
  const tools = useToolStatus();
  const block = blockOf(tools, meta.tool, 'file');
  // External tools are not detected in the browser (the Runtime does not expose `externalTools.*` to web pages).
  const web = runtime.host.platform === 'web';
  const ffmpeg = useFfmpeg(!web);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  // The picker opened by “从 Space 添加…” (Add from Space…); entries brought from the Space viewer are added to the list directly.
  const [fromSpace, setFromSpace] = useState(false);
  const nameOf = useInputName();
  usePreset(meta.tool, (entryId) => {
    patch({ inputs: addEntryInput(draft.inputs, entryId) });
    setFromSpace(true);
  });
  // “再做一次 / 重试” (Do again / Retry) from the Space viewer or background job details: fill in with this job's files and settings.
  useRerun(meta.tool, (job) => {
    const next = againTranscodeDraft(job, merge ? BLANK_MERGE : extract ? BLANK_EXTRACT : BLANK_COMPRESS);
    if (!next) return;
    patch(next);
    ToastQueue.neutral(TRANSCODE_COPY.againDone, { timeout: 3000 });
  });

  const problems = transcodeProblems(draft, action);
  const blocked = block !== null || (ffmpeg.state.status === 'done' && !ffmpeg.state.line.ready);
  const status = barLine(block, ffmpeg.state, draft, action, problems, tried);
  const setInputs = (inputs: string[]) => patch({ inputs });

  const submit = () => {
    setTried(true);
    if (blocked || submitting) return;
    if (problems.length) {
      ToastQueue.neutral(problems[0]!, { timeout: 4000 });
      return;
    }
    setSubmitting(true);
    runtime
      .startPipeline(TRANSCODE_PIPELINE, { ...transcodeRequest(draft, action, saveTarget(tools.saveDirectory, draft.outDir)) })
      .then(
        () => ToastQueue.positive(TRANSCODE_COPY.submitted, { timeout: 3000 }),
        (e: unknown) => ToastQueue.negative(TRANSCODE_COPY.submitFailed(rejectionText(e)), { timeout: 8000 }),
      )
      .finally(() => setSubmitting(false));
  };

  const bar = (
    <>
      <BarStatus text={status.text} bad={status.bad} />
      <Button variant="accent" isDisabled={blocked} isPending={submitting} onPress={submit}>
        {merge ? <Layers /> : extract ? <AudioWave /> : <Filmstrip />}
        <Text>{meta.submit}</Text>
      </Button>
    </>
  );

  const files = (
    <Section
      title={meta.files}
      aside={
        draft.inputs.length ? (
          <>
            {merge && draft.inputs.length > 1 ? (
              <SectionLink onPress={() => setInputs(sortByName(draft.inputs, (i) => nameOf(i).name))}>{TRANSCODE_COPY.sortByName}</SectionLink>
            ) : null}
            <SectionLink onPress={() => setInputs([])}>{TRANSCODE_COPY.clearAll}</SectionLink>
          </>
        ) : null
      }>
      {draft.inputs.length ? <InputList inputs={draft.inputs} ordered={merge} onChange={setInputs} nameOf={nameOf} /> : null}
      {draft.inputs.length ? (
        <span className={detail}>
          {merge ? `${TRANSCODE_COPY.clips(draft.inputs.length)} · ${TRANSCODE_COPY.dragHint}` : TRANSCODE_COPY.files(draft.inputs.length)}
        </span>
      ) : null}
      <FilePicker
        inputs={draft.inputs}
        onChange={setInputs}
        title={meta.drop}
        sub={meta.dropSub}
        withAudio={extract}
      />
      <SectionLink onPress={() => setFromSpace((v) => !v)}>{fromSpace ? TRANSCODE_COPY.spaceDone : TRANSCODE_COPY.spaceAdd}</SectionLink>
      {fromSpace ? <SpaceInputs tool={meta.tool} inputs={draft.inputs} onChange={setInputs} /> : null}
    </Section>
  );

  const toggle = <SectionLink onPress={() => setAdvanced((v) => !v)}>{advanced ? TRANSCODE_COPY.collapse : TRANSCODE_COPY.expand}</SectionLink>;
  const more = advanced ? <MoreRows draft={draft} patch={patch} withRate={merge} /> : <span className={detail}>{settingsLine(draft)}</span>;

  const main = (
    <>
      <ActionSwitch action={action} />
      <p className={lede}>{meta.lede}</p>
      {block ? <Gate title={TRANSCODE_COPY.unavailable} body={block} /> : web ? null : <FfmpegGate state={ffmpeg.state} recheck={ffmpeg.recheck} />}
      {files}
      {extract ? (
        <Section title={TRANSCODE_COPY.extractAudio}>
          <AudioRow draft={draft} patch={patch} hint={TRANSCODE_COPY.extractAudioHint} />
        </Section>
      ) : merge ? (
        <Section title={TRANSCODE_COPY.mergeHow}>
          <p className={hintText}>{TRANSCODE_COPY.mergeHowBody}</p>
          <div className={subHead}>
            <h3 className={subTitle}>{TRANSCODE_COPY.reencodeTitle}</h3>
            {toggle}
          </div>
          {more}
        </Section>
      ) : (
        <>
          <Section title={TRANSCODE_COPY.rateTitle} aside={<RateSwitch draft={draft} patch={patch} />}>
            <RateBody draft={draft} patch={patch} />
          </Section>
          <Section title={TRANSCODE_COPY.more} aside={toggle}>
            {more}
          </Section>
        </>
      )}
      <SaveDirRow saveDirectory={tools.saveDirectory} override={draft.outDir} onChange={(outDir) => patch({ outDir })} note={TRANSCODE_COPY.saveNote} />
    </>
  );

  return (
    <ToolPage
      title={meta.title}
      bar={bar}
      chip={<HeaderChip text={TRANSCODE_COPY.chip} tone="neutral" />}>
      <Workbench main={main} side={<TranscodeSide />} sideLabel={TRANSCODE_COPY.side} onKeyDown={submitOnModEnter(submit)} />
    </ToolPage>
  );
}

type Patch = (patch: Partial<TranscodeDraft>) => void;

/** By quality or by bitrate (the mockup's “按体积” (by size) needs the source duration, which the UI cannot read, so bitrate is used instead). */
function RateSwitch({ draft, patch }: { draft: TranscodeDraft; patch: Patch }) {
  return (
    <SegmentedControl aria-label={TRANSCODE_COPY.rateTitle} selectedKey={draft.rate} onSelectionChange={(key) => patch({ rate: key as TranscodeRate })}>
      <SegmentedControlItem id="quality">{TRANSCODE_COPY.byQuality}</SegmentedControlItem>
      <SegmentedControlItem id="bitrate">{TRANSCODE_COPY.byBitrate}</SegmentedControlItem>
    </SegmentedControl>
  );
}

/** Three quality levels (the mockup uses three `.vcard` cards; here a segmented control is used, with the CRF and use case written after each level name), or a video bitrate. */
function RateBody({ draft, patch }: { draft: TranscodeDraft; patch: Patch }) {
  if (draft.rate === 'bitrate') {
    return (
      <>
        <Row label={TRANSCODE_COPY.videoKbps}>
          <NumberField
            aria-label={TRANSCODE_COPY.videoKbps}
            size="S"
            styles={kbpsField}
            minValue={LIMITS.videoKbps[0]}
            maxValue={LIMITS.videoKbps[1]}
            step={100}
            value={draft.videoKbps}
            onChange={(videoKbps) => Number.isFinite(videoKbps) && patch({ videoKbps })}
          />
          <span className={detail}>kbps</span>
        </Row>
        <span className={detail}>{TRANSCODE_COPY.bitrateHint}</span>
      </>
    );
  }
  return (
    <Row label={TRANSCODE_COPY.quality}>
      <SegmentedControl aria-label={TRANSCODE_COPY.quality} selectedKey={draft.quality} onSelectionChange={(key) => patch({ quality: key as TranscodeQuality })}>
        {QUALITIES.map((q) => (
          <SegmentedControlItem key={q.key} id={q.key}>
            {q.name}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <span className={detailGrow}>{`CRF ${crfOf(draft.quality, draft.codec)} · ${QUALITIES.find((q) => q.key === draft.quality)?.sub ?? ''}`}</span>
    </Row>
  );
}

/** The few rows shown when “更多设置” (more settings) is expanded: resolution, codec, audio; when merging, quality is here too (it only takes effect when re-encoding is needed). */
function MoreRows({ draft, patch, withRate }: { draft: TranscodeDraft; patch: Patch; withRate: boolean }) {
  return (
    <>
      {withRate ? (
        <>
          <Row label={TRANSCODE_COPY.rateTitle}>
            <RateSwitch draft={draft} patch={patch} />
          </Row>
          <RateBody draft={draft} patch={patch} />
        </>
      ) : null}
      <Row label={TRANSCODE_COPY.height}>
        <SegmentedControl
          aria-label={TRANSCODE_COPY.height}
          selectedKey={heightKey(draft.maxHeight)}
          onSelectionChange={(key) => patch({ maxHeight: HEIGHT_CAPS.find((h) => h.key === key)?.height ?? null })}>
          {HEIGHT_CAPS.map((h) => (
            <SegmentedControlItem key={h.key} id={h.key}>
              {h.name}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <span className={detailGrow}>{TRANSCODE_COPY.heightHint}</span>
      </Row>
      <Row label={TRANSCODE_COPY.codec}>
        <SegmentedControl aria-label={TRANSCODE_COPY.codec} selectedKey={draft.codec} onSelectionChange={(key) => patch({ codec: key as TranscodeCodec })}>
          {CODECS.map((c) => (
            <SegmentedControlItem key={c.key} id={c.key}>
              {c.name}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <span className={detailGrow}>{CODECS.find((c) => c.key === draft.codec)?.sub}</span>
      </Row>
      <AudioRow draft={draft} patch={patch} hint={TRANSCODE_COPY.audioHint} />
    </>
  );
}

/** Audio bitrate row (AAC). */
function AudioRow({ draft, patch, hint }: { draft: TranscodeDraft; patch: Patch; hint: string }) {
  return (
    <Row label={TRANSCODE_COPY.audio}>
      <SegmentedControl aria-label={TRANSCODE_COPY.audio} selectedKey={String(draft.audioKbps)} onSelectionChange={(key) => patch({ audioKbps: Number(key) })}>
        {AUDIO_RATES.map((rate) => (
          <SegmentedControlItem key={rate} id={String(rate)}>
            {`${rate} kbps`}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <span className={detailGrow}>{hint}</span>
    </Row>
  );
}
