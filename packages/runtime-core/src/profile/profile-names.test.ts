import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TranscriptionGlossary } from '@cuccut/protocol';
import { LibraryStore } from '@cuccut/runtime-storage/library';
import { cleanNames, namesToSpell, syncInterviewNames, type NamesLibrary } from './profile-names.ts';

describe('interview names in the user library', () => {
  let dir: string;
  let library: LibraryStore;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-profile-names-'));
    library = await LibraryStore.open({ dir });
  });

  afterEach(async () => {
    await library.idle();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const glossary = (id: string) => library.get({ library: 'glossaries', id }).content as TranscriptionGlossary;

  it('creates one default-enabled transcription glossary', async () => {
    const sync = await syncInterviewNames(library, {
      glossaryId: null,
      names: [
        { term: ' Deska ', misheard: ['desk a', 'Deska'] },
        { term: 'Next.js', misheard: [] },
        { term: 'deska', misheard: [] },
      ],
      glossaryName: 'Names from the interview',
    });
    expect(sync.added).toEqual(['Deska', 'Next.js']);
    expect(glossary(sync.glossaryId!)).toEqual({
      name: 'Names from the interview',
      kind: 'transcription',
      language: null,
      defaultEnabled: true,
      terms: [
        { canonical: 'Deska', misheard: ['desk a'] },
        { canonical: 'Next.js', misheard: [] },
      ],
    });
  });

  it('no names and no glossary: nothing is created', async () => {
    expect(await syncInterviewNames(library, { glossaryId: null, names: [], glossaryName: 'x' })).toEqual({ glossaryId: null, added: [] });
    expect(library.list()).toEqual([]);
  });

  it('merges only new spellings (case-insensitive) and keeps what the user edited', async () => {
    const first = await syncInterviewNames(library, { glossaryId: null, names: [{ term: 'Deska', misheard: [] }], glossaryName: 'Names' });
    const id = first.glossaryId!;
    // The user edits the entry in the library.
    const entry = library.get({ library: 'glossaries', id });
    await library.put({
      library: 'glossaries',
      id,
      expectedVersion: entry.version,
      content: { ...glossary(id), name: 'My names', terms: [{ canonical: 'Deska', misheard: ['dexa'] }] },
    });
    const second = await syncInterviewNames(library, {
      glossaryId: id,
      names: [
        { term: 'DESKA', misheard: ['other'] },
        { term: 'Claude', misheard: ['clod'] },
      ],
      glossaryName: 'Names',
    });
    expect(second).toEqual({ glossaryId: id, added: ['Claude'] });
    expect(glossary(id)).toMatchObject({
      name: 'My names',
      terms: [
        { canonical: 'Deska', misheard: ['dexa'] },
        { canonical: 'Claude', misheard: ['clod'] },
      ],
    });
    // Nothing new: no write.
    const version = library.get({ library: 'glossaries', id }).version;
    expect(await syncInterviewNames(library, { glossaryId: id, names: [{ term: 'claude', misheard: [] }], glossaryName: 'Names' })).toEqual({
      glossaryId: id,
      added: [],
    });
    expect(library.get({ library: 'glossaries', id }).version).toBe(version);
  });

  it('an entry the user removed is created again', async () => {
    const first = await syncInterviewNames(library, { glossaryId: null, names: [{ term: 'Deska', misheard: [] }], glossaryName: 'Names' });
    await library.remove('glossaries', first.glossaryId!);
    const again = await syncInterviewNames(library, { glossaryId: first.glossaryId, names: [{ term: 'Deska', misheard: [] }], glossaryName: 'Names' });
    expect(again.glossaryId).not.toBe(first.glossaryId);
    expect(again.added).toEqual(['Deska']);
    expect(glossary(again.glossaryId!).terms).toEqual([{ canonical: 'Deska', misheard: [] }]);
  });

  it('retries once after a version conflict', async () => {
    const first = await syncInterviewNames(library, { glossaryId: null, names: [{ term: 'Deska', misheard: [] }], glossaryName: 'Names' });
    const id = first.glossaryId!;
    let puts = 0;
    // Someone else edits the entry between our read and our put, once.
    const racing: NamesLibrary = {
      list: (...args) => library.list(...args),
      get: (ref) => library.get(ref),
      put: async (input) => {
        puts++;
        if (puts === 1) {
          const current = library.get({ library: 'glossaries', id });
          await library.put({
            library: 'glossaries',
            id,
            expectedVersion: current.version,
            content: { ...glossary(id), terms: [...glossary(id).terms, { canonical: 'Pasho', misheard: [] }] },
          });
        }
        return library.put(input);
      },
    };
    const sync = await syncInterviewNames(racing, { glossaryId: id, names: [{ term: 'Claude', misheard: [] }], glossaryName: 'Names' });
    expect(puts).toBe(2);
    expect(sync.added).toEqual(['Claude']);
    expect(glossary(id).terms.map((t) => t.canonical)).toEqual(['Deska', 'Pasho', 'Claude']);
  });

  it('names to spell: default-enabled transcription glossaries only, no repeats, capped', async () => {
    await library.put({
      library: 'glossaries',
      content: { name: 'a', kind: 'transcription', language: null, defaultEnabled: true, terms: [{ canonical: 'Deska', misheard: [] }, { canonical: 'Claude', misheard: [] }] },
    });
    await library.put({
      library: 'glossaries',
      content: { name: 'b', kind: 'transcription', language: null, defaultEnabled: false, terms: [{ canonical: 'Hidden', misheard: [] }] },
    });
    await library.put({
      library: 'glossaries',
      content: { name: 'c', kind: 'transcription', language: null, defaultEnabled: true, terms: [{ canonical: 'deska', misheard: [] }, { canonical: 'Next.js', misheard: [] }] },
    });
    await library.put({
      library: 'glossaries',
      content: { name: 'd', kind: 'translation', sourceLanguage: null, targetLanguage: 'vi', defaultEnabled: true, terms: [{ source: 'cut', target: 'cắt', note: null }] },
    });
    expect(new Set(namesToSpell(library, 80))).toEqual(new Set(['Deska', 'Claude', 'Next.js']));
    expect(namesToSpell(library, 2)).toHaveLength(2);
  });

  it('cleanNames drops empty terms and collapses whitespace', () => {
    expect(cleanNames([{ term: '  ', misheard: [] }, { term: 'Next\n.js', misheard: [' ', 'next js'] }])).toEqual([{ canonical: 'Next .js', misheard: ['next js'] }]);
  });
});
