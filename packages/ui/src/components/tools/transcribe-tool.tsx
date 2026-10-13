import { useState } from 'react';
import type { JobRecord } from '@cuccut/protocol';
import { Button, Content, DropZone, Heading, InlineAlert, Radio, RadioGroup, TextField, ToastQueue } from '@react-spectrum/s2';
import Upload from '@react-spectrum/s2/icons/Upload';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { DropItem } from 'react-aria-components';
import { downloadDirLabel } from '../../model/link-import.ts';
import { urlValid } from '../../model/new-flow.ts';
import { entryPath } from '../../model/space.ts';
import { targetOptions } from '../../model/tool-catalog.ts';
import { saveTarget } from '../../model/tool-frame.ts';
import { linkParams, toolRequest, transcribeFileParams, transcribeParams, type AsrChoice, type RunMeta } from '../../model/tool-runs.ts';
import { inputKindOf, SPACE_INPUT_COPY } from '../../model/tool-space-input.ts';
import {
  DEFAULT_DESTINATION,
  DUPLICATE_TITLE,
  duplicateNote,
  newVideoName,
  pick,
  replaceImpact,
  retargetOptions,
  retryParamsOf,
  type PickerRow,
  type RetargetOption,
} from '../../model/tool-targets.ts';
import { agoLabel } from '../../model/format.ts';
import { jobErrorText } from '../../model/localized-text.ts';
import { findOption, modelKeyOf } from '../../model/tools-models.ts';
import { baseName, isTranscribable, mediaFormats, transcribeOptions, type TranscribeMode } from '../../model/tools-transcribe.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useTools } from '../../state/tools-store.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useDirectory } from '../../state/directory-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { changeDownloadDir, useDownloaderTool } from '../start/downloader-card.tsx';
import { LinkSource } from '../start/flow-media.tsx';
import { SaveDirRow } from './tool-frame.tsx';
import { GrantCard, ProjectPicker, ToolFrame, ToolSourceSwitch } from './tool-run-view.tsx';
import { detail, Section, submitOnModEnter } from './tool-parts.tsx';
import { SpacePicker, useCandidates, useSpaceRows } from './tool-video-picker.tsx';
import { FORM_COPY, GRANT_COPY, RETRANSCRIBE_COPY, TRANSCRIBE_COPY, TRANSCRIBE_TOOL_COPY } from './tools-copy.ts';
import { AsrFields, useAsrPick } from './transcribe-asr.tsx';
import { blockOf, useToolStatus } from './use-tool-status.ts';
import { defaultProject, useToolStart, useVideoTools, type TranscribeDraft } from './use-video-tools.ts';
import { DuplicateAlert, firstWhy, lede, SubmitBar, usePreset, useRefreshWhenReady } from './video-tool-parts.tsx';

/*
 * Tools › Transcribe (design mockup tool-transcribe.jsx `TranscribeToolPage`, tools.css `.tool-transcribe__input`; product design §2.7 table 2, “Transcribe”):
 * start from a local file, a Space item (a media entry or an editable video), or a link. For files, media entries and links, no video is created by default: the transcript (TXT) and subtitles (SRT) are saved to the save location (files only, `transcribe`, `TranscribeFileParams`). If “create a new video and put it in the project” is chosen instead, a new video is created (the source stays where it is and is only linked), with the transcript and an editable subtitle layer. Choosing an editable video writes into it. When the video already has a transcript, a destination is offered (product design §5.11): by default a new video is created, or “replace this video's transcript”: the new transcript replaces the old one; choosing it shows an impact card; if the transcript was edited, the Runtime refuses and the page offers “replace anyway”.
 * “Retry transcription…” (Space, §4.4) brings a failed job: it pre-fills the speech model, language and speaker identification from that job, and explains why it failed last time. The execution method is read from `tools.list`.
 *
 * Link sources are run by the “import from link” flow (`link-import` with `transcribe: true`; its availability is checked there too). That path cannot yet choose the speech model or language, does not create a subtitle layer, and has no save location for this run (it downloads to the save location in settings); the page says so.
 */

const dropZone = style({ width: 'full', minHeight: 200 });
const dropBody = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingY: 24, paddingX: 24, textAlign: 'center' });
const dropIcon = style({ display: 'flex', color: 'gray-700', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
const dropName = style({ font: 'title-sm', color: 'gray-900', overflowWrap: 'anywhere' });
const dropPath = style({ font: 'code-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const dropFormats = style({ font: 'ui-xs', color: 'gray-600' });
const buttons = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 });
const sub = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const impactBox = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
});
const impactHead = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-900' });
const impactRow = style({ display: 'flex', gap: 12, font: 'ui-sm', color: 'gray-800', minWidth: 0 });
const impactKey = style({ flexShrink: 0, width: 64, color: 'gray-600' });
const impactValue = style({ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' });

export function TranscribeTool() {
  const runtime = useRuntime();
  const status = useToolStatus();
  const draft = useVideoTools((s) => s.transcribe);
  const patchVideoTools = useVideoTools((s) => s.patch);
  const patch = (p: Partial<TranscribeDraft>) => patchVideoTools('transcribe', p);
  const lastProject = useVideoTools((s) => s.lastProject);
  const setLastProject = useVideoTools((s) => s.setLastProject);
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const data = useCandidates('transcribe');
  const rows = useSpaceRows('transcribe', data);
  const asr = useAsrPick();
  const link = draft.source === 'link';
  const downloader = useDownloaderTool(link);
  const downloadSetting = useSetting('downloads.directory');
  const [saveOverride, setSaveOverride] = useState<string | null>(null);

  usePreset('transcribe', (entryId, preset) => {
    const job = preset.retryJobId ? useJobs.getState().jobs.find((j) => j.jobId === preset.retryJobId) : undefined;
    patch({ source: 'space', entryId, retry: job ? { entryId, jobId: job.jobId } : null });
    if (job) prefillAsr(job);
  });

  useRefreshWhenReady(downloader.ready);

  const projectId = draft.projectId && projects.some((p) => p.id === draft.projectId) ? draft.projectId : defaultProject(projects, lastProject);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const entryId = draft.source === 'space' ? pick(rows, draft.entryId) : null;
  const row = entryId ? (rows.find((r) => r.entryId === entryId) ?? null) : null;
  const intoVideo = row?.kind === 'video';
  const create = !intoVideo && draft.target === 'create';
  const url = draft.url.trim();
  const urlOk = urlValid(url);
  // “identify speakers” is always set explicitly to true or false (mockup `speakers: sp.on`), so the Runtime does not guess from the model; it is not accepted when transcribing files only.
  // Destination (§5.11): only offered when the video already has a transcript; if a choice was made on this video, use it, otherwise default to a new video.
  const retarget = intoVideo && row.video ? retargetOptions(row.video) : null;
  const ownDest = retarget && draft.dest?.entryId === row?.entryId ? draft.dest : null;
  const destination = retarget ? (ownDest?.destination ?? DEFAULT_DESTINATION) : null;
  const defaultName = row ? newVideoName(row.name) : '';
  const newName = ownDest ? ownDest.name : defaultName;
  const setDest = (next: Partial<{ destination: RetargetOption['key']; name: string }>) =>
    row && patch({ dest: { entryId: row.entryId, destination: destination ?? DEFAULT_DESTINATION, name: newName, ...next } });
  const retryJobId = draft.retry && draft.retry.entryId === entryId ? draft.retry.jobId : null;
  const retryJob = useJobs((s) => (retryJobId ? s.jobs.find((j) => j.jobId === retryJobId) : undefined));
  const choice: AsrChoice = asr.option?.usable
    ? { provider: asr.option.providerId, model: asr.option.modelId, language: asr.language, diarize: asr.speakers.s.on }
    : {};
  const spaceMedia = row && !intoVideo && row.entry ? entryPath(row.entry, { projects, conversations }) : null;

  // The availability and execution method for link sources come from Import from link; Space entries depend on whether the entry is a video or a file.
  const via = link ? 'link-import' : 'transcribe';
  const input = link ? 'link' : row ? inputKindOf('transcribe', row.kind) : 'file';
  const block = blockOf(status, via, input, link ? ['transcribe'] : []);
  const outDir = saveTarget(status.saveDirectory, saveOverride);
  let params: Record<string, unknown> | null = null;
  if (draft.source === 'file' && draft.path) {
    if (!create) params = transcribeFileParams(draft.path, choice, outDir);
    else if (projectId) params = transcribeParams({ create: { projectId, media: draft.path } }, choice);
  } else if (draft.source === 'space' && row) {
    if (intoVideo)
      params = transcribeParams(
        { entryId: row.entryId },
        choice,
        null,
        destination ? { destination, name: newName.trim() || defaultName } : null,
      );
    else if (!create) params = transcribeFileParams({ entryId: row.entryId }, choice, outDir);
    else if (projectId && spaceMedia) params = transcribeParams({ create: { projectId, media: spaceMedia } }, choice);
  } else if (link && urlOk) {
    if (!create) params = { url, transcribe: true };
    else if (projectId) params = linkParams({ url, target: 'create', projectId, transcribe: true });
  }
  const request = params ? toolRequest(status.byId.get(via), input, params) : null;
  const key = request ? JSON.stringify(request) : '';
  const starter = useToolStart('transcribe', key);
  const writesVideo = intoVideo || create;

  const asrWhy = !asr.view
    ? FORM_COPY.loading
    : !asr.option
      ? asr.mode === 'cloud'
        ? TRANSCRIBE_TOOL_COPY.noCloud
        : TRANSCRIBE_TOOL_COPY.noLocal
      : !asr.option.usable
        ? TRANSCRIBE_TOOL_COPY.modelNotReady
        : writesVideo && asr.speakers.s.missing
          ? TRANSCRIBE_TOOL_COPY.needSpeakers
          : null;
  // When the download tool is not ready, the Runtime's reason is written for the command line (externalTools.consent…); on this page it is the download-tool card, so point to that first.
  const needTool = downloader.updating ? FORM_COPY.toolUpdating : FORM_COPY.needTool;
  const why = firstWhy(
    link && block && !downloader.ready ? needTool : block,
    draft.source === 'file' && !draft.path && FORM_COPY.needFile,
    link && !urlOk && FORM_COPY.needUrl,
    draft.source === 'space' && !row && FORM_COPY.needEntry,
    create && !projectId && FORM_COPY.needProject,
    create && draft.source === 'space' && row && !intoVideo && !spaceMedia && SPACE_INPUT_COPY.noPath,
    link && !downloader.ready && needTool,
    !link && asrWhy,
    !!starter.asking && FORM_COPY.needGrant,
    !request && FORM_COPY.loading,
  );

  const start = () => {
    if (why || !request) return;
    const what = draft.source === 'file' ? baseName(draft.path ?? '') : link ? url.replace(/^https?:\/\//, '') : (row?.name ?? '');
    const meta: RunMeta = {
      tool: 'transcribe',
      input,
      title: `${TRANSCRIBE_COPY.title} · ${what}`,
      videoName: intoVideo ? (row?.name ?? null) : null,
      projectName: create ? (project?.name ?? null) : null,
      target: intoVideo ? 'video' : create ? 'create' : 'none',
      ...(link ? { transcribe: true } : {}),
    };
    if (create && projectId) setLastProject(projectId);
    starter.start(request, meta, key);
  };

  const dup = row?.video ? duplicateNote('transcribe', row.video) : null;
  const projectName = row?.video?.projectId ? (projects.find((p) => p.id === row.video?.projectId)?.name ?? null) : null;
  const label = link ? TRANSCRIBE_TOOL_COPY.submitLink : TRANSCRIBE_TOOL_COPY.submit;

  return (
    <ToolFrame
      tool="transcribe"
      title={TRANSCRIBE_COPY.title}
      bar={<SubmitBar why={why} label={label} busy={starter.busy} onPress={start} yields={!!starter.asking} />}
      onKeyDown={submitOnModEnter(start)}>
      <p className={lede}>{TRANSCRIBE_TOOL_COPY.lede}</p>
      <ToolSourceSwitch tool="transcribe" value={draft.source} onChange={(source) => patch({ source })} />
      {retryJob ? <RetryAlert job={retryJob} /> : null}
      {draft.source === 'file' ? <FileDrop path={draft.path} onPath={(path) => patch({ path })} /> : null}
      {link ? (
        <Section>
          <LinkSource
            url={draft.url}
            onUrl={(next) => patch({ url: next })}
            downloader={downloader}
            downloadDir={downloadDirLabel(downloadSetting ?? null, project?.path ?? null)}
            onChangeDir={() => void changeDownloadDir(runtime)}
            note={TRANSCRIBE_TOOL_COPY.linkNote}
          />
        </Section>
      ) : null}
      {draft.source === 'space' ? <SpacePicker tool="transcribe" data={data} value={entryId} onChange={(id) => patch({ entryId: id })} /> : null}
      {dup ? <DuplicateAlert title={DUPLICATE_TITLE.transcribe} body={dup} /> : null}
      {link ? (
        <Section title={TRANSCRIBE_TOOL_COPY.asrTitle}>
          <span className={detail}>{TRANSCRIBE_TOOL_COPY.linkAsr}</span>
        </Section>
      ) : (
        <AsrFields pick={asr} speakers={writesVideo} />
      )}
      {starter.edited ? (
        <InlineAlert variant="notice">
          <Heading>{RETRANSCRIBE_COPY.editedTitle}</Heading>
          <Content>
            <div className={sub}>
              <span>{RETRANSCRIBE_COPY.editedBody}</span>
              <div>
                <Button variant="secondary" isPending={starter.busy} onPress={starter.acceptEdited}>
                  {RETRANSCRIBE_COPY.editedAccept}
                </Button>
              </div>
            </div>
          </Content>
        </InlineAlert>
      ) : null}
      {retarget && destination && row?.video ? (
        <Section title={RETRANSCRIBE_COPY.destTitle}>
          <RadioGroup
            aria-label={RETRANSCRIBE_COPY.destLabel}
            value={destination}
            onChange={(value) => setDest({ destination: value as RetargetOption['key'] })}>
            {retarget.map((o) => (
              <Radio key={o.key} value={o.key}>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
          {destination === 'new-video' ? (
            <div className={sub}>
              <TextField label={RETRANSCRIBE_COPY.nameLabel} value={newName} onChange={(name) => setDest({ name })} />
              <span className={detail}>{RETRANSCRIBE_COPY.newVideoNote(projectName, row.name)}</span>
            </div>
          ) : (
            <ReplaceImpactCard video={row.video} />
          )}
        </Section>
      ) : null}
      {intoVideo ? null : (
        <Section title={TRANSCRIBE_TOOL_COPY.targetTitle}>
          <RadioGroup aria-label={TRANSCRIBE_TOOL_COPY.targetTitle} value={draft.target} onChange={(target) => patch({ target: target as TranscribeDraft['target'] })}>
            {targetOptions('transcribe').map((o) => (
              <Radio key={o.key} value={o.key}>
                {o.label}
              </Radio>
            ))}
          </RadioGroup>
          {create ? <ProjectPicker value={projectId} onChange={(id) => patch({ projectId: id })} /> : null}
          <span className={detail}>{!create ? TRANSCRIBE_TOOL_COPY.targetNone : link ? TRANSCRIBE_TOOL_COPY.createLink : TRANSCRIBE_TOOL_COPY.createFile}</span>
        </Section>
      )}
      {!writesVideo && !link ? <SaveDirRow saveDirectory={status.saveDirectory} override={saveOverride} onChange={setSaveOverride} /> : null}
      {starter.asking ? (
        <GrantCard
          items={starter.asking}
          onAgree={starter.agree}
          busy={starter.busy}
          hint={asr.mode === 'cloud' || link ? GRANT_COPY.hintLocal : GRANT_COPY.hintCloud}
        />
      ) : null}
    </ToolFrame>
  );
}

// ---- Re-transcribe ----

/** The impact card shown when “replace” is chosen (design mockup `ReplaceImpact`): one line per translation, one sentence for the rule, one line of dubbing per language; can be undone. */
function ReplaceImpactCard({ video }: { video: Pick<PickerRow, 'documents'> }) {
  const im = replaceImpact(video);
  const row = (key: string, label: string, text: string) => (
    <div key={key} className={impactRow}>
      <span className={impactKey}>{label}</span>
      <span className={impactValue}>{text}</span>
    </div>
  );
  return (
    <div className={impactBox}>
      <span className={impactHead}>{RETRANSCRIBE_COPY.impactTitle}</span>
      {im.translations.length
        ? im.translations.map((t, i) => row(`tr-${i}`, RETRANSCRIBE_COPY.impactTranslations, t))
        : row('tr', RETRANSCRIBE_COPY.impactTranslations, RETRANSCRIBE_COPY.impactNone)}
      {im.rule ? <span className={detail}>{im.rule}</span> : null}
      {im.dubs.map((d, i) => row(`dub-${i}`, RETRANSCRIBE_COPY.impactDubs, d))}
      <span className={detail}>{im.undo}</span>
    </div>
  );
}

/** The failure from “retry transcription…” (design mockup `RetryAlert`): the reason, the previous model, and how long ago it happened. */
function RetryAlert({ job }: { job: JobRecord }) {
  const p = retryParamsOf(job);
  const view = useModels((s) => s.capabilities);
  const key = p.provider && p.model ? modelKeyOf(p.provider, p.model) : null;
  const option =
    view && key ? (findOption(transcribeOptions(view, 'local'), key) ?? findOption(transcribeOptions(view, 'cloud'), key)) : null;
  const model = option?.label ?? p.model;
  return (
    <InlineAlert variant="negative">
      <Heading>{RETRANSCRIBE_COPY.retryTitle}</Heading>
      <Content>{RETRANSCRIBE_COPY.retryBody(jobErrorText(job.error), model, agoLabel(job.updatedAt))}</Content>
    </InlineAlert>
  );
}

/** Fills in the speech model, language and speaker identification from the failed run (the page's speech model is stored in tools-store). If the model is in neither list, it is left unchanged. */
function prefillAsr(job: JobRecord): void {
  const p = retryParamsOf(job);
  const view = useModels.getState().capabilities;
  const patch: Parameters<ReturnType<typeof useTools.getState>['patchTranscribe']>[0] = { language: p.language ?? '' };
  if (p.provider && p.model) {
    const key = modelKeyOf(p.provider, p.model);
    const mode: TranscribeMode | null = !view
      ? null
      : transcribeOptions(view, 'local').some((o) => o.key === key)
        ? 'local'
        : transcribeOptions(view, 'cloud').some((o) => o.key === key)
          ? 'cloud'
          : null;
    if (mode) Object.assign(patch, { mode, model: key });
  }
  if (p.diarize !== null) patch.speakers = p.diarize;
  useTools.getState().patchTranscribe(patch);
}

// ---- Local file ----

/** Drag in or choose one audio or video file (design mockup `.tool-transcribe__input`). */
function FileDrop({ path, onPath }: { path: string | null; onPath: (path: string | null) => void }) {
  const runtime = useRuntime();
  const take = (next: string) => {
    if (!isTranscribable(baseName(next))) {
      ToastQueue.neutral(TRANSCRIBE_COPY.notMedia, { timeout: 4000 });
      return;
    }
    onPath(next);
  };
  const choose = () => {
    void runtime.host.pickMediaFiles().then((paths) => {
      if (paths[0]) take(paths[0]);
    });
  };
  const drop = async (items: readonly DropItem[]) => {
    const item = items.find((i) => i.kind === 'file');
    if (!item || item.kind !== 'file') return;
    const file = await item.getFile();
    if (!isTranscribable(file.name)) {
      ToastQueue.neutral(TRANSCRIBE_COPY.notMedia, { timeout: 4000 });
      return;
    }
    const local = runtime.host.pathForFile(file);
    if (!local) {
      ToastQueue.negative(TRANSCRIBE_COPY.noPath, { timeout: 6000 });
      return;
    }
    onPath(local);
  };
  return (
    <DropZone styles={dropZone} isFilled={!!path} replaceMessage={TRANSCRIBE_COPY.change} onDrop={(e) => void drop(e.items)}>
      <div className={dropBody}>
        <span className={dropIcon} aria-hidden>
          <Upload />
        </span>
        <span className={dropName}>{path ? baseName(path) : TRANSCRIBE_COPY.drop}</span>
        {path ? <span className={dropPath}>{path}</span> : null}
        <span className={dropFormats}>{mediaFormats()}</span>
        <div className={buttons}>
          <Button variant="secondary" onPress={choose}>
            {path ? TRANSCRIBE_COPY.change : TRANSCRIBE_COPY.pick}
          </Button>
          {path ? (
            <Button variant="secondary" fillStyle="outline" onPress={() => onPath(null)}>
              {TRANSCRIBE_COPY.clearFile}
            </Button>
          ) : null}
        </div>
      </div>
    </DropZone>
  );
}

