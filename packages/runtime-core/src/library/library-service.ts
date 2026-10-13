import path from 'node:path';
import { TopicLog } from '@cuccut/harness';
import { ffprobeMediaProbe, selectionBody, videoSelection, type ProbeToolResolver } from '@cuccut/jobs';
import {
  LIBRARY_SELECTION_KIND,
  MAX_SELECTED_GLOSSARIES,
  RpcError,
  newId,
  type Actor,
  type EditOperation,
  type Id,
  type LibraryApplyParams,
  type LibraryApplyResult,
  type LibraryEntry,
  type LibraryEvent,
  type LibraryPutParams,
  type LibrarySelection,
  type LibrarySetSelectionParams,
  type LibrarySetSelectionResult,
  type LibrarySnapshot,
  type MediaHandle,
  type RpcParams,
  type RpcResult,
  type VideoLibrarySelection,
} from '@cuccut/protocol';
import {
  LibraryStore,
  formatInvalid,
  libraryError,
  parseLibraryVoice,
  readLibraryImport,
  writeLibraryExport,
  type LibraryFileInput,
  type LibraryPutOutcome,
} from '@cuccut/runtime-storage/library';
import type { TrustedPrincipal } from '../gateway.ts';
import type { MediaRegistry } from '../media.ts';
import type { VideoService } from '../videos/video-service.ts';
import type { VoiceCloneService } from './voice-clone-service.ts';
import { RcCommon, RcLibrary } from '@cuccut/protocol/messages/runtime-core';
import { withLocalized } from '../localized.ts';

export interface LibraryServiceOptions {
  dir: string;
  videos: VideoService;
  media: MediaRegistry;
  /** Output library: `library.put` can take an output as a file source. */
  artifacts: { locate(artifactId: string): Promise<string | null> };
  /** Decode validation for reference recordings (uses the same ffprobe as generated output). */
  ffprobe: ProbeToolResolver;
}

/** The same `commandId` returns the same result. The most recent this many are remembered. */
const COMMAND_MEMORY = 500;
/** The actor written when a new video takes an entry that is enabled by default. It does not enter the user's undo stack, since undo is the user's own edit. */
const LIBRARY_ACTOR: Actor = { kind: 'system', id: 'system:library' };
/** Steps, and the glossary kinds they can use. */
const STEP_KIND = { transcribe: 'transcription', translate: 'translation' } as const;

/**
 * The Runtime side of the user library (architecture design §5.9): the `library.*` methods, the `library` topic, and copying entries into a video.
 * Storage, the exchange format and authorization checks live in `@cuccut/runtime-storage/library`.
 */
export class LibraryService {
  readonly store: LibraryStore;
  readonly topic: TopicLog<LibrarySnapshot, LibraryEvent>;
  readonly #options: LibraryServiceOptions;
  readonly #commands = new Map<Id, Promise<unknown>>();
  #clones: VoiceCloneService | null = null;

  private constructor(options: LibraryServiceOptions, store: LibraryStore, topic: TopicLog<LibrarySnapshot, LibraryEvent>) {
    this.#options = options;
    this.store = store;
    this.topic = topic;
  }

  static async open(options: LibraryServiceOptions): Promise<LibraryService> {
    const probe = ffprobeMediaProbe(options.ffprobe);
    let store: LibraryStore | null = null;
    const topic = new TopicLog<LibrarySnapshot, LibraryEvent>(() => ({ entries: store?.list() ?? [] }), '0');
    store = await LibraryStore.open({
      dir: options.dir,
      onEvent: (event) => topic.publish(event),
      validateAudio: async (file, mediaType) => {
        const result = await probe(file, mediaType);
        if (!result.ok) throw withLocalized(
            formatInvalid('', { problems: result.problems }),
            RcLibrary.referenceUndecodable({ problems: result.problems.join(RcLibrary.problemSeparator().text) }),
          );
      },
    });
    return new LibraryService(options, store, topic);
  }

  /** Voice cloning uses tasks and grants, and is wired in after they are built. */
  attachVoiceClones(clones: VoiceCloneService): void {
    this.#clones = clones;
  }

  /** Voice cloning (§5.9): see `VoiceCloneService`. */
  get voiceClones(): VoiceCloneService {
    if (!this.#clones) throw new RpcError('busy', RcLibrary.clonesNotReady());
    return this.#clones;
  }

  list(p: RpcParams<'library.list'>): RpcResult<'library.list'> {
    return { entries: this.store.list(p.library, p.kind) };
  }

  get(p: RpcParams<'library.get'>): RpcResult<'library.get'> {
    return { entry: this.store.get(p) };
  }

  put(p: LibraryPutParams): Promise<LibraryPutOutcome> {
    return this.#once(p.commandId, async () => {
      const file = p.source ? await this.#source(p.source) : undefined;
      return this.store.put({
        library: p.library,
        content: p.content,
        ...(p.id !== undefined ? { id: p.id } : {}),
        ...(p.expectedVersion !== undefined ? { expectedVersion: p.expectedVersion } : {}),
        ...(file ? { file } : {}),
      });
    });
  }

  async remove(p: RpcParams<'library.remove'>): Promise<RpcResult<'library.remove'>> {
    await this.store.remove(p.library, p.id);
    return { removed: true };
  }

  import(p: RpcParams<'library.import'>): Promise<RpcResult<'library.import'>> {
    return this.#once(p.commandId, async () => {
      const candidate = await readLibraryImport(p.path);
      const { entry } = await this.store.put({
        library: candidate.library,
        content: candidate.content,
        ...(candidate.file ? { file: candidate.file } : {}),
        ...(candidate.consentDeclaredAt !== undefined ? { consentDeclaredAt: candidate.consentDeclaredAt } : {}),
      });
      return { entry };
    });
  }

  async export(p: RpcParams<'library.export'>): Promise<RpcResult<'library.export'>> {
    return this.#pinned(p.entry, (entry) => writeLibraryExport(this.store, entry, p.path));
  }

  async openHandle(p: RpcParams<'library.openHandle'>): Promise<MediaHandle> {
    const entry = this.store.get(p);
    const file = this.store.fileOf(entry);
    if (!file) throw new RpcError('not-found', RcLibrary.entryHasNoFile());
    const location = this.store.filePath(entry, file);
    const handle = await this.#options.media.issue(path.dirname(location), path.basename(location));
    return { ...handle, fileName: file.fileName };
  }

  /**
   * Copies an entry into a video: an ordinary edit transaction. The actor is the connection that made the request (the UI and the CLI are users). The bytes are taken into the video directory (`managed`), and the source records the library entry and version. Later changes and deletions in the library do not affect the video.
   */
  async applyToVideo(p: LibraryApplyParams, principal: TrustedPrincipal): Promise<LibraryApplyResult> {
    const { videos } = this.#options;
    return this.#pinned(p.entry, async (entry) => {
      const frozen = { library: entry.library, id: entry.id, version: entry.version, contentHash: entry.contentHash };
      const name = p.name ?? entry.content.name;
      const content = entry.content;
      const origin = {
        library: entry.library,
        entryId: entry.id,
        version: entry.version,
        contentHash: entry.contentHash,
        name: content.name,
      };
      let operations: EditOperation[];
      if (entry.library === 'brand' && 'file' in content) {
        operations = [
          {
            type: 'importAsset',
            path: this.store.filePath(entry, content.file),
            name,
            ref: 'asset',
            storage: 'managed',
            provenance: { origin: 'library', source: { library: { ...origin, kind: content.kind } } },
          },
        ];
      } else if (entry.library === 'brand' && 'style' in content) {
        operations = [
          {
            type: 'putDocument',
            ref: 'style',
            kind: 'caption-style',
            name,
            body: content.style,
            extensions: { 'cuccut.library': { ...origin, kind: content.kind } },
          },
          ...(p.captionItemIds ?? []).map((itemId): EditOperation => ({
            type: 'setCaptionStyle',
            ...(p.sequenceId !== undefined ? { sequenceId: p.sequenceId } : {}),
            itemId,
            styleDocument: { ref: 'style' },
          })),
        ];
      } else {
        throw withLocalized(
          libraryError('LIBRARY_ENTRY_NOT_APPLICABLE', 'invalid-request', '', { library: entry.library, id: entry.id }),
          RcLibrary.notCopyable({ library: entry.library }),
        );
      }
      if (p.captionItemIds?.length && !('style' in content)) {
        throw new RpcError('invalid-request', RcLibrary.captionItemIdsStyleOnly());
      }
      const expectedRevision = p.expectedRevision ?? videos.mirror(p.videoId)?.video.revision;
      if (expectedRevision === undefined) throw new RpcError('not-found', RcCommon.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
      const result = await videos.apply(
        { videoId: p.videoId, commandId: p.commandId, expectedRevision, operations, label: RcLibrary.addFromLibraryLabel({ name }).text },
        principal,
      );
      const refs = result.receipt.refs ?? {};
      return {
        ...result,
        entry: frozen,
        ...(refs.asset ? { assetId: refs.asset } : {}),
        ...(refs.style ? { documentId: refs.style } : {}),
      };
    });
  }

  /** Entries enabled in a video (§5.9): the body of the `library-selection` document. Empty when that document does not exist. */
  async getVideoSelection(p: RpcParams<'library.getVideoSelection'>): Promise<VideoLibrarySelection> {
    const { document, selection } = await this.#selection(p.videoId);
    return { videoId: p.videoId, documentId: document?.id ?? null, revision: document?.currentRevision ?? null, selection };
  }

  /**
   * Changes the entries enabled in a video: an ordinary edit transaction. The actor is the connection that made the request (undoable). Fields given are replaced as a whole, and the others stay as they were.
   * Only checks the current moment: glossaries are in the library and their kinds match the steps. `library:` voices are in the library. Speakers are in that transcript. If an entry is later deleted from the library, it is handled when used: translation skips it and reports it, and dubbing does not synthesize sentences from that speaker and reports each one.
   */
  async setVideoSelection(p: LibrarySetSelectionParams, principal: TrustedPrincipal): Promise<LibrarySetSelectionResult> {
    const { videos } = this.#options;
    const mirror = videos.mirror(p.videoId);
    if (!mirror) throw new RpcError('not-found', RcCommon.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
    const { document, selection: current } = await this.#selection(p.videoId);
    const next: LibrarySelection = {
      glossaries: {
        transcribe: p.glossaries?.transcribe ?? current.glossaries.transcribe,
        translate: p.glossaries?.translate ?? current.glossaries.translate,
      },
      speakerVoices: p.speakerVoices ?? current.speakerVoices,
    };
    for (const step of ['transcribe', 'translate'] as const) {
      const list = next.glossaries[step];
      if (new Set(list).size !== list.length) throw new RpcError('invalid-request', RcLibrary.duplicateGlossaries({ step }));
      if (list.length > MAX_SELECTED_GLOSSARIES) {
        throw new RpcError('invalid-request', RcLibrary.tooManyGlossaries({ max: MAX_SELECTED_GLOSSARIES }));
      }
      // Only checks what was given this time. Entries enabled earlier and deleted since are kept, and reported when used.
      if (p.glossaries?.[step] === undefined) continue;
      for (const id of list) {
        const entry = this.store.get({ library: 'glossaries', id });
        if (entry.content.kind !== STEP_KIND[step]) {
          throw withLocalized(
            libraryError('LIBRARY_ENTRY_NOT_APPLICABLE', 'invalid-request', '', { library: 'glossaries', id, step }),
            RcLibrary.glossaryWrongStep({
              name: entry.content.name,
              transcription: entry.content.kind === 'transcription',
              transcribeStep: step === 'transcribe',
            }),
          );
        }
      }
    }
    if (p.speakerVoices !== undefined) await this.#checkSpeakerVoices(p.videoId, mirror.video.documents, p.speakerVoices);
    const operation: EditOperation = {
      type: 'putDocument',
      ...(document ? { documentId: document.id } : { ref: 'selection' }),
      kind: LIBRARY_SELECTION_KIND,
      name: RcLibrary.selectionDocumentName().text,
      body: selectionBody(next),
    } as EditOperation;
    const result = await videos.apply(
      {
        videoId: p.videoId,
        commandId: p.commandId,
        expectedRevision: p.expectedRevision ?? mirror.video.revision,
        operations: [operation],
        label: RcLibrary.changeSelectionLabel().text,
      },
      principal,
    );
    const documentId = document?.id ?? result.receipt.refs?.selection;
    if (!documentId) throw new RpcError('internal', RcLibrary.noDocumentIdAfterWrite());
    return { ...result, documentId, selection: next };
  }

  /**
   * A new video adopts the glossaries the library enables by default (`defaultEnabled`): it writes one `library-selection`, with the actor `system:library` (not in the user's undo stack). Nothing is written when no entry is enabled by default. Videos created by external service clients do not adopt them, since the library is not open to those clients.
   */
  async adoptDefaults(videoId: Id, principal: TrustedPrincipal): Promise<void> {
    if (principal.kind === 'service') return;
    const defaults = (kind: 'transcription' | 'translation') =>
      this.store
        .list('glossaries', kind)
        .filter((e) => e.defaultEnabled)
        .map((e) => e.id)
        .slice(0, MAX_SELECTED_GLOSSARIES);
    const selection: LibrarySelection = {
      glossaries: { transcribe: defaults('transcription'), translate: defaults('translation') },
      speakerVoices: [],
    };
    if (selection.glossaries.transcribe.length === 0 && selection.glossaries.translate.length === 0) return;
    const { videos } = this.#options;
    const revision = videos.mirror(videoId)?.video.revision;
    if (revision === undefined) return;
    await videos.applyAs(
      {
        videoId,
        commandId: newId('cmd'),
        expectedRevision: revision,
        operations: [
          { type: 'putDocument', ref: 'selection', kind: LIBRARY_SELECTION_KIND, name: RcLibrary.selectionDocumentName().text, body: selectionBody(selection) },
        ],
        label: RcLibrary.adoptDefaultsLabel().text,
      },
      LIBRARY_ACTOR,
    );
  }

  /**
   * The glossaries a video enables for a step that are still in the library with a matching kind (in enabled order). Deleted ones, or ones with a mismatched kind, are skipped and listed in `skipped`. When the video is not open, both are empty. Transcription and translation use these when the call gives no explicit glossary.
   */
  async enabledGlossaries(videoId: Id, step: 'transcribe' | 'translate'): Promise<{ ids: Id[]; skipped: Id[] }> {
    if (!this.#options.videos.mirror(videoId)) return { ids: [], skipped: [] };
    const { selection } = await this.#selection(videoId);
    const ids: Id[] = [];
    const skipped: Id[] = [];
    for (const id of selection.glossaries[step]) {
      try {
        if (this.store.get({ library: 'glossaries', id }).content.kind === STEP_KIND[step]) ids.push(id);
        else skipped.push(id);
      } catch {
        skipped.push(id);
      }
    }
    return { ids, skipped };
  }

  async #selection(videoId: Id) {
    const { videos } = this.#options;
    const mirror = videos.mirror(videoId);
    if (!mirror) throw new RpcError('not-found', RcCommon.videoNotOpen(), { code: 'VIDEO_NOT_OPEN' });
    return videoSelection(
      mirror.video.documents,
      async (documentId, revision) => (await videos.document(videoId, documentId, revision)).body,
    );
  }

  async #checkSpeakerVoices(
    videoId: Id,
    documents: Record<Id, { kind: string }>,
    bindings: LibrarySetSelectionParams['speakerVoices'] & object,
  ): Promise<void> {
    const seen = new Set<string>();
    const speakers = new Map<Id, Set<string>>();
    for (const binding of bindings) {
      const key = `${binding.documentId}\u0000${binding.speakerId}`;
      if (seen.has(key)) throw new RpcError('invalid-request', RcLibrary.speakerBoundTwice({ speakerId: binding.speakerId }));
      seen.add(key);
      const record = documents[binding.documentId];
      if (!record) throw new RpcError('not-found', RcLibrary.noSuchDocument({ documentId: binding.documentId }));
      if (record.kind !== 'speech')
        throw new RpcError('invalid-request', RcLibrary.documentNotSpeech({ documentId: binding.documentId, kind: record.kind }));
      let known = speakers.get(binding.documentId);
      if (!known) {
        known = speakersOf((await this.#options.videos.document(videoId, binding.documentId)).body);
        speakers.set(binding.documentId, known);
      }
      if (!known.has(binding.speakerId)) {
        throw new RpcError('invalid-request', RcLibrary.speakerNotInTranscript({ documentId: binding.documentId, speakerId: binding.speakerId }));
      }
      const libraryId = parseLibraryVoice(binding.voice);
      if (libraryId !== null) {
        if (binding.providerId !== undefined) {
          throw new RpcError('invalid-request', RcLibrary.libraryVoiceNoProvider());
        }
        this.store.get({ library: 'voices', id: libraryId });
      }
    }
  }

  /** A pinned version of an entry completes its work: other writes in the meantime do not clear its files. */
  async #pinned<T>(ref: RpcParams<'library.get'>, fn: (entry: LibraryEntry) => Promise<T>): Promise<T> {
    const holder = newId('libpin');
    const [frozen] = this.store.pin(holder, [ref]);
    try {
      return await fn(this.store.get({ library: frozen!.library, id: frozen!.id, version: frozen!.version }));
    } finally {
      await this.store.unpin(holder);
    }
  }

  async #source(source: NonNullable<LibraryPutParams['source']>): Promise<LibraryFileInput> {
    if ('artifactId' in source) {
      const file = await this.#options.artifacts.locate(source.artifactId);
      if (!file) throw new RpcError('not-found', RcLibrary.outputNotFound());
      return { path: file, fileName: path.basename(file) };
    }
    if (!path.isAbsolute(source.path)) throw new RpcError('invalid-request', RcLibrary.pathNotAbsolute());
    return { path: source.path };
  }

  #once<T>(commandId: Id | undefined, fn: () => Promise<T>): Promise<T> {
    if (!commandId) return fn();
    const existing = this.#commands.get(commandId);
    if (existing) return existing as Promise<T>;
    const run = fn();
    this.#commands.set(commandId, run);
    // Failures are not recorded, so the same commandId can be retried.
    run.catch(() => this.#commands.delete(commandId));
    if (this.#commands.size > COMMAND_MEMORY) this.#commands.delete(this.#commands.keys().next().value!);
    return run;
  }
}

/** Speakers in a transcript: `speakers[].id`, and the `speaker` on words. */
function speakersOf(body: unknown): Set<string> {
  const b = body as { speakers?: Array<{ id?: unknown }>; words?: Array<{ speaker?: unknown }> } | null;
  const out = new Set<string>();
  for (const s of Array.isArray(b?.speakers) ? b.speakers : []) if (typeof s?.id === 'string') out.add(s.id);
  for (const w of Array.isArray(b?.words) ? b.words : []) if (typeof w?.speaker === 'string') out.add(w.speaker);
  return out;
}
