import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { LAYOUT_NOTE_PREFIX, checkDeck, contentTypeOf, problemCount, readDeckSummary, type CheckReport } from '@cuccut/slides';
import { resolveDeckDir, type SlidesService } from '../slides.ts';
import { inside } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Slides in a session (docs/design/slides §7.2): the agent writes the deck's files with the Driver's own file tools; these
 * two tools cover what it cannot do itself.
 *
 * - `slides_check`: validates the deck slide by slide with the compiler from the editor build (`checkDeck` from
 *   `@cuccut/slides`) and returns a list of problems. With no problems it records one `slides-created` in the session
 *   (one per deck; passing again updates the title and slide count), and a slides card appears in the thread. Reads
 *   files only, risk `read`.
 * - `slides_import_asset`: copies an image or a font from the working directory into the deck's `assets/`
 *   (content-addressed, stored once) and returns the `/_blob/<id>` to write into `<img src>` or the `src` of deck.json
 *   `faces`. When the editor has this deck open it shares the store with it; asset registration and publishing are
 *   serialized. Writes the deck directory, risk `edit`.
 *
 * The deck must be in the session's source directory (the card opens by source directory and relative path). Only for
 * the agent in a session (`surfaces` is just `agent`).
 */

/** Limit for one asset file (images and fonts): slide images run from a few hundred KB to a few MB, shrink anything larger first; CJK font files also fit within this. */
export const SLIDES_ASSET_MAX_BYTES = 20 * 1024 * 1024;

export interface SlidesToolsDeps {
  scope: ToolScope;
  slides: Pick<SlidesService, 'compiler' | 'store'>;
}

const schemas = {
  slides_check: z.strictObject({
    path: z.string().min(1).max(1000).describe('Deck directory (containing deck.json), as a path relative to the working directory'),
  }),
  slides_import_asset: z.strictObject({
    deck: z.string().min(1).max(1000).describe('Deck directory (containing deck.json), as a path relative to the working directory'),
    path: z.string().min(1).max(1000).describe('File to import, as a path relative to the working directory: an image (png, jpg, gif, webp, avif, svg) or a font (woff2, woff, ttf, otf)'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  slides_check: {
    title: 'Check slides',
    description: [
      'Validate a deck with the slides editor\'s compiler and list its problems.',
      `Checks each slide for: tags outside the format, CSS that would be dropped, tables with uneven rows/columns, <title>/<link>/<style> in slide files, image URLs that are not /_blob, referenced /_blob assets that do not exist, and unstable serialization round trips; and checks whether deck.json's order, sections and cover point to existing slides, whether the editor recognizes the fonts in faces and the font files exist, and whether designSystems matches ds/<folder>/. Each slide's notes are hints that do not affect content; those starting with "${LAYOUT_NOTE_PREFIX}" are layout estimates (content overflowing its box, text overlapping text, words that do not fit).`,
      'Must be called once after writing or changing a deck. When problems is 0, a card for this deck appears in the thread (one per deck; later passes update the title and slide count) that the user can open to preview, edit and annotate; when there are problems, fix the files as described in slides and call it again.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Check a deck just written', args: { path: 'talk' } }],
    // Only for the agent in a session: the card is recorded in the session.
    surfaces: ['agent'],
    positional: 'path',
  },
  slides_import_asset: {
    title: 'Import slides asset',
    description: [
      'Copy an image or font into the deck\'s assets/ and return its URL.',
      'The file comes from the working directory; write the returned URL into a slide or deck.json.',
      `Content-addressed, each file stored once; the returned src looks like /_blob/<id>: for an image write it verbatim into the slide's <img src="...">, for a font write it verbatim as the src of that entry in deck.json's faces. Accepts only png, jpg, gif, webp, avif, svg and woff2, woff, ttf, otf, up to ${formatBytes(SLIDES_ASSET_MAX_BYTES)}.`,
      'deck and path are both relative to the working directory and may not point outside it with .. or symlinks. Asks the user for confirmation according to the access mode.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: 'Import a cover image', args: { deck: 'talk', path: 'images/cover.png' } }],
    surfaces: ['agent'],
  },
};

export class SlidesTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: SlidesToolsDeps;

  constructor(deps: SlidesToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'slides_check':
        return this.#check(args as Args<'slides_check'>, principal);
      case 'slides_import_asset':
        return this.#importAsset(args as Args<'slides_import_asset'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  async #check(args: Args<'slides_check'>, principal: ToolPrincipal) {
    const { scope, slides } = this.#deps;
    const access = scope.authorize(principal, false);
    const deck = await this.#deck(access, args.path);
    const rt = slides.compiler();
    if (!rt) throw new ToolError('SLIDES_COMPILER_UNAVAILABLE', 'CucCut on this machine was built without the slides editor, so the deck cannot be validated or opened in CucCut. The deck files still work; tell the user this');
    let report: CheckReport;
    try {
      // Include the compiler's layout hints (content overflowing its box, text overlapping text, words that do not fit): without screenshots this is the only way to see the layout.
      report = checkDeck(rt, deck.dir, { verbose: true });
    } catch (error) {
      throw new ToolError('SLIDES_CHECK_FAILED', `Validation did not finish: ${(error as Error).message}. First check that deck.json is valid JSON`);
    }
    const problems = problemCount(report);
    if (problems === 0) scope.recordSlides?.(access, { target: deck.target, title: deck.summary.title, slideCount: deck.summary.slideCount });
    const slidesWithFindings = report.slides
      .filter((slide) => slide.problems.length > 0 || slide.notes.length > 0 || slide.roundTripDrift)
      .map((slide) => ({
        id: slide.id,
        ...(slide.problems.length > 0 ? { problems: slide.problems } : {}),
        ...(slide.notes.length > 0 ? { notes: slide.notes } : {}),
        ...(slide.roundTripDrift ? { roundTripDrift: true } : {}),
      }));
    return {
      path: deck.target.path,
      title: deck.summary.title,
      slideCount: deck.summary.slideCount,
      problems,
      ...(report.deckProblems.length > 0 ? { deckProblems: report.deckProblems } : {}),
      ...(report.orphans.length > 0 ? { orphans: report.orphans } : {}),
      ...(slidesWithFindings.length > 0 ? { slides: slidesWithFindings } : {}),
      next:
        problems > 0
          ? `Fix the files according to deckProblems and each slide's problems, then call slides_check again until problems is 0. notes are hints that do not affect content; try to fix the layout notes (starting with "${LAYOUT_NOTE_PREFIX}") as well.`
          : 'No problems: a card for this deck is now in the thread, and the user can open it to preview, edit and annotate. Tell the user in a sentence or two what you made; do not paste the file contents again.' +
            (slidesWithFindings.some((slide) => slide.notes?.some((note) => note.startsWith(LAYOUT_NOTE_PREFIX)))
              ? ` Some slides have layout notes (starting with "${LAYOUT_NOTE_PREFIX}"): content may not fit or may overlap; fix them and check again.`
              : '') +
            (report.orphans.length > 0 ? ' Slides in orphans are not in order and will not be shown: delete them if they are not needed.' : ''),
    };
  }

  async #importAsset(args: Args<'slides_import_asset'>, principal: ToolPrincipal) {
    const { scope, slides } = this.#deps;
    const access = scope.authorize(principal, true);
    const deck = await this.#deck(access, args.deck);
    const file = await this.#sourceFile(access, args.path);
    const type = contentTypeOf(file.path);
    const approval = await scope.confirm(access, {
      tool: 'slides_import_asset',
      targets: [deck.dir],
      ...confirmSummary(RcAgentTools.slidesImportAssetSummary({ file: args.path, deck: deck.target.path || '.' })),
    });
    const bytes = await fs.readFile(file.path);
    if (bytes.byteLength !== file.size) throw new ToolError('FILE_CHANGED', 'The file changed while waiting for confirmation: call again');
    const uploaded = await slides.store(deck.dir).putBlob(bytes, type);
    return {
      src: uploaded.url,
      bytes: uploaded.sizeBytes,
      contentType: type,
      ...approvalField(approval),
      next: type.startsWith('font/')
        ? 'Register this font in deck.json\'s faces: {"family": "<the name used in the slides\' font-family>", "src": "<src>"}, using this URL verbatim and no href; call slides_check when done.'
        : 'Write src verbatim into the slide\'s <img src="..."> (not as a relative path or file name); call slides_check when done.',
    };
  }

  /**
   * The deck directory given by the caller: relative to the working directory, inside the session's source directory, and
   * a deck (with a valid deck.json). Returns the real path, the FileTarget used to open it (source directory + relative
   * path, `/`-separated) and the summary.
   */
  async #deck(access: ToolAccess, given: string) {
    const { scope } = this.#deps;
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const absolute = path.resolve(scope.fileBase(access), given);
    const relNative = path.relative(root, absolute);
    if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) throw deckOutside();
    let dir: string;
    try {
      dir = await resolveDeckDir(root, relNative);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      if (error.code === 'not-found') throw new ToolError('DECK_NOT_FOUND', `No such directory in the working directory: ${given}`);
      throw deckOutside();
    }
    const summary = await readDeckSummary(dir);
    if (!summary) throw new ToolError('NOT_A_DECK', `${given} is not a deck directory: it needs a deck.json with v set to 4 and order as an array of slide ids`);
    const relPath = relNative.split(path.sep).filter(Boolean).join('/');
    return { dir, summary, target: { ...source, path: relPath } };
  }

  /** The file to import: a regular file in the working directory (judged by real path, not through symlinks), an image or font, within the limit. */
  async #sourceFile(access: ToolAccess, given: string): Promise<{ path: string; size: number }> {
    const base = await fs.realpath(this.#deps.scope.fileBase(access));
    if (path.isAbsolute(given) || path.win32.isAbsolute(given) || given.split(/[\\/]+/).includes('..')) throw fileOutside();
    const resolved = path.resolve(base, given);
    if (resolved === base || !inside(resolved, base)) throw fileOutside();
    const stat = await fs.lstat(resolved).catch(() => null);
    if (!stat) throw new ToolError('FILE_NOT_FOUND', `No such file in the working directory: ${given}`);
    if (stat.isSymbolicLink()) throw new ToolError('PATH_IS_SYMLINK', 'path is a symlink: give the file it points to, inside the working directory');
    if (!stat.isFile()) throw new ToolError('NOT_A_FILE', 'path must be a regular file (not a directory)');
    const dirReal = await fs.realpath(path.dirname(resolved));
    if (!inside(dirReal, base)) throw fileOutside();
    const file = path.join(dirReal, path.basename(resolved));
    const type = contentTypeOf(file);
    if (!type.startsWith('image/') && !type.startsWith('font/')) {
      throw new ToolError('UNSUPPORTED_ASSET_TYPE', 'Only images (png, jpg, gif, webp, avif, svg) or fonts (woff2, woff, ttf, otf) can be imported, judged by file extension');
    }
    if (stat.size > SLIDES_ASSET_MAX_BYTES) {
      throw new ToolError('FILE_TOO_LARGE', `The file is ${formatBytes(stat.size)}, over the ${formatBytes(SLIDES_ASSET_MAX_BYTES)} limit: shrink the image first`, {
        bytes: stat.size,
        limit: SLIDES_ASSET_MAX_BYTES,
      });
    }
    return { path: file, size: stat.size };
  }
}

function deckOutside(): ToolError {
  return new ToolError(
    'PATH_OUTSIDE_WORKSPACE',
    'deck must be a directory in the session\'s working directory (a relative path, not in a hidden or dependency directory, not through a symlink pointing elsewhere)',
  );
}

function fileOutside(): ToolError {
  return new ToolError(
    'PATH_OUTSIDE_WORKSPACE',
    'path must be a file in this session\'s working directory (a relative path, without .., not through a symlink pointing elsewhere)',
  );
}
