import { defineMessages, templateUnfilledText, type DriverId, type DriverInfo } from '@cuccut/protocol';
import type { HomeTemplate } from './home-templates.ts';
import { kindOfFileName } from './space.ts';
import { zhHans } from './home-brief.zh-Hans.ts';
import { zhHant } from './home-brief.zh-Hant.ts';
import { ja } from './home-brief.ja.ts';
import { ko } from './home-brief.ko.ts';
import { es } from './home-brief.es.ts';
import { fr } from './home-brief.fr.ts';
import { de } from './home-brief.de.ts';
import { nl } from './home-brief.nl.ts';
import { ptBR } from './home-brief.pt-BR.ts';
import { it } from './home-brief.it.ts';
import { ru } from './home-brief.ru.ts';
import { pl } from './home-brief.pl.ts';
import { tr } from './home-brief.tr.ts';
import { vi } from './home-brief.vi.ts';

/** Copy for the start page brief (the English is the source of keys and types; translations are in `home-brief.zh-Hans.ts`). */
const en = {
  about: (minutes: number, seconds: number) =>
    `About ${[minutes ? `${minutes} min` : '', seconds ? `${seconds} sec` : ''].filter(Boolean).join(' ')}`,
  fromMaterials: 'Make a video from the materials I attached.',
  materials: (paths: readonly string[]) => `Materials: ${paths.join(', ')}`,
  connectFirst: 'Connect AI first',
  sayFirst: 'Say what you want to make, or attach materials',
  agentOffTitle: 'All installed coding agents are turned off',
  agentOffBody: 'A coding agent is installed on this computer but turned off in Settings. Turn one on to start right here.',
  enableNamed: (name: string) => `Turn on ${name}`,
  enableAgent: 'Turn on Agent',
  agentMissingTitle: 'This needs a coding agent',
  agentMissingBody: 'Install Claude Code or Codex CLI and sign in with your own subscription, then come back here to start.',
  connectAgent: 'Connect Agent',
  nameEmpty: 'Enter a project name',
  nameInvalid: 'The project name can’t contain slashes or control characters',
};
export type HomeBriefMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The text the Home start page hands to the Agent (product design §3.2.1; prototype designs/cuccut/app/model-newproject.js
 * `homePrompt`, `canStart`, `aiGate`, `gateGuide`). Aspect ratio and duration are not set on the start page: the Agent works them out from the user's words, and if not mentioned, decides them from the content.
 * When a scene template (model/home-templates.ts) is sent, it goes to the Runtime as the `template` of `conversations.send`; the template's default aspect ratio and duration, the prompt body and the brief guidance are assembled by the Runtime (template pack spec §5.2), so they are not written into this text, and they do not replace what the user wants to say.
 */

/** Duration on template cards: “about 1 minute”, “about 1 minute 30 seconds”, “about 45 seconds”; null when not given (or not a positive number). */
export function lengthLabel(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return M.about(minutes, rest);
}

export interface HomeBriefOptions {
  /** Number of images attached to the message. */
  images: number;
  /** Local material paths handed to the Agent (videos, audio, documents). */
  materials: readonly string[];
}

/**
 * The body sent to the Agent: the user's own words (if none were written and only material was attached, one sentence is added; this applies whether or not a template is attached: `text` is still required per spec §5.2), plus the material lines.
 * An attached scene template is not written in here: it travels with the `template` of `conversations.send`, and the message in the session carries a template marker separately.
 * Material is written into the body by its absolute local path: the Agent uses CucCut's import tool to bring the files into the project by path (paths outside the project require your agreement first).
 * An unfilled slot `{{label}}` is written as “[label]” (spec §5.5): sending is not blocked, and the Agent treats it as a missing brief item and asks first.
 */
export function homeBrief(text: string, options: HomeBriefOptions): string {
  const own = templateUnfilledText(text).trim();
  const attached = options.images + options.materials.length;
  const parts = [
    own || (attached ? M.fromMaterials : ''),
    options.materials.length ? M.materials(options.materials) : '',
  ];
  return parts.filter(Boolean).join('\n');
}

/** Whether the start page can begin: an Agent is available, and the user has written something or attached material. Choosing a template alone does not count: a template does not replace what you want to say. */
export function canStartHome(input: { text: string; images: number; materials: number; gate: HomeGate | null }): {
  ok: boolean;
  why: string | null;
} {
  if (input.gate && !input.gate.ok) return { ok: false, why: M.connectFirst };
  if (input.text.trim() || input.images || input.materials) return { ok: true, why: null };
  return { ok: false, why: M.sayFirst };
}

/**
 * Whether any Agent is usable (prototype `aiGate`): one ready Agent is enough.
 * When none are usable there are two cases: installed but only disabled in Settings (`disabled` appears only when detection is ready and the preference is disabled) → enable it;
 * everything else (not installed, outdated version, not signed in, error) → go to Settings › Agent connection.
 */
export type HomeGate =
  | { ok: true }
  | { ok: false; reason: 'agent-off'; enable: { id: DriverId; name: string } | null }
  | { ok: false; reason: 'agent-missing' };

/**
 * When `drivers` is null (the list has not been fetched yet), no conclusion is drawn; if one is already ready, that counts as usable. When none is ready but some driver is still in its first detection (`checking`),
 * no conclusion is drawn either: it may be the one that works, so the “Install an Agent” guidance card does not flash first.
 */
export function homeGate(
  drivers: readonly Pick<DriverInfo, 'id' | 'name' | 'state'>[] | null,
  checking: readonly DriverId[],
): HomeGate | null {
  if (!drivers) return null;
  if (drivers.some((d) => d.state === 'ready')) return { ok: true };
  if (checking.length) return null;
  const off = drivers.find((d) => d.state === 'disabled');
  if (off) return { ok: false, reason: 'agent-off', enable: { id: off.id, name: off.name } };
  return { ok: false, reason: 'agent-missing' };
}

export interface GateGuide {
  title: string;
  body: string;
  /** Primary button: enables the disabled Agent, or goes to Settings › Agent. */
  action: string;
  enable: { id: DriverId; name: string } | null;
}

/** The guidance card below the start page when the Agent cannot be used (prototype `gateGuide`'s agent-off / agent-missing). */
export function gateGuide(gate: HomeGate | null): GateGuide | null {
  if (!gate || gate.ok) return null;
  if (gate.reason === 'agent-off') {
    return {
      title: M.agentOffTitle,
      body: M.agentOffBody,
      action: gate.enable ? M.enableNamed(gate.enable.name) : M.enableAgent,
      enable: gate.enable,
    };
  }
  return {
    title: M.agentMissingTitle,
    body: M.agentMissingBody,
    action: M.connectAgent,
    enable: null,
  };
}

/** Settings on the start page not yet sent: the chosen template, and the local material handed to the Agent. */
export interface HomeBriefState {
  /** ID of the attached scene template (from the template catalogue, model/home-templates.ts). Example works are not attached: their prompt goes straight into the input box. */
  template: string | null;
  materials: readonly HomeMaterial[];
}

export const EMPTY_HOME_BRIEF: HomeBriefState = { template: null, materials: [] };

/** Attaches or removes a scene template (prototype page-new.jsx `pickScene`); material is left unchanged. */
export function pickTemplate(state: HomeBriefState, template: Pick<HomeTemplate, 'id'> | null): HomeBriefState {
  return { ...state, template: template ? template.id : null };
}

/** One local material item handed to the Agent. */
export interface HomeMaterial {
  path: string;
  name: string;
  kind: 'media' | 'image' | 'document';
}

/** Maximum number of material items per send (the prototype `AgentHero` is also 8). */
export const MAX_HOME_MATERIALS = 8;

export function materialOf(path: string): HomeMaterial {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const kind = kindOfFileName(name);
  return { path, name, kind: kind === 'video-file' || kind === 'audio' ? 'media' : kind === 'image' ? 'image' : 'document' };
}

/** Merges in new material: each path is kept only once, items beyond the limit are not accepted, and the number returned is reported. */
export function addMaterials(list: readonly HomeMaterial[], paths: readonly string[]): { list: HomeMaterial[]; rejected: number } {
  const next = [...list];
  let rejected = 0;
  for (const path of paths) {
    if (!path || next.some((m) => m.path === path)) continue;
    if (next.length >= MAX_HOME_MATERIALS) rejected++;
    else next.push(materialOf(path));
  }
  return { list: next, rejected };
}

/**
 * Name validation for creating a new project (the name part of the prototype model-agent-projects.js `dirCreationError`): empty names, `.`/`..`, and names with slashes or control characters are rejected.
 * The save location is set by the Runtime under the project root (`projects.create` takes only a name), so the parent directory is not validated here.
 */
export function projectNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return M.nameEmpty;
  if (trimmed === '.' || trimmed === '..' || /[/\\\u0000-\u001f]/.test(name)) return M.nameInvalid;
  return null;
}
