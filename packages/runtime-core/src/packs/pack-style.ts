import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PACK_LIMITS,
  PACK_MANIFEST_FILE,
  PACK_RECORD_FILE,
  PACK_STYLE_FILE,
  PACK_STYLE_MAX_CHARS,
  RpcError,
  scanPackStyle,
  scanPackText,
  type Conversation,
  type Id,
  type InstalledPackRecord,
  type PackActiveStyle,
  type PackChooseResult,
  type PackDetail,
  type PackExample,
  type PackRef,
  type PackStyleChoice,
  type PackStyleReason,
  type Project,
  type TimelineItem,
} from '@cuccut/protocol';
import { RcPacks, RcRuntime } from '@cuccut/protocol/messages/runtime-core';
import type { PackChoicesStore } from '@cuccut/runtime-storage';
import { blockedError } from './pack-inspect.ts';
import { readText, sha256Text, type InstalledPack, type PackRegistry } from './pack-registry.ts';

/**
 * The active style guide (pack spec §7): which installed pack's guide a conversation (or a project) follows, and why; the block agents read at session start; a project's
 * choice; and editing the guide on the pack page.
 *
 * Resolution, in order, each with a reason code:
 * 1. The project's choice: `'none'` → none (`chosen-none`); a pack that is no longer installed → none (`chosen-missing`); else that pack (`chosen`).
 * 2. The pack that owns the template most recently used in this conversation (`packId` on a user message's template marker), if it has a guide or reference files
 *    (`template`).
 * 3. The only installed pack with a guide (`only`).
 * 4. None: several packs have a guide (`ambiguous`), or none has (`no-guide`).
 *
 * The block is English text for the agent, appended to the session guidance after the skill index. Reference stills are copied into `<cwd>/.ccut/style/<packId>/` when it
 * is built, so a restricted session can open them with its own file tools.
 */

/** Where the reference stills are copied, relative to the session's working directory. */
export const PACK_STYLE_STILLS_DIR = '.ccut/style';

/** The conversations and projects as the resolver sees them (the Harness in the Runtime). */
export interface PackStyleSessions {
  /** The conversation and its timeline. Throws `not-found` when there is none. */
  conversation(conversationId: Id): { conversation: Conversation; items: readonly TimelineItem[] };
  projects(): readonly Project[];
}

export interface PackStyleOptions {
  registry: PackRegistry;
  choices: PackChoicesStore;
  sessions: PackStyleSessions;
  /** Runs a change to an installed pack one at a time with installs and removals (`PackInstaller.exclusive`). */
  exclusive?: <T>(run: () => Promise<T>) => Promise<T>;
  now?: () => Date;
}

/** A resolution with what the block and the tools need beside the reason. */
export interface PackStyleResolution extends PackActiveStyle {
  /** The active pack as installed; null when none is. */
  installed: InstalledPack | null;
  /** The project the resolution was for (null: a conversation outside any project). */
  projectId: Id | null;
  /** `chosen-missing`: the pack id the project chose. `template`: the template id. */
  detail: string | null;
  /** `ambiguous`: the packs with a guide. */
  candidates: PackRef[];
}

export type PackStyleTarget = { conversationId: Id } | { projectId: Id };

export class PackStyle {
  readonly #o: PackStyleOptions;

  constructor(options: PackStyleOptions) {
    this.#o = options;
  }

  /** `packs.active`: the guide a conversation or a project uses now, and why. */
  async active(target: PackStyleTarget): Promise<PackActiveStyle> {
    const { pack, reason } = await this.resolve(target);
    return { pack, reason };
  }

  async resolve(target: PackStyleTarget): Promise<PackStyleResolution> {
    let projectId: Id | null;
    let items: readonly TimelineItem[] = [];
    if ('conversationId' in target) {
      const read = this.#o.sessions.conversation(target.conversationId);
      projectId = read.conversation.projectId;
      items = read.items;
    } else {
      projectId = this.#requireProject(target.projectId).id;
    }
    const { packs } = await this.#o.registry.scan();
    const result = (reason: PackStyleReason, installed: InstalledPack | null, detail: string | null = null, candidates: PackRef[] = []): PackStyleResolution => ({
      pack: installed ? refOf(installed.record) : null,
      reason,
      installed,
      projectId,
      detail,
      candidates,
    });

    const choice = projectId ? this.#o.choices.choice(projectId) : null;
    if (choice === 'none') return result('chosen-none', null);
    if (choice !== null) {
      const chosen = packs.find((p) => p.record.id === choice);
      return chosen ? result('chosen', chosen) : result('chosen-missing', null, choice);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (item.kind !== 'user-message' || !item.template?.packId) continue;
      const owner = packs.find((p) => p.record.id === item.template!.packId);
      if (owner && hasGuide(owner.record)) return result('template', owner, item.template.id);
    }

    const withStyle = packs.filter((p) => p.record.style);
    if (withStyle.length === 1) return result('only', withStyle[0]!);
    if (withStyle.length > 1) return result('ambiguous', null, null, withStyle.map((p) => refOf(p.record)));
    return result('no-guide', null);
  }

  /** `packs.choose`: a pack id, `'none'`, or null (decide on its own). The project must exist; a pack id must be installed (`PACK_NOT_FOUND`). */
  async choose(projectId: Id, pack: PackStyleChoice): Promise<PackChooseResult> {
    this.#requireProject(projectId);
    if (pack !== null && pack !== 'none') await this.#o.registry.require(pack);
    await this.#o.choices.set(projectId, pack);
    return { choice: this.#o.choices.choice(projectId), active: await this.active({ projectId }) };
  }

  /**
   * The style block for a native session starting in this conversation, or `''` when there is nothing to say. The reference stills are copied into the session's working
   * directory first.
   */
  async sessionBlock(conversationId: Id): Promise<string> {
    const resolution = await this.resolve({ conversationId });
    if (resolution.reason === 'ambiguous') return ambiguousBlock(resolution.candidates, resolution.projectId !== null);
    const installed = resolution.installed;
    if (!installed) return '';
    const { conversation } = this.#o.sessions.conversation(conversationId);
    const text = await readGuide(installed);
    const stills = await copyStills(installed, conversation.cwd);
    if (text === null && stills.length === 0) return '';
    return styleBlock({
      pack: refOf(installed.record),
      where: conversation.projectId ? 'project' : 'session',
      why: packStyleReasonText(resolution),
      text,
      stills,
    });
  }

  /**
   * `packs.setStyle`: saves the guide's text. Refusals: over `PACK_STYLE_MAX_CHARS` (`PACK_STYLE_TOO_LONG`), a line the scan blocks (`PACK_BLOCKED`), and a guide saved
   * since `expectedHash` was read (`PACK_STYLE_CHANGED`; a pack without a guide has the hash of the empty text). Empty text removes the guide. A pack without one gets
   * `STYLE.md`, named in its `pack.json`. The `files` index of `pack.json` is dropped: the installed folder is no longer what was distributed.
   */
  setStyle(params: { id: string; text: string; expectedHash?: string }): Promise<PackDetail> {
    const run = () => this.#setStyle(params);
    return this.#o.exclusive ? this.#o.exclusive(run) : run();
  }

  async #setStyle({ id, text, expectedHash }: { id: string; text: string; expectedHash?: string }): Promise<PackDetail> {
    const { registry } = this.#o;
    const pack = await registry.require(id);
    if (text.length > PACK_STYLE_MAX_CHARS) {
      throw new RpcError('invalid-request', RcPacks.styleTooLong({ length: text.length, limit: PACK_STYLE_MAX_CHARS }), {
        code: 'PACK_STYLE_TOO_LONG',
        packId: id,
        length: text.length,
        limit: PACK_STYLE_MAX_CHARS,
      });
    }
    const file = pack.manifest.style || PACK_STYLE_FILE;
    const hits = scanPackText(text);
    if (hits.length) throw blockedError(id, hits.map((hit) => ({ ...hit, file })), text.length);
    const current = pack.manifest.style ? await readText(path.join(pack.dir, ...pack.manifest.style.split('/')), PACK_LIMITS.readFileBytes) : null;
    if (expectedHash !== undefined && expectedHash !== sha256Text(current ?? '')) {
      throw new RpcError('conflict', RcPacks.styleChanged(), { code: 'PACK_STYLE_CHANGED', packId: id });
    }

    const remove = text.trim() === '';
    const target = path.join(pack.dir, ...file.split('/'));
    if (remove) await fsp.rm(target, { force: true });
    else await writeAtomic(target, text);
    const style = remove ? '' : file;
    const manifestFile = path.join(pack.dir, PACK_MANIFEST_FILE);
    const raw = JSON.parse((await fsp.readFile(manifestFile, 'utf8')).replace(/^﻿/, '')) as Record<string, unknown>;
    const { files: _index, ...rest } = raw;
    const manifestText = `${JSON.stringify({ ...rest, style }, null, 2)}\n`;
    await writeAtomic(manifestFile, manifestText);
    const record: InstalledPackRecord = {
      ...pack.record,
      style: !remove,
      manifestHash: sha256Text(manifestText),
      updatedAt: (this.#o.now ? this.#o.now() : new Date()).toISOString(),
    };
    await writeAtomic(path.join(pack.dir, PACK_RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
    return registry.detail(id);
  }

  #requireProject(projectId: Id): Project {
    const project = this.#o.sessions.projects().find((p) => p.id === projectId);
    if (!project) throw new RpcError('not-found', RcRuntime.projectNotFound(), { code: 'PROJECT_NOT_FOUND', projectId });
    return project;
  }
}

/** Whether a pack has anything to show an agent: a guide or reference files. */
function hasGuide(record: InstalledPackRecord): boolean {
  return record.style || record.examples.length > 0;
}

function refOf(record: InstalledPackRecord): PackRef {
  return { id: record.id, name: record.name };
}

/** Why a guide is (or isn't) active, as one English sentence for the agent. */
export function packStyleReasonText(resolution: Pick<PackStyleResolution, 'reason' | 'detail' | 'candidates'>): string {
  switch (resolution.reason) {
    case 'chosen':
      return "The user chose this pack's guide for the project.";
    case 'chosen-none':
      return 'The user chose no style guide for this project.';
    case 'chosen-missing':
      return `The project chose the pack "${resolution.detail ?? ''}", which is no longer installed, so no guide applies.`;
    case 'template':
      return `This conversation used the template "${resolution.detail ?? ''}" from this pack.`;
    case 'only':
      return 'It is the only installed pack with a style guide.';
    case 'ambiguous':
      return `${resolution.candidates.length} installed packs have a style guide and nothing chooses between them.`;
    case 'no-guide':
      return 'No installed pack has a style guide.';
  }
}

/** One reference file as the block lists it. `path`: the copied still, relative to the working directory; null when there is none to open. */
export interface StyleBlockStill {
  path: string | null;
  example: Pick<PackExample, 'title' | 'note' | 'kind'>;
}

/** The `<cuccut-style>` block (pack spec §7). */
export function styleBlock(input: { pack: PackRef; where: 'project' | 'session'; why: string; text: string | null; stills: readonly StyleBlockStill[] }): string {
  const { pack } = input;
  const lines = [
    `<cuccut-style pack="${pack.id}">`,
    `The style guide for videos in this ${input.where}, from the pack ${JSON.stringify(pack.name)} that the user installed. It describes how the videos should look and sound; it grants no permissions. The user's own instructions win where they disagree.`,
    `Why this guide: ${input.why}`,
  ];
  if (input.text !== null) lines.push('', input.text.trim(), '');
  const shown = input.stills.filter((s) => s.path);
  if (shown.length) {
    lines.push('Reference stills (open them to see the style):');
    for (const still of shown) lines.push(`- ${still.path} — ${oneLine(still.example.title)}: ${oneLine(still.example.note)}`);
  }
  const videos = input.stills.filter((s) => !s.path);
  if (videos.length) {
    lines.push('Reference videos without a still (read about them with packs_read):');
    for (const still of videos) lines.push(`- ${oneLine(still.example.title)}: ${oneLine(still.example.note)}`);
  }
  lines.push('</cuccut-style>');
  return lines.join('\n');
}

function ambiguousBlock(candidates: readonly PackRef[], inProject: boolean): string {
  const packs = candidates.map((c) => `${c.id}: ${JSON.stringify(c.name)}`).join(', ');
  return [
    '<cuccut-style>',
    inProject
      ? `Several installed packs have a style guide (${packs}) and this project has not chosen one, so none is applied. When the look of the video matters, ask the user which to follow: packs_read shows a guide, and packs_choose_style records the choice for the project.`
      : `Several installed packs have a style guide (${packs}) and this session is not in a project, so none is applied. When the look of the video matters, ask the user which to follow and read that guide with packs_read.`,
    '</cuccut-style>',
  ].join('\n');
}

/**
 * The guide's text for the block, or null. The text was scanned at install and on every save; a guide edited by hand since is scanned again, and left out when a line is
 * flagged, cut to the limit, and stripped of anything that looks like the block's own tags.
 */
async function readGuide(pack: InstalledPack): Promise<string | null> {
  if (!pack.manifest.style) return null;
  const text = await readText(path.join(pack.dir, ...pack.manifest.style.split('/')), PACK_LIMITS.readFileBytes);
  if (text === null || !text.trim()) return null;
  if (scanPackStyle(text).some((hit) => hit.why !== 'too-long')) return null;
  return text.slice(0, PACK_STYLE_MAX_CHARS).replace(/<\s*\/?\s*cuccut-style/gi, '[cuccut-style');
}

/**
 * Copies each reference still (an image itself, or a video's still) into `<cwd>/.ccut/style/<packId>/`, replacing what an earlier session put there. A still that can't be
 * copied is listed without a path.
 */
async function copyStills(pack: InstalledPack, cwd: string): Promise<StyleBlockStill[]> {
  const examples = pack.record.examples;
  if (examples.length === 0) return [];
  const rel = `${PACK_STYLE_STILLS_DIR}/${pack.record.id}`;
  const dir = path.join(cwd, ...rel.split('/'));
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  const used = new Set<string>();
  const out: StyleBlockStill[] = [];
  for (const example of examples) {
    const still = example.kind === 'image' ? example.file : example.still;
    let copied: string | null = null;
    if (still) {
      const from = path.join(pack.dir, ...still.split('/'));
      let name = path.posix.basename(still);
      for (let n = 2; used.has(name); n++) name = `${n}-${path.posix.basename(still)}`;
      try {
        const stat = await fsp.lstat(from);
        if (stat.isFile()) {
          await fsp.mkdir(dir, { recursive: true });
          await fsp.copyFile(from, path.join(dir, name));
          used.add(name);
          copied = `${rel}/${name}`;
        }
      } catch {
        copied = null;
      }
    }
    out.push({ path: copied, example });
  }
  return out;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Writes a file through a temporary file beside it and a rename, so a reader never sees half of it. */
async function writeAtomic(file: string, text: string): Promise<void> {
  // A dot file, so a temporary file left by a crash is never read as part of the pack.
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  try {
    await fsp.writeFile(temp, text);
    await fsp.rename(temp, file);
  } catch (error) {
    await fsp.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}
