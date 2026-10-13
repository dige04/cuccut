import path from 'node:path';
import type { ExportSettings, GeneratedOutput, Id, SpaceEntry, SpaceEntryKind, SpaceEntryOrigin, SpaceEntryStatus } from '@cuccut/protocol';
import { isFilePipelineJob, type SpaceImport, type SpaceJobFacts, type SpaceMark, type TrashedVideo } from '@cuccut/runtime-storage';
import type { VideoFacts } from './content-extract.ts';
import { RcSpace } from '@cuccut/protocol/messages/runtime-core';

/**
 * Derivation of the Space catalog (architecture design §5.7). From the scan of the source directories, the registrations of `space.import`, and the video facts in the Job Ledger and the content index, it computes all entries. A pure function: the same inputs give the same result, so deleting the directory and rebuilding gives the same result as incremental updates (`user.*` lives in the Runtime Store).
 *
 * - Scanned files and video directories are base entries. A video directory that has a record in the content index carries `ref.videoId`, along with the root sequence's duration and canvas size (`media`).
 * - An export published to a file in a source directory is merged with that scanned file into one entry: it carries the export's source and `published` / `source-changed`.
 *   Files published in a no-project session's work directory before it was moved into a project (`DeriveSource.formerRoots`) are recognized by their position after the move into the project.
 *   Exports made for the agent's internal checks (`purpose: 'preview'`) do not become entries; published files of them are not listed even if they are scanned.
 *   Exports published outside the source directory form their own entries, with `id` as the artifactId. Files published by file-to-file workflows (file transcoding, subtitle file translation, §7.9) are handled the same way: their source is `generated`, `capability` is the workflow name, and the executor is attached. Files handed over by the agent with `downloads_save` (§3.5) are handled the same way, with `capability` `downloads-save` and no provider.
 * - Generated images, audio and text are artifact entries (`id` is the artifactId). If imported into a video they are `candidate`; if the timeline uses them they are `applied`.
 * - Queued and running generations and exports are `generating` placeholders. Failed ones are `failed` placeholders, which disappear when the user clears them or when the same input later succeeds.
 * - The raw transcription result and the frozen snapshots of exports are not deliverable artifacts and do not enter the catalog. Proxies, thumbnails and waveforms were never in the Artifact Store to begin with.
 * - A deleted video (`videos.delete`) is a video entry in the trash. Its `id` is determined by the source and its position in the trash, not by the video directory (`videoDir` is empty).
 * - The task inputs are the union of the Job Ledger and Space's own artifact records (`SpaceJobFacts`); where the Ledger has an entry, the Ledger wins.
 */

export interface DeriveSource {
  key: string;
  root: string;
  /** Real path of the source directory (the publish path recorded by an export is a real path). Same as `root` until it is resolved. */
  realRoot: string;
  projectId: Id | null;
  conversationId: Id | null;
  /**
   * Project source: the original work directory of a no-project session that was moved into this project (architecture design §3.10). Exports published there before binding recorded the old path. The files were moved into the project as-is by relative path, so this maps them back to the file in the project.
   */
  formerRoots?: readonly string[];
}

export interface ScannedFile {
  relPath: string;
  kind: SpaceEntryKind;
  size: number;
  mtimeMs: number;
  birthtimeMs?: number;
  /** Deck entry (deck directory): the title and slide count from deck.json. */
  deck?: { title: string; slideCount: number };
  /** Design entry (design directory): the title and artboard count from canvas.json. */
  canvas?: { title: string; boardCount: number };
  /** Design system entry (design system directory): the title from design-system.json (the directory name if absent). */
  designSystem?: { title: string };
}

export interface ScannedItem {
  sourceKey: string;
  file: ScannedFile;
}

/** One video in the content index. */
export interface KnownVideo {
  videoId: Id;
  name: string;
  revision: string;
  facts: VideoFacts;
}

export interface FileStat {
  path: string;
  size: number;
  mtimeMs: number;
  birthtimeMs?: number;
}

/** Where the entry's bytes are (used by the media channel and physical deletion). */
export type EntryLocation =
  | { kind: 'source'; sourceKey: string; relPath: string }
  | { kind: 'artifact'; artifactId: string; path: string }
  | { kind: 'file'; path: string }
  /** Deleted video: the video directory under `.ccut-trash/` in the source directory. */
  | { kind: 'trash'; sourceKey: string; relPath: string }
  | { kind: 'none' };

export interface DerivedEntry {
  entry: SpaceEntry;
  location: EntryLocation;
  /** Video entry: absolute path of the video directory. */
  videoDir?: string;
}

export interface DeriveInput {
  sources: ReadonlyMap<string, DeriveSource>;
  files: ReadonlyMap<Id, ScannedItem>;
  mark: (id: Id) => SpaceMark;
  imports: ReadonlyMap<Id, SpaceImport>;
  /** Deleted video, keyed by its entry id in the trash. */
  trashedVideos: ReadonlyMap<Id, TrashedVideo>;
  jobs: readonly SpaceJobFacts[];
  /** Record in the content index for the video directory (absolute path). */
  videoAt: (dir: string) => KnownVideo | null;
  projectOfConversation: (conversationId: Id) => Id | null;
  /** Artifact file: `undefined` means not yet checked (treated as existing); `null` means it is gone. */
  artifactFile: (artifactId: string) => FileStat | null | undefined;
  /** Publish path outside the source directory, same as above. */
  pathStat: (file: string) => FileStat | null | undefined;
  entryIdOf: (sourceKey: string, relPath: string) => Id;
  classify: (fileName: string) => SpaceEntryKind | null;
}

/** Name of an artifact entry, given by capability (derived in the current language, not written to disk). `null` for job kinds that produce no entry. */
function labelOf(kind: string): string | null {
  switch (kind) {
    case 'synthesizeSpeech':
      return RcSpace.labelSynthesizeSpeech().text;
    case 'generateImage':
      return RcSpace.labelGenerateImage().text;
    case 'generateMusic':
      return RcSpace.labelGenerateMusic().text;
    case 'generateText':
      return RcSpace.labelGenerateText().text;
    case 'export':
      return RcSpace.labelExport().text;
    default:
      return null;
  }
}

export function deriveEntries(input: DeriveInput): Map<Id, DerivedEntry> {
  const out = new Map<Id, DerivedEntry>();
  const videos = new Map<Id, { entryId: Id; source: DeriveSource; known: KnownVideo }>();
  // An export published as a file in the source directory for internal checks: wait until all jobs have finished, then remove those not claimed by a delivered export.
  const previews = new Set<Id>();

  // 1. Scanned files and video directories.
  for (const [id, item] of input.files) {
    const source = input.sources.get(item.sourceKey);
    if (!source) continue;
    const fileName = item.file.relPath.slice(item.file.relPath.lastIndexOf('/') + 1);
    const entry: SpaceEntry = {
      id,
      kind: item.file.kind,
      name: fileName,
      fileName,
      source: { projectId: source.projectId, conversationId: source.conversationId },
      relPath: item.file.relPath,
      size: item.file.size,
      lastActivityAt: new Date(item.file.mtimeMs).toISOString(),
      createdAt: birthTime(item.file),
      updatedAt: new Date(item.file.mtimeMs).toISOString(),
      status: null,
      user: { favorite: false, displayName: null, trashedAt: null },
    };
    const derived: DerivedEntry = { entry, location: { kind: 'source', sourceKey: item.sourceKey, relPath: item.file.relPath } };
    if (item.file.deck) {
      if (item.file.deck.title) entry.name = item.file.deck.title;
      entry.deck = { slideCount: item.file.deck.slideCount };
    }
    if (item.file.canvas) {
      if (item.file.canvas.title) entry.name = item.file.canvas.title;
      entry.canvas = { boardCount: item.file.canvas.boardCount };
    }
    if (item.file.designSystem?.title) entry.name = item.file.designSystem.title;
    if (item.file.kind === 'video') {
      const dir = path.join(source.root, ...item.file.relPath.split('/'));
      derived.videoDir = dir;
      const known = input.videoAt(dir);
      if (known) {
        if (known.name.trim()) entry.name = known.name;
        entry.ref = { videoId: known.videoId };
        // The "duration or size" column: the working-draft root sequence's duration and canvas size (once the index is read; absent when the snapshot is incomplete).
        const timeline = known.facts.timeline;
        if (timeline) entry.media = { durationSec: timeline.durationSec, width: timeline.width, height: timeline.height };
        // Derived sub-videos (`videos.derive`): the source is the parent video, with its version at derivation time and the range taken.
        const derivedFrom = known.facts.origin;
        if (derivedFrom) {
          entry.origin = {
            source: 'derived',
            projectId: source.projectId,
            videoId: derivedFrom.parentVideoId,
            videoRevision: derivedFrom.parentRevision,
            range: { start: derivedFrom.range.start, end: derivedFrom.range.end },
            capability: 'videos-derive',
          };
        }
        if (!videos.has(known.videoId)) videos.set(known.videoId, { entryId: id, source, known });
      }
    }
    out.set(id, derived);
  }

  // 2. Project files registered by `space.import`.
  for (const [id, record] of input.imports) {
    const existing = out.get(id);
    const origin: SpaceEntryOrigin = { source: 'imported', projectId: record.projectId };
    if (existing) {
      existing.entry.origin = origin;
      continue;
    }
    const fileName = record.relPath.slice(record.relPath.lastIndexOf('/') + 1);
    out.set(id, {
      entry: {
        id,
        kind: input.classify(fileName) ?? 'document',
        name: fileName,
        fileName,
        source: { projectId: record.projectId, conversationId: null },
        relPath: record.relPath,
        size: 0,
        lastActivityAt: record.importedAt,
        createdAt: record.importedAt,
        updatedAt: null,
        status: 'missing',
        statusDetail: { reason: RcSpace.importedFileGone().text },
        user: { favorite: false, displayName: null, trashedAt: null },
        origin,
      },
      location: { kind: 'none' },
    });
  }

  // 3. Job Ledger: older first, newer later. For the same artifact, the later job wins.
  const jobs = [...input.jobs].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const succeededLater = new Map<string, string>();
  for (const job of jobs) {
    if (job.state === 'completed') succeededLater.set(`${job.kind}\0${job.inputHash}`, job.createdAt);
  }
  for (const job of jobs) {
    // A video created by a workflow (§7.9): the video entry's source is this run.
    if (job.kind === 'pipeline') {
      const created = createdVideoOf(job);
      const video = created ? videos.get(created) : undefined;
      const derived = video ? out.get(video.entryId) : undefined;
      if (video && derived && !derived.entry.origin) {
        const submitter = job.submitter;
        derived.entry.origin = {
          source: 'imported',
          projectId: video.source.projectId,
          videoId: created!,
          ...(submitter.kind === 'agent' ? { conversationId: submitter.id, taskId: submitter.taskId } : {}),
          jobId: job.jobId,
          capability: job.pipeline!.name,
        };
      }
      // File-to-file workflow: the file published on completion is merged with the scanned file, or forms its own entry, like exports.
      if (isFilePipelineJob(job) && job.state === 'completed' && job.result) {
        const origin: SpaceEntryOrigin = { ...originOf(job, null, input), capability: job.pipeline!.name };
        // Files handed over by `downloads_save` (§3.5): copied by the agent itself, with no provider or model.
        if (job.pipeline!.name === 'downloads-save') delete origin.provider;
        for (const output of job.result.outputs ?? []) {
          const download = job.pipeline?.name === 'link-import';
          const projectId = job.pipeline?.params?.projectId;
          const assigned = download ? { ...origin, source: 'imported' as const, projectId: output.media.kind === 'text' && typeof projectId === 'string' ? projectId : null } : origin;
          addExport(out, input, job, output, assigned, null);
        }
      }
      continue;
    }
    if (job.kind === 'transcribe' || labelOf(job.kind) === null) continue;
    // Exports for internal checks: queued, failed and completed ones do not become entries.
    if (job.kind === 'export' && job.export?.settings.purpose === 'preview') {
      for (const output of job.result?.outputs ?? []) hidePreview(previews, input, output);
      continue;
    }
    const video = job.videoId ? (videos.get(job.videoId) ?? null) : null;
    const origin = originOf(job, video?.source.projectId ?? null, input);
    if (job.state === 'queued' || job.state === 'running') {
      out.set(job.jobId, placeholder(job, 'generating', origin));
      continue;
    }
    if (job.state === 'failed' || job.state === 'interrupted' || job.state === 'needs-reconciliation') {
      const retried = succeededLater.get(`${job.kind}\0${job.inputHash}`);
      if (!input.mark(job.jobId).dismissedAt && !(retried !== undefined && retried > job.createdAt)) {
        out.set(job.jobId, placeholder(job, 'failed', origin));
      }
    }
    // The artifact has been published but the app did not commit it (target gone, rejected, or no automatic apply after stop, §7.3): the artifact is still listed, as a candidate.
    const latest = job.applications?.at(-1);
    const unapplied = latest !== undefined && latest.state !== 'committed' && (job.state === 'failed' || job.state === 'cancelled');
    if (job.state !== 'completed' && !(job.kind === 'export' && job.result) && !unapplied) continue;
    if (!job.result) continue;
    if (job.kind === 'export') {
      for (const output of job.result.outputs ?? []) addExport(out, input, job, output, origin, video?.known ?? null);
    } else if (job.kind === 'generateText') {
      const text = job.result.text;
      const file = input.artifactFile(job.result.artifactId);
      const ext = text?.mediaType === 'application/json' ? 'json' : 'txt';
      const derived = artifactEntry(job, job.result.artifactId, 'document', `${fileNameOf(job, ext, null)}`, file, text?.byteLength ?? 0, origin, {
        mediaType: text?.mediaType ?? 'text/plain',
      });
      savedCopy(derived, input, job.result.outputs?.[0]?.path);
      out.set(job.result.artifactId, derived);
    } else {
      const outputs = job.result.outputs ?? [];
      outputs.forEach((output, index) => {
        const kind: SpaceEntryKind = job.kind === 'generateImage' ? 'image' : 'audio';
        const file = input.artifactFile(output.artifactId);
        const derived = artifactEntry(
          job,
          output.artifactId,
          kind,
          fileNameOf(job, extensionOf(output, file), outputs.length > 1 ? index + 1 : null),
          file,
          output.byteLength,
          origin,
          mediaOf(output),
        );
        if (derived.entry.status === null && output.assetId) {
          derived.entry.status = video?.known.facts.timelineAssetIds.includes(output.assetId) ? 'applied' : 'candidate';
        } else if (derived.entry.status === null && unapplied) {
          derived.entry.status = 'candidate';
          derived.entry.statusDetail = { reason: latest.error?.message ?? RcSpace.resultNotApplied().text, code: latest.state };
        }
        savedCopy(derived, input, output.path);
        out.set(output.artifactId, derived);
      });
    }
  }

  // Files published by an internal-check export: not listed unless a delivered export claims them (the same path was delivered later) or they are in a video directory.
  for (const id of previews) if (!out.get(id)?.entry.ref) out.delete(id);

  // 4. Deleted videos: in the trash until restored or physically deleted. When the source is gone (project removed) there is no location, so they can only be viewed, not restored.
  for (const [id, record] of input.trashedVideos) {
    const fileName = record.relPath.slice(record.relPath.lastIndexOf('/') + 1);
    out.set(id, {
      entry: {
        id,
        kind: 'video',
        name: record.name,
        fileName,
        source: { projectId: record.projectId, conversationId: record.conversationId },
        relPath: record.relPath,
        size: record.size,
        lastActivityAt: record.trashedAt,
        createdAt: null,
        updatedAt: null,
        status: null,
        user: { favorite: false, displayName: null, trashedAt: null },
        ...(record.videoId ? { ref: { videoId: record.videoId } } : {}),
      },
      location: input.sources.has(record.sourceKey)
        ? { kind: 'trash', sourceKey: record.sourceKey, relPath: record.trashRelPath }
        : { kind: 'none' },
    });
  }

  // 5. User markers. Purged artifacts, exports and placeholders (`space.purge`) no longer appear. Scanned files only check whether the file exists.
  for (const [id, { entry, location }] of out) {
    const mark = input.mark(entry.id);
    if (mark.dismissedAt && location.kind !== 'source') {
      out.delete(id);
      continue;
    }
    entry.user = { favorite: mark.favorite, displayName: mark.displayName, trashedAt: mark.trashedAt };
    if (mark.displayName) entry.name = mark.displayName;
  }
  return out;
}

/** The video created by a completed `create` step of a workflow; null if none. */
function createdVideoOf(job: SpaceJobFacts): Id | null {
  const step = job.pipeline?.steps?.find((s) => s.name === 'create' && s.status === 'completed');
  const videoId = step?.output?.videoId;
  return typeof videoId === 'string' ? videoId : null;
}

function originOf(job: SpaceJobFacts, videoProject: Id | null, input: DeriveInput): SpaceEntryOrigin {
  const submitter = job.submitter;
  const conversation = submitter.kind === 'agent' ? { conversationId: submitter.id, taskId: submitter.taskId } : {};
  const projectId = videoProject ?? (submitter.kind === 'agent' ? input.projectOfConversation(submitter.id) : null);
  return {
    source: job.kind === 'export' ? 'exported' : 'generated',
    projectId,
    ...(job.videoId ? { videoId: job.videoId } : {}),
    ...(job.export ? { videoRevision: job.export.videoRevision } : {}),
    ...conversation,
    jobId: job.jobId,
    capability: job.kind,
    ...(job.kind !== 'export' ? { provider: { providerId: job.providerId, modelId: job.modelId } } : {}),
  };
}

function placeholder(job: SpaceJobFacts, status: 'generating' | 'failed', origin: SpaceEntryOrigin): DerivedEntry {
  const name = job.kind === 'export' ? (job.export?.destination.files[0] ?? RcSpace.labelExport().text) : labelOf(job.kind)!;
  return {
    entry: {
      id: job.jobId,
      kind: kindOfJob(job),
      name,
      fileName: name,
      source: { projectId: null, conversationId: null },
      relPath: name,
      size: 0,
      lastActivityAt: job.updatedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      status,
      statusDetail:
        status === 'failed'
          ? { reason: job.error?.message ?? RcSpace.taskNotFinished().text, ...(job.error?.code ? { code: job.error.code } : {}) }
          : job.progress
            ? { progress: { done: job.progress.done, total: job.progress.total } }
            : {},
      user: { favorite: false, displayName: null, trashedAt: null },
      ref: { jobId: job.jobId },
      origin,
    },
    location: { kind: 'none' },
  };
}

/** Copy saved to the save location by a direct task (§7.9): recorded in the entry's `file` while it still exists. */
function savedCopy(derived: DerivedEntry, input: DeriveInput, file: string | undefined): void {
  if (file && input.pathStat(file) !== null) derived.entry.file = { path: file };
}

function artifactEntry(
  job: SpaceJobFacts,
  artifactId: string,
  kind: SpaceEntryKind,
  fileName: string,
  file: FileStat | null | undefined,
  byteLength: number,
  origin: SpaceEntryOrigin,
  media: SpaceEntry['media'],
): DerivedEntry {
  return {
    entry: {
      id: artifactId,
      kind,
      name: fileName,
      fileName,
      source: { projectId: null, conversationId: null },
      relPath: fileName,
      size: file?.size ?? byteLength,
      lastActivityAt: job.endedAt ?? job.updatedAt,
      createdAt: job.endedAt ?? job.createdAt,
      updatedAt: file ? new Date(file.mtimeMs).toISOString() : job.endedAt ?? job.updatedAt,
      status: file === null ? 'missing' : null,
      ...(file === null ? { statusDetail: { reason: RcSpace.outputFileGone().text } } : {}),
      user: { favorite: false, displayName: null, trashedAt: null },
      ref: { artifactId },
      origin,
      ...(media ? { media } : {}),
    },
    location: file ? { kind: 'artifact', artifactId, path: file.path } : { kind: 'none' },
  };
}

function addExport(
  out: Map<Id, DerivedEntry>,
  input: DeriveInput,
  job: SpaceJobFacts,
  output: GeneratedOutput,
  origin: SpaceEntryOrigin,
  video: KnownVideo | null,
): void {
  if (!output.path) return;
  const kind = job.export ? exportKind(job.export.settings) : (input.classify(path.basename(output.path)) ?? 'document');
  const frozen = job.export?.videoRevision ?? null;
  const status = (): { status: SpaceEntryStatus; statusDetail?: SpaceEntry['statusDetail'] } =>
    video && frozen !== null && video.revision !== frozen
      ? { status: 'source-changed', statusDetail: { currentRevision: video.revision } }
      : { status: 'published' };
  // Published into a source directory: the same entry as the scanned file.
  for (const source of input.sources.values()) {
    const inside = relativeInside(source, output.path);
    if (inside === null) continue;
    const { rel, former } = inside;
    const id = input.entryIdOf(source.key, rel);
    const scanned = out.get(id);
    if (scanned) {
      Object.assign(scanned.entry, {
        kind,
        ref: { artifactId: output.artifactId },
        origin,
        media: mediaOf(output),
        file: { path: former ? path.join(source.realRoot, ...rel.split('/')) : output.path },
        ...status(),
      });
      return;
    }
    // Not in the scan: deleted, or in a directory the scan does not reach.
    const stat = input.pathStat(output.path);
    if (stat === null) {
      out.set(
        output.artifactId,
        exportEntry(job, output, kind, origin, null, { status: 'missing', statusDetail: { reason: RcSpace.exportedFileGone().text } }),
      );
      return;
    }
    break;
  }
  const stat = input.pathStat(output.path);
  out.set(
    output.artifactId,
    exportEntry(
      job,
      output,
      kind,
      origin,
      stat ?? null,
      stat === null ? { status: 'missing', statusDetail: { reason: RcSpace.exportedFileGone().text } } : status(),
    ),
  );
}

function exportEntry(
  job: SpaceJobFacts,
  output: GeneratedOutput,
  kind: SpaceEntryKind,
  origin: SpaceEntryOrigin,
  stat: FileStat | null,
  state: { status: SpaceEntryStatus; statusDetail?: SpaceEntry['statusDetail'] },
): DerivedEntry {
  const fileName = path.basename(output.path!);
  return {
    entry: {
      id: output.artifactId,
      kind,
      name: fileName,
      fileName,
      source: { projectId: null, conversationId: null },
      relPath: fileName,
      size: stat?.size ?? output.byteLength,
      lastActivityAt: job.endedAt ?? job.updatedAt,
      createdAt: birthTime(stat) ?? job.endedAt ?? job.createdAt,
      updatedAt: stat ? new Date(stat.mtimeMs).toISOString() : job.endedAt ?? job.updatedAt,
      ...state,
      user: { favorite: false, displayName: null, trashedAt: null },
      ref: { artifactId: output.artifactId },
      origin,
      media: mediaOf(output),
      ...(stat ? { file: { path: output.path! } } : {}),
    },
    location: stat ? { kind: 'file', path: output.path! } : { kind: 'none' },
  };
}

/** When the file is in the source directory, its path relative to it (`/` separated). `former`: recognized via the old work directory from before it was moved into the project. */
function relativeInside(source: DeriveSource, file: string): { rel: string; former: boolean } | null {
  const current = new Set([source.realRoot, source.root]);
  for (const root of [...current, ...(source.formerRoots ?? [])]) {
    const rel = path.relative(root, file);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return { rel: rel.split(path.sep).join('/'), former: !current.has(root) };
  }
  return null;
}

/** Internal-check export (`purpose: 'preview'`, architecture design §9.13): no entry. Files it published in the source directory are recorded but not listed as ordinary files. */
function hidePreview(previews: Set<Id>, input: DeriveInput, output: GeneratedOutput): void {
  if (!output.path) return;
  for (const source of input.sources.values()) {
    const inside = relativeInside(source, output.path);
    if (inside) previews.add(input.entryIdOf(source.key, inside.rel));
  }
}

export function exportKind(settings: ExportSettings): SpaceEntryKind {
  switch (settings.kind) {
    case 'subtitles':
      return 'subtitle';
    case 'transcript':
      return 'document';
    case 'audio':
      return 'audio';
    case 'video':
      return 'export';
    default:
      return 'package';
  }
}

function kindOfJob(job: SpaceJobFacts): SpaceEntryKind {
  switch (job.kind) {
    case 'synthesizeSpeech':
    case 'generateMusic':
      return 'audio';
    case 'generateImage':
      return 'image';
    case 'export':
      return job.export ? exportKind(job.export.settings) : 'document';
    default:
      return 'document';
  }
}

function mediaOf(output: GeneratedOutput): SpaceEntry['media'] {
  const media: NonNullable<SpaceEntry['media']> = { mediaType: output.mediaType };
  if (output.media.kind === 'image') Object.assign(media, { width: output.media.width, height: output.media.height });
  else if (output.media.kind === 'video')
    Object.assign(media, { durationSec: output.media.durationSec, width: output.media.width, height: output.media.height });
  else if ('durationSec' in output.media) media.durationSec = output.media.durationSec;
  return media;
}

function extensionOf(output: GeneratedOutput, file: FileStat | null | undefined): string {
  if (file) return path.extname(file.path).slice(1);
  const sub = output.mediaType.split('/')[1] ?? 'bin';
  return sub === 'mpeg' ? 'mp3' : sub === 'jpeg' ? 'jpg' : sub.replace(/^x-/, '');
}

/** File name of an artifact entry: capability and completion time (not the prompt or source text, since generation parameters live only in the Job record). */
function fileNameOf(job: SpaceJobFacts, ext: string, index: number | null): string {
  const at = (job.endedAt ?? job.createdAt)
    .replace(/\.\d+Z$/, '')
    .replace(/[-:]/g, '')
    .replace('T', '-');
  return `${labelOf(job.kind)}-${at}${index !== null ? `-${index}` : ''}.${ext}`;
}

/** When birthtime is unavailable, do not pass off ctime or mtime as the creation time. */
function birthTime(stat: { birthtimeMs?: number } | null): string | null {
  const at = stat?.birthtimeMs;
  return at !== undefined && Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : null;
}
