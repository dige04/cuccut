import { z } from 'zod';
import { RpcError, type LibraryEntry, type LibraryEntrySummary, type LibraryName } from '@cuccut/protocol';
import type { LibraryService } from '../library/library-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import type { ToolPrincipal, ToolScope } from './tool-scope.ts';

/**
 * Read-only tools for the user library (architecture design §5.9; agent surface design §4.3): `library_list` lists entry
 * summaries of glossaries, voices and the brand library; `library_show` fetches one entry's content (glossary terms, a
 * voice's description and reference-recording facts, brand assets). On all three surfaces, also usable in plan mode;
 * writing, import/export and voice cloning are not in the catalog (management surface, done only by the user in the UI
 * or the CLI). Results never include where the library is stored locally.
 */

export interface LibraryToolsDeps {
  library: Pick<LibraryService, 'list' | 'get'>;
  scope: ToolScope;
}

/** The three libraries, one-to-one with the protocol's `LibraryName` (type checking fails if one is missing). */
const LIBRARY_NAMES = ['glossaries', 'voices', 'brand'] as const;
type MissingLibrary = Exclude<LibraryName, (typeof LIBRARY_NAMES)[number]>;
const _allLibraries: MissingLibrary extends never ? true : never = true;
void _allLibraries;

const LIBRARY_LABEL = 'glossaries, voices, brand (brand library)';

const schemas = {
  library_list: z.strictObject({
    library: z.enum(LIBRARY_NAMES).optional().describe(`Optional. List only one library: ${LIBRARY_LABEL}; lists all three when omitted`),
    kind: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .describe(
        'Optional. List only this kind: for glossaries transcription (for recognition) or translation (for translating); for voices voice; for the brand library image, video, sticker, font, color, captionStyle',
      ),
  }),
  library_show: z.strictObject({
    library: z.enum(LIBRARY_NAMES).describe(`The library holding the entry: ${LIBRARY_LABEL}`),
    id: z.string().min(1).max(200).describe('The entry id, as given by library_list'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  library_list: {
    title: 'List the user library',
    description: [
      'Lists the glossaries, voices and brand assets in the user library (summaries).',
      'Each entry: library, id, name, kind, version and update time; glossaries also give the term count and whether they are enabled by default, voices also give whether consent is declared and the clone state on each provider. Fetch the content with library_show.',
      'Read-only; editing, importing and voice cloning are done by the user in CucCut.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'List all entries', args: {} },
      { title: 'Glossaries for translation', args: { library: 'glossaries', kind: 'translation' } },
    ],
    surfaces: ['agent', 'mcp', 'cli'],
  },
  library_show: {
    title: 'Show a user library entry',
    description: [
      'Fetches the content of one entry in the user library.',
      'Glossaries give all terms (for recognition: canonical spellings and common misspellings; for translation: source term, rendering and note) and languages; voices give the name, language, the reference recording\'s transcript and file facts, the consent declaration and clone state; brand assets give file facts, color values or caption styles.',
      'Read-only; does not return the file itself or any local path.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Show a glossary', args: { library: 'glossaries', id: 'lib_0123456789abcdef' } }],
    surfaces: ['agent', 'mcp', 'cli'],
    positional: 'id',
  },
};

export class LibraryTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: LibraryToolsDeps;

  constructor(deps: LibraryToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'library_list':
        return this.#list(args as Args<'library_list'>, principal);
      case 'library_show':
        return this.#show(args as Args<'library_show'>, principal);
      default:
        throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
    }
  }

  #list(args: Args<'library_list'>, principal: ToolPrincipal) {
    const { library, scope } = this.#deps;
    scope.authorize(principal, false);
    const { entries } = library.list({
      ...(args.library !== undefined ? { library: args.library } : {}),
      ...(args.kind !== undefined ? { kind: args.kind } : {}),
    });
    return { entries: entries.map(digestSummary), next: 'Fetch an entry\'s content with library_show (library and id).' };
  }

  #show(args: Args<'library_show'>, principal: ToolPrincipal) {
    const { library, scope } = this.#deps;
    scope.authorize(principal, false);
    let entry: LibraryEntry;
    try {
      ({ entry } = library.get({ library: args.library, id: args.id }));
    } catch (error) {
      if (error instanceof RpcError && error.code === 'not-found') {
        throw new ToolError('LIBRARY_ENTRY_NOT_FOUND', `${args.library} has no entry ${args.id}: use an id given by library_list`);
      }
      throw error;
    }
    return digestEntry(entry);
  }
}

function digestSummary(summary: LibraryEntrySummary) {
  return {
    library: summary.library,
    id: summary.id,
    name: summary.name,
    kind: summary.kind,
    version: summary.version,
    updatedAt: summary.updatedAt,
    ...(summary.termCount !== undefined ? { termCount: summary.termCount } : {}),
    ...(summary.defaultEnabled !== undefined ? { defaultEnabled: summary.defaultEnabled } : {}),
    ...(summary.consentDeclared !== undefined ? { consentDeclared: summary.consentDeclared } : {}),
    ...(summary.clones ? { clones: summary.clones } : {}),
  };
}

/** Files are given only as facts (name, type, size, digest), never their storage location. */
function fileFacts(file: { fileName: string; mediaType: string; byteLength: number; sha256: string }) {
  return { fileName: file.fileName, mediaType: file.mediaType, byteLength: file.byteLength, sha256: file.sha256 };
}

function digestEntry(entry: LibraryEntry) {
  const head = { library: entry.library, id: entry.id, version: entry.version, updatedAt: entry.updatedAt };
  switch (entry.library) {
    case 'glossaries':
      return { ...head, ...(entry as LibraryEntry<'glossaries'>).content };
    case 'voices': {
      const { content, clones } = entry as LibraryEntry<'voices'>;
      return {
        ...head,
        name: content.name,
        kind: 'voice',
        language: content.language,
        origin: content.origin,
        transcript: content.transcript,
        reference: fileFacts(content.reference),
        consentDeclared: content.consent.declared,
        clones: Object.entries(clones ?? {}).map(([providerId, clone]) => ({ providerId, state: clone.state, createdAt: clone.createdAt })),
      };
    }
    case 'brand': {
      const content = (entry as LibraryEntry<'brand'>).content;
      if ('file' in content) return { ...head, name: content.name, kind: content.kind, file: fileFacts(content.file) };
      return { ...head, ...content };
    }
  }
}
