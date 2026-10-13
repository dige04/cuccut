import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { RpcError } from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { checkCanvas, readCanvasInfo } from '@cuccut/design';
import { contentTypeOf } from '@cuccut/slides';
import { resolveDeckDir, type SlidesService } from '../slides.ts';
import { inside } from './artifact-save.ts';
import { formatBytes } from './model-install-tools.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Designs in a session (docs/design/canvas §7.2): the agent writes the design's files with the Driver's own file tools;
 * these two tools cover what it cannot do itself.
 *
 * - `design_check`: structural validation against the format's rules (`checkCanvas` from `@cuccut/design`, no
 *   rendering), returning a list of problems. With no problems it records one `design-created` in the session (one per
 *   design; passing again updates the title and board count), and a design card appears in the thread. Reads files
 *   only, risk `read`.
 * - `design_import_asset`: copies an image or a font from the working directory into the design's `assets/`
 *   (content-addressed, stored once) and returns the `/_blob/<id>` to write into a board. When the editor has this
 *   design open it shares the store with it; asset registration and publishing are serialized. Writes the design
 *   directory, risk `edit`.
 *
 * The design must be in the session's source directory (the card opens by source directory and relative path). Only for
 * the agent in a session (`surfaces` is just `agent`).
 */

/** Limit for one asset file (images and fonts); shrink larger images first. */
export const DESIGN_ASSET_MAX_BYTES = 20 * 1024 * 1024;

/** At most this many issues are listed in the result; the rest are only counted. */
const MAX_LISTED_ISSUES = 200;

export interface DesignToolsDeps {
  scope: ToolScope;
  design: Pick<SlidesService, 'designStore'>;
}

const schemas = {
  design_check: z.strictObject({
    path: z.string().min(1).max(1000).describe('Design directory (containing canvas.json), as a path relative to the working directory'),
  }),
  design_import_asset: z.strictObject({
    canvas: z.string().min(1).max(1000).describe('Design directory (containing canvas.json), as a path relative to the working directory'),
    path: z.string().min(1).max(1000).describe('File to import, as a path relative to the working directory: an image (png, jpg, gif, webp, avif, svg) or a font (woff2, woff, ttf, otf)'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  design_check: {
    title: 'Check design',
    description: [
      'Validate a design against the design format\'s rules and list its problems.',
      'Looks at files only; no rendering, no screenshots.',
      'Checks canvas.json (v is 3; x, y, w, h and optional fields of each boards entry; order, pages, notes, launch, designSystems and ds/<folder>/), that every path in boards and order has a file, and that every .dc.html outside ds/ is registered in boards; for each board: the support.js header line, <x-dc>, a single data-dc-script block (class Component extends DCLogic, no import/export), single-quoted data-props that is valid JSON with $preview equal to the board\'s w/h in boards; closed tags, quoted attributes, no self-closing tags, no uppercase tag names, {{ }} containing only dotted paths; scripts that do not build UI, install global key handlers or use the network; images and url() using /_blob/<id> with all assets in assets/; no iframe/object/embed, and only Google Fonts for remote styles; path segment rules and file count and size limits.',
      'Whether board scripts run and whether the layout is right are outside the check. Must be called once after writing or changing a design. When issues is 0, a card for this design appears in the thread (one per design; later passes update the title and board count) that the user can open to preview, edit and annotate; when there are problems, fix the files as described in design and call it again.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Check a design just written', args: { path: 'poster' } }],
    // Only for the agent in a session: the card is recorded in the session.
    surfaces: ['agent'],
    positional: 'path',
  },
  design_import_asset: {
    title: 'Import design asset',
    description: [
      'Copy an image or font into the design\'s assets/ and return its URL.',
      'The file comes from the working directory; write the returned URL into a board.',
      `Content-addressed, each file stored once; the returned src looks like /_blob/<id> and is written verbatim into <img src="...">, a url(...) in <helmet><style>, or @font-face. Accepts only png, jpg, gif, webp, avif, svg and woff2, woff, ttf, otf, up to ${formatBytes(DESIGN_ASSET_MAX_BYTES)}.`,
      'canvas and path are both relative to the working directory and may not point outside it with .. or symlinks; canvas must already contain canvas.json. Asks the user for confirmation according to the access mode.',
    ].join('\n'),
    annotations: { destructiveHint: false, idempotentHint: true },
    effect: 'mutation',
    examples: [{ title: 'Import a hero image', args: { canvas: 'poster', path: 'images/hero.jpg' } }],
    surfaces: ['agent'],
  },
};

export class DesignTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: DesignToolsDeps;

  constructor(deps: DesignToolsDeps) {
    this.#deps = deps;
  }

  dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    switch (name as ToolName) {
      case 'design_check':
        return this.#check(args as Args<'design_check'>, principal);
      case 'design_import_asset':
        return this.#importAsset(args as Args<'design_import_asset'>, principal);
      default:
        return Promise.reject(new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`));
    }
  }

  async #check(args: Args<'design_check'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    // Validate even when canvas.json is missing or malformed: the problems go into the list and the agent fixes them from it.
    const canvas = await this.#canvas(access, args.path, false);
    const result = await checkCanvas(canvas.dir);
    const problems = result.issues.length;
    if (problems === 0) scope.recordDesign?.(access, { target: canvas.target, title: result.title, boardCount: result.boardCount });
    return {
      path: canvas.target.path,
      title: result.title,
      boardCount: result.boardCount,
      problems,
      ...(problems > 0 ? { issues: result.issues.slice(0, MAX_LISTED_ISSUES) } : {}),
      ...(problems > MAX_LISTED_ISSUES ? { more: `${problems - MAX_LISTED_ISSUES} more not listed: fix these first, then check again` } : {}),
      notChecked: 'Not checked (no rendering): whether board scripts run, layout, and visual appearance.',
      next:
        problems > 0
          ? 'Fix the files according to issues (file is a path relative to the design directory; "." is the whole directory), then call design_check again until problems is 0.'
          : 'No problems: a card for this design is now in the thread, and the user can open it to preview, edit and annotate. Tell the user in a sentence or two what you made; do not paste the file contents again.',
    };
  }

  async #importAsset(args: Args<'design_import_asset'>, principal: ToolPrincipal) {
    const { scope, design } = this.#deps;
    const access = scope.authorize(principal, true);
    const canvas = await this.#canvas(access, args.canvas, true);
    const file = await this.#sourceFile(access, args.path);
    const type = contentTypeOf(file.path);
    const approval = await scope.confirm(access, {
      tool: 'design_import_asset',
      targets: [canvas.dir],
      ...confirmSummary(RcAgentTools.designImportAssetSummary({ file: args.path, canvas: canvas.target.path || '.' })),
    });
    const bytes = await fs.readFile(file.path);
    if (bytes.byteLength !== file.size) throw new ToolError('FILE_CHANGED', 'The file changed while waiting for confirmation: call again');
    const uploaded = await design.designStore(canvas.dir).putBlob(bytes, type);
    return {
      src: uploaded.url,
      bytes: uploaded.sizeBytes,
      contentType: type,
      ...approvalField(approval),
      next: type.startsWith('font/')
        ? 'Write an @font-face in the <helmet><style> of each board that uses it, with src: url(<src>), using this URL verbatim; call design_check when done.'
        : 'Write src verbatim into <img src="..."> or a url(...) in <helmet><style> (not as a relative path, file name or data: URI, and not in an inline style); call design_check when done.',
    };
  }

  /**
   * The design directory given by the caller: relative to the working directory and inside the session's source
   * directory. With `requireCanvas` it must also be a design (with a valid canvas.json). Returns the real path and the
   * FileTarget used to open it (source directory + relative path, `/`-separated).
   */
  async #canvas(access: ToolAccess, given: string, requireCanvas: boolean) {
    const { scope } = this.#deps;
    const { root, scope: source } = await scope.createRoot(access, undefined, { locate: true });
    const absolute = path.resolve(scope.fileBase(access), given);
    const relNative = path.relative(root, absolute);
    if (relNative === '..' || relNative.startsWith(`..${path.sep}`) || path.isAbsolute(relNative)) throw canvasOutside();
    let dir: string;
    try {
      dir = await resolveDeckDir(root, relNative);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      if (error.code === 'not-found') throw new ToolError('CANVAS_NOT_FOUND', `No such directory in the working directory: ${given}`);
      throw canvasOutside();
    }
    if (requireCanvas && !(await readCanvasInfo(dir))) {
      throw new ToolError(
        'NOT_A_CANVAS',
        `${given} is not a design yet: write canvas.json first (with v set to 3 and boards as an object keyed by board path), then import assets`,
      );
    }
    const relPath = relNative.split(path.sep).filter(Boolean).join('/');
    return { dir, target: { ...source, path: relPath } };
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
      throw new ToolError(
        'UNSUPPORTED_ASSET_TYPE',
        'Only images (png, jpg, gif, webp, avif, svg) or fonts (woff2, woff, ttf, otf) can be imported, judged by file extension. Write supporting files such as css, js and json directly into the design directory and reference them by relative path',
      );
    }
    if (stat.size > DESIGN_ASSET_MAX_BYTES) {
      throw new ToolError('FILE_TOO_LARGE', `The file is ${formatBytes(stat.size)}, over the ${formatBytes(DESIGN_ASSET_MAX_BYTES)} limit: shrink the image first`, {
        bytes: stat.size,
        limit: DESIGN_ASSET_MAX_BYTES,
      });
    }
    return { path: file, size: stat.size };
  }
}

function canvasOutside(): ToolError {
  return new ToolError(
    'PATH_OUTSIDE_WORKSPACE',
    'The design must be a directory in the session\'s working directory (a relative path, not in a hidden or dependency directory, not through a symlink pointing elsewhere)',
  );
}

function fileOutside(): ToolError {
  return new ToolError(
    'PATH_OUTSIDE_WORKSPACE',
    'path must be a file in this session\'s working directory (a relative path, without .., not through a symlink pointing elsewhere)',
  );
}
