import {
  LIBRARY_SELECTION_KIND,
  LIBRARY_SELECTION_SCHEMA,
  MAX_SELECTED_GLOSSARIES,
  MAX_SPEAKER_VOICES,
  type DocumentRecord,
  type Id,
  type LibrarySelection,
  type SpeakerVoiceBinding,
} from '@cuccut/protocol';

/**
 * Library entries enabled in a video (architecture design §5.9; `library-selection` in video format spec §4.6): reads the body and finds the document.
 * Parts of the body that are not recognized are not interpreted (read as not enabled); writing back is a full rewrite by `library.setVideoSelection`.
 */

export function emptySelection(): LibrarySelection {
  return { glossaries: { transcribe: [], translate: [] }, speakerVoices: [] };
}

/** The `library-selection` document in the video; if there are several, the one with the smallest ID is taken (normally there is only one). */
export function selectionDocument(documents: Record<Id, DocumentRecord>): DocumentRecord | null {
  const found = Object.values(documents)
    .filter((d) => d.kind === LIBRARY_SELECTION_KIND)
    .sort((a, b) => a.id.localeCompare(b.id));
  return found[0] ?? null;
}

const ids = (value: unknown): Id[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v !== ''))].slice(0, MAX_SELECTED_GLOSSARIES)
    : [];

/** Reads the body: when it is not `cuccut.library-selection/1`, treat it as nothing enabled; non-conforming items are dropped. */
export function readSelection(body: unknown): LibrarySelection {
  const b = body as { schema?: unknown; glossaries?: { transcribe?: unknown; translate?: unknown }; speakerVoices?: unknown } | null;
  if (!b || typeof b !== 'object' || b.schema !== LIBRARY_SELECTION_SCHEMA) return emptySelection();
  const speakerVoices: SpeakerVoiceBinding[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(b.speakerVoices) ? b.speakerVoices : []) {
    const v = raw as Partial<SpeakerVoiceBinding> | null;
    if (!v || typeof v.documentId !== 'string' || typeof v.speakerId !== 'string' || typeof v.voice !== 'string' || v.voice === '')
      continue;
    const key = `${v.documentId}\u0000${v.speakerId}`;
    if (seen.has(key) || speakerVoices.length >= MAX_SPEAKER_VOICES) continue;
    seen.add(key);
    speakerVoices.push({
      documentId: v.documentId,
      speakerId: v.speakerId,
      voice: v.voice,
      ...(typeof v.providerId === 'string' && v.providerId !== '' ? { providerId: v.providerId } : {}),
    });
  }
  return { glossaries: { transcribe: ids(b.glossaries?.transcribe), translate: ids(b.glossaries?.translate) }, speakerVoices };
}

/** The body written into the video. */
export function selectionBody(selection: LibrarySelection): Record<string, unknown> {
  return { schema: LIBRARY_SELECTION_SCHEMA, ...selection };
}

/** Reads the entries enabled for a video now (reads the body via `document`); when there is no such document, it is empty. */
export async function videoSelection(
  documents: Record<Id, DocumentRecord>,
  read: (documentId: Id, revision: string) => Promise<unknown>,
): Promise<{ document: DocumentRecord | null; selection: LibrarySelection }> {
  const document = selectionDocument(documents);
  if (!document) return { document: null, selection: emptySelection() };
  return { document, selection: readSelection(await read(document.id, document.currentRevision)) };
}
