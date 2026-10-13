import fs from 'node:fs';
import path from 'node:path';
import type { CatalogAgentSkill } from '@cuccut/protocol';
import { CliError } from '../envelope.ts';
import { resolveAgentSkillsDir } from '../runtime/connection.ts';
import { AGENT_HOSTS, HOST_LABELS, hostSkillsDir, parseAgentHost, type AgentHost } from './agent-hosts.ts';
import { defineNoun } from './context.ts';
import { M } from './skills-copy.ts';

/** The directory name of the instructions in the host's skills directory (same as the `id` given by the Runtime). */
const SKILL_ID = 'cuccut';

/**
 * Admin bucket `cuccut skill install|path` (agent-surface design §8.6): installs the instructions for external agents into the host's skills directory. Singular, separate from `skills list|read` in the directory (CucCut's own craft). Rendering happens on the Runtime side (`catalog.agentSkill`; the CLI only goes through the protocol); `path` does not connect to the Runtime.
 */
export const skill = defineNoun({
  name: 'skill',
  verbs: ['install', 'path'],
  offline: ['path'],
  get usage() {
    return M.skillHelp;
  },
  options: {
    agent: { type: 'string' },
    dir: { type: 'string' },
    link: { type: 'boolean' },
    yes: { type: 'boolean' },
  },
  async run(ctx) {
    const [sub, ...extra] = ctx.args;
    if (extra.length > 0) throw ctx.usageError();
    if (sub === 'path') {
      if (ctx.values.agent || ctx.values.dir || ctx.values.link || ctx.values.yes) throw ctx.usageError();
      const result = skillPaths(ctx.env, ctx.home);
      return ctx.done(result, formatSkillPaths(result));
    }
    if (sub !== 'install') throw ctx.usageError();
    const host = ctx.values.agent || !ctx.values.dir ? ctx.parse(() => parseAgentHost(ctx.values.agent)) : null;
    const parent = ctx.values.dir ? ctx.resolve(ctx.values.dir) : hostSkillsDir(host!, ctx.env);
    const target = path.join(parent, SKILL_ID);
    const existing = describeTarget(target);
    if (existing && !ctx.values.yes) {
      throw new CliError('CONFIRMATION_REQUIRED', M.targetExists(target, existing.kind === 'link' ? (existing.linkTarget ?? '') : null), {
        target,
      });
    }
    const skillFiles = await ctx.client.request('catalog.agentSkill', {});
    const linkDir = path.join(ctx.home, 'agent-skills', SKILL_ID);
    const installed = installAgentSkill(skillFiles, target, ctx.values.link ? linkDir : null);
    const result = {
      agent: host,
      target,
      mode: installed.mode,
      ...(installed.linkTo ? { linkTo: installed.linkTo } : {}),
      replaced: existing !== null,
      sourceDir: skillFiles.sourceDir,
      files: skillFiles.files.length,
    };
    const lines = [
      M.installed(target, skillFiles.files.length, installed.linkTo ?? null),
      M.takesEffect(host ? HOST_LABELS[host] : null),
    ];
    return ctx.done(result, lines);
  },
});

export interface SkillTargetState {
  kind: 'link' | 'directory' | 'file';
  linkTarget?: string;
}

/** What the target is now (does not follow links); null if it does not exist. */
export function describeTarget(target: string): SkillTargetState | null {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return null;
  }
  if (stat.isSymbolicLink()) return { kind: 'link', linkTarget: fs.readlinkSync(target) };
  return { kind: stat.isDirectory() ? 'directory' : 'file' };
}

/**
 * Writes the instructions: first writes into a temporary directory next to the same target, then replaces the target (an existing target is deleted only at this point: if it is a link, only the link is deleted). When `linkDir` is given, the rendered result is written into it (replacing the whole thing), and the target gets a link pointing to it (on Windows a junction, which does not need administrator rights; `platform` is only for tests to swap the platform).
 */
export function installAgentSkill(
  skill: Pick<CatalogAgentSkill, 'files'>,
  target: string,
  linkDir: string | null,
  platform: NodeJS.Platform = process.platform,
): { mode: 'copy' | 'link'; linkTo?: string } {
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  if (linkDir) {
    fs.mkdirSync(path.dirname(linkDir), { recursive: true });
    replaceWith(linkDir, (staging) => writeFiles(staging, skill.files));
    replaceWith(target, (staging) => fs.symlinkSync(linkDir, staging, platform === 'win32' ? 'junction' : 'dir'));
    return { mode: 'link', linkTo: linkDir };
  }
  replaceWith(target, (staging) => writeFiles(staging, skill.files));
  return { mode: 'copy' };
}

function writeFiles(dir: string, files: CatalogAgentSkill['files']): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const abs = path.join(dir, ...file.path.split('/'));
    if (!abs.startsWith(dir + path.sep)) throw new Error(M.pathEscapes(file.path));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.content);
  }
}

/** Prepares `staging` next to `target`, then removes the old one and puts the new one in place. If preparing staging fails, the old one is left untouched. */
function replaceWith(target: string, make: (staging: string) => void): void {
  const staging = path.join(path.dirname(target), `.${path.basename(target)}.cuccut-${process.pid}-${Date.now()}`);
  try {
    make(staging);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  removeTarget(target);
  fs.renameSync(staging, target);
}

/** Deletes the target: for a link, only the link itself is removed, not the directory it points to. */
function removeTarget(target: string): void {
  const state = describeTarget(target);
  if (!state) return;
  if (state.kind === 'directory') fs.rmSync(target, { recursive: true, force: true });
  else fs.unlinkSync(target);
}

export interface SkillPaths {
  /** Source of the instructions (`<…>/skills/cuccut`); null if not found. */
  sourceDir: string | null;
  /** Where the rendered result goes with `--link`. */
  linkDir: string;
  hosts: { agent: AgentHost; target: string; installed: SkillTargetState | null }[];
}

export function skillPaths(env: NodeJS.ProcessEnv, home: string): SkillPaths {
  const root = resolveAgentSkillsDir(env);
  return {
    sourceDir: root ? path.join(root, SKILL_ID) : null,
    linkDir: path.join(home, 'agent-skills', SKILL_ID),
    hosts: AGENT_HOSTS.map((agent) => {
      const target = path.join(hostSkillsDir(agent, env), SKILL_ID);
      return { agent, target, installed: describeTarget(target) };
    }),
  };
}

export function formatSkillPaths(paths: SkillPaths): string[] {
  const lines = [
    M.sourceLine(paths.sourceDir),
    `--link    ${paths.linkDir}`,
    '',
  ];
  const width = Math.max(...paths.hosts.map((host) => HOST_LABELS[host.agent].length));
  for (const host of paths.hosts) {
    const state = !host.installed
      ? M.notInstalled
      : host.installed.kind === 'link'
        ? M.linkState(host.installed.linkTarget ?? '')
        : host.installed.kind === 'directory'
          ? M.installedFolder
          : M.isFile;
    lines.push(`${HOST_LABELS[host.agent].padEnd(width)}  ${host.target}  ${state}`);
  }
  return lines;
}
