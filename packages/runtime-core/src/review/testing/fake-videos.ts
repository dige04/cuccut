import path from 'node:path';
import type {
  DocumentContent,
  EditResult,
  Id,
  RpcParams,
  Sequence,
  SequenceItem,
  Track,
  TransactionReceipt,
  VideoRef,
  VideoSnapshot,
  VideoTopicSnapshot,
} from '@cuccut/protocol';
import type { TrustedPrincipal } from '../../gateway.ts';
import type { VideoService } from '../../videos/video-service.ts';

/**
 * Engine-free stand-ins for the review gate's unit tests: one video in a project directory, whose edits only know
 * `putDocument` (all the review service writes). Each edit moves the revision on and updates the mirror at once.
 */

export const FAKE_VIDEO_ID = 'vid_fake';
export const FAKE_SEQUENCE_ID = 'seq_main';

const track = (id: string): Track => ({
  id,
  order: 0,
  kind: 'visual',
  locked: false,
  visible: true,
  muted: false,
  solo: { enabled: false, group: 'visual' },
});

/** An unfilled placeholder box (0–2 s at 30 fps): the built-in `placeholders` check fails on it. */
const placeholder: SequenceItem = {
  enabled: true,
  locked: false,
  paintOrder: 0,
  followPolicy: { kind: 'follow-cuts' },
  id: 'item_box',
  trackId: 'track_v',
  type: 'placeholder',
  span: { fromFrame: 0, durationFrames: 60 },
  place: {},
  placeholder: { variant: 'media' },
} as SequenceItem;

export function fakeSnapshot(): VideoSnapshot {
  const sequence: Sequence = {
    id: FAKE_SEQUENCE_ID,
    revision: 'r',
    name: 'Main',
    fps: { num: 30, den: 1 },
    canvas: { width: 1080, height: 1920, workingSpace: 'srgb', background: '#000000' },
    durationPolicy: { kind: 'derived' },
    animationBindings: [],
    tracks: [track('track_v')],
    items: [placeholder],
    transitions: [],
    markers: [],
    ducking: [],
  };
  return {
    format: 'cuccut.video',
    schemaVersion: 3,
    timeContractVersion: 1,
    id: FAKE_VIDEO_ID,
    name: 'Draft',
    revision: 'rev1',
    rootSequenceId: FAKE_SEQUENCE_ID,
    sequences: { [FAKE_SEQUENCE_ID]: sequence },
    assets: {},
    documents: {},
    fonts: {},
    localizationSets: {},
    canvasVariants: {},
    syncGroups: {},
    protections: {},
    checkpoints: {},
    links: [],
  };
}

export interface AppliedEdit {
  params: RpcParams<'edits.apply'>;
  principal: TrustedPrincipal;
  provenance: Parameters<VideoService['apply']>[2];
}

export class FakeVideos {
  snapshot = fakeSnapshot();
  readonly bodies = new Map<Id, unknown>();
  readonly applied: AppliedEdit[] = [];
  readonly #root: string;
  #counter = 1;

  /** `root` is the project directory; the video lives in `<root>/Draft`, and results go to `<root>/.cuccut-out/reviews`. */
  constructor(root: string) {
    this.#root = root;
  }

  ref(videoId: Id): VideoRef | null {
    if (videoId !== FAKE_VIDEO_ID) return null;
    return { videoId, name: 'Draft', path: path.join(this.#root, 'Draft'), source: { projectId: 'proj_fake', conversationId: null }, relPath: 'Draft' };
  }

  mirror(videoId: Id): VideoTopicSnapshot | null {
    return videoId === FAKE_VIDEO_ID ? { video: this.snapshot, eventSeq: String(this.#counter) } : null;
  }

  async document(videoId: Id, documentId: Id): Promise<DocumentContent> {
    const document = this.snapshot.documents[documentId];
    if (videoId !== FAKE_VIDEO_ID || !document) throw new Error(`no document ${documentId}`);
    return { document, revision: document.currentRevision, body: this.bodies.get(documentId) };
  }

  async apply(params: RpcParams<'edits.apply'>, principal: TrustedPrincipal, provenance?: AppliedEdit['provenance']): Promise<EditResult> {
    this.applied.push({ params, principal, provenance });
    const previousRevision = this.snapshot.revision;
    const documents = { ...this.snapshot.documents };
    const createdIds: Id[] = [];
    const updatedIds: Id[] = [];
    for (const op of params.operations) {
      if (op.type !== 'putDocument') throw new Error(`the fake only applies putDocument, not ${op.type}`);
      const id = op.documentId ?? `doc_${++this.#counter}`;
      (op.documentId ? updatedIds : createdIds).push(id);
      documents[id] = { id, kind: op.kind, name: op.name ?? op.kind, currentRevision: `d${this.#counter}`, revisions: {} };
      this.bodies.set(id, structuredClone(op.body));
    }
    const videoRevision = `rev${++this.#counter}`;
    this.snapshot = { ...this.snapshot, revision: videoRevision, documents };
    const receipt = {
      transactionId: `tx_${this.#counter}`,
      commandId: params.commandId,
      status: 'committed',
      videoId: params.videoId,
      previousRevision,
      videoRevision,
      eventSeq: String(this.#counter),
      label: params.label ?? '',
      ...(params.labelRef ? { labelRef: params.labelRef } : {}),
      actor: { kind: 'user', id: 'user_local' },
      createdIds,
      updatedIds,
      deletedIds: [],
      lineage: {},
      impact: { oldDurationFrames: 60, newDurationFrames: 60, translationUnitsStale: [], dubbingUnitsStale: [], orphanedAnchors: [] },
      timeResolution: [],
      preserved: [],
      undo: { available: true },
      committedAt: new Date(0).toISOString(),
    } as unknown as TransactionReceipt;
    return { receipt } as EditResult;
  }
}
