import {
  isDriverId,
  localizeText,
  recommendedDriverModel,
  type DriverId,
  type DriverInfo,
  type DriverModel,
  type DriverState,
  type ModelTier,
} from '@cuccut/protocol';
import { AGENT_PICKER, DRIVER_STATE_REASON, EFFORT_COPY, MODEL_TIER_LABEL } from '../copy.ts';
import { listedInPicker } from './agent-catalog.ts';

/**
 * Agent · model · reasoning effort selection in the input area (prototype agent-picker.jsx, model-agent.js `providerRows` / `modelRows` / `harnessLabel`).
 * This only computes rows and copy. What was chosen is recorded in the Runtime for a built session, and in shell-store for a new session's draft.
 */

/**
 * The selection on a new session draft. Fields that were never chosen do not appear, and are not passed when the session is created, so the Runtime supplies defaults (default agent, its default model and effort).
 * `model: null` explicitly means “Agent default model” (no model passed; follows the CLI configuration); `effort: null` means the model's own default effort.
 */
export interface AgentChoice {
  driverId?: DriverId;
  model?: string | null;
  effort?: string | null;
}

/** One change made in the picker. Switching agents always includes the model. */
export interface AgentChange {
  driverId: DriverId;
  model?: string | null;
  effort?: string | null;
}

/** Reads back the persisted draft selection: agent ids in the wrong format and fields of the wrong type are dropped (an unregistered agent is rejected by the Runtime when the session is created). */
export function parseAgentChoice(value: unknown): AgentChoice | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const choice: AgentChoice = {};
  if (isDriverId(raw.driverId)) choice.driverId = raw.driverId;
  if (raw.model === null || typeof raw.model === 'string') choice.model = raw.model;
  if (raw.effort === null || typeof raw.effort === 'string') choice.effort = raw.effort;
  return Object.keys(choice).length ? choice : null;
}

/**
 * The default model a new session will actually use (design spec model-agent-setup.js `defaultModel`): if `DriverInfo.defaultModel` was never set, it is already the recommended model; null means “Agent default model” was explicitly chosen. If a set model has disappeared from the model table, the Runtime uses the recommended model when it creates the session, so the recommended one is substituted here too.
 * When the model table is empty (nothing detected yet), this cannot be judged, so the value is returned as is.
 */
export function effectiveDefaultModel(driver: Pick<DriverInfo, 'id' | 'models' | 'defaultModel'>): string | null {
  const saved = driver.defaultModel;
  if (saved === null || driver.models.length === 0 || driver.models.some((m) => m.id === saved)) return saved;
  return recommendedDriverModel(driver.id, driver.models)?.id ?? saved;
}

/** The model and effort the draft currently uses: the chosen ones if any were chosen, otherwise the default this agent's new session would actually use (matching how the Runtime picks it when creating a session). */
export function draftSelection(driver: DriverInfo | null, choice: AgentChoice | undefined): { model: string | null; effort: string | null } {
  const mine = !!choice && (choice.driverId === undefined || choice.driverId === driver?.id);
  return {
    model: mine && choice && 'model' in choice ? (choice.model ?? null) : driver ? effectiveDefaultModel(driver) : null,
    effort: mine && choice && 'effort' in choice ? (choice.effort ?? null) : (driver?.defaultEffort ?? null),
  };
}

/** Applies one change on top of a draft. If the agent was switched, the previous model and effort no longer apply, so only the values given in this change are kept. */
export function applyAgentChange(choice: AgentChoice | undefined, current: DriverId | null, change: AgentChange): AgentChoice {
  if (change.driverId !== current) {
    const next: AgentChoice = { driverId: change.driverId };
    if (change.model !== undefined) next.model = change.model;
    if (change.effort !== undefined) next.effort = change.effort;
    return next;
  }
  return { ...choice, driverId: change.driverId, ...pick(change) };
}

function pick(change: AgentChange): Partial<AgentChoice> {
  const out: Partial<AgentChoice> = {};
  if (change.model !== undefined) out.model = change.model;
  if (change.effort !== undefined) out.effort = change.effort;
  return out;
}

/**
 * A model change: the current effort is kept if the new model also offers it; otherwise it falls back to the model's own default (null).
 * If the new model is not recognized (not in the list), it also falls back to the default rather than guessing.
 */
export function modelChange(driver: DriverInfo, model: string | null, effort: string | null): AgentChange {
  const next = effectiveModel(driver, model);
  const keeps = effort !== null && !!next?.efforts.some((e) => e.id === effort);
  return { driverId: driver.id, model, effort: keeps ? effort : null };
}

/** The model that will actually be used this time: the chosen one; if none was chosen, the one from the CLI configuration, and failing that, the default the agent itself marks. */
export function effectiveModel(driver: DriverInfo | null, model: string | null): DriverModel | undefined {
  if (!driver) return undefined;
  if (model !== null) return driver.models.find((m) => m.id === model);
  return driver.models.find((m) => m.id === driver.configModel) ?? driver.models.find((m) => m.isDefault);
}

export function modelLabel(driver: DriverInfo | null, model: string | null): string {
  if (model === null) return AGENT_PICKER.agentDefault;
  return driver?.models.find((m) => m.id === model)?.label ?? model;
}

/** Label shown when the picker is collapsed (prototype `harnessLabel`): `Claude Code · Sonnet`. */
export function harnessLabel(driver: DriverInfo | null, model: string | null): string {
  if (!driver) return AGENT_PICKER.detecting;
  return `${driver.name} · ${modelLabel(driver, model)}`;
}

/** A vendor or family name at the start of a model name is removed when more words follow it (`Claude Opus 5.5` → `Opus`, `GPT-5.6 Sol` → `Sol`). */
const MODEL_BRAND_WORDS = new Set(['claude', 'gpt', 'gemini', 'grok', 'kimi', 'codex']);

/**
 * When the input area is narrow, the model shows only its tier name, without the version number (prototype model-agent.js `compactModelLabel`, product design §3.2.3):
 * strip trailing annotations such as `[1m]` and `(1M context)`, split capitalized words apart with hyphens (`GPT-6.1-Sol`), then drop words containing digits (versions) and the leading vendor name.
 * Names it cannot recognize (what remains is not one or two words, the original name has more than four words, or it is a whole all-lowercase id such as `gpt-6.1-sol`) are returned as is and truncated by the style.
 */
export function compactModelLabel(label: string): string {
  const full = label.trim();
  const bare = full.replace(/(\s*(\[[^\]]*\]|\([^)]*\)))+$/, '').trim();
  const words = bare
    .split(/\s+/)
    .flatMap((word) => (/[A-Z]/.test(word) ? word.split('-') : [word]))
    .filter(Boolean);
  if (!words.length || words.length > 4) return full;
  if (words.length === 1) return /\d/.test(words[0]!) ? full : words[0]!;
  const kept = words.filter((word) => !/\d/.test(word));
  const named = kept.length > 1 && MODEL_BRAND_WORDS.has(kept[0]!.toLowerCase()) ? kept.slice(1) : kept;
  if (!named.length || named.length > 2 || named.some((word) => !/^\p{L}[\p{L}'’.-]*$/u.test(word))) return full;
  return named.join(' ');
}

/** Label shown when collapsed and the agent is only an icon: only the model is shown here. “Agent default model” becomes “Default” (默认); anything else uses the tier name. */
export function compactHarnessLabel(driver: DriverInfo | null, model: string | null): string {
  if (!driver) return AGENT_PICKER.detecting;
  if (model === null) return AGENT_PICKER.defaultMark;
  return compactModelLabel(modelLabel(driver, model));
}

/** Agent icon (lobe-icons, `components/vendor-icons/<file>.svg`): mono icons take the text color; colored ones are shown as they are. */
export type AgentIconSpec = { kind: 'vendor'; file: string; mono: boolean } | { kind: 'letter'; letter: string };

/** Built-in agent → icon file (the same table as prototype model-vendors.js `AGENT_ICONS`). */
export const AGENT_ICON_FILES: Readonly<Record<string, { file: string; mono: boolean }>> = {
  claude: { file: 'anthropic', mono: true },
  codex: { file: 'codex', mono: false },
  copilot: { file: 'githubcopilot', mono: true },
  pi: { file: 'pi', mono: true },
  opencode: { file: 'opencode', mono: true },
  gemini: { file: 'google', mono: false },
  cursor: { file: 'cursor', mono: true },
  grok: { file: 'xai', mono: true },
  kimi: { file: 'moonshot', mono: true },
};

/** Which icon this agent uses: built-in ones are looked up in the table; user-added ACP agents (and any without an icon) use the first letter of their name. */
export function agentIcon(driver: Pick<DriverInfo, 'id' | 'name'> & { source?: DriverInfo['source'] }): AgentIconSpec {
  const known = driver.source === 'custom' ? undefined : AGENT_ICON_FILES[driver.id];
  if (known) return { kind: 'vendor', ...known };
  const letter = [...(driver.name.trim() || driver.id)][0] ?? '?';
  return { kind: 'letter', letter: letter.toLocaleUpperCase() };
}

/** The first segment of the account description, with status words such as “logged in” (已登录) removed; “This machine” (本机) when there is none. */
export function accountLabel(driver: DriverInfo): string {
  return (localizeText(driver.account, driver.accountRef) ?? '').split(' · ')[0]!.trim() || AGENT_PICKER.localAccount;
}

/** Row status (prototype `providerState`): usable, not installed, needs attention (not logged in / too old / error), or disabled in Settings. The icon at the end of the row is drawn from this. */
export type ProviderState = 'ready' | 'missing' | 'attention' | 'off';

export function providerState(state: DriverState): ProviderState {
  if (state === 'ready') return 'ready';
  if (state === 'not-installed') return 'missing';
  return state === 'disabled' ? 'off' : 'attention';
}

export interface ProviderRow {
  id: DriverId;
  name: string;
  sub: string;
  state: ProviderState;
  /** Can proceed to pick a model at the second level. */
  ready: boolean;
  /** The session has already started, so it cannot be switched to this agent. */
  locked: boolean;
  selected: boolean;
}

/**
 * Level one: one row per agent (prototype `providerRows`). Usable agents show the current model and account; unusable ones show the reason, and tapping goes to Settings.
 * `lockedTo`: once the session has a task, the agent is fixed; other agents' rows show why they cannot be selected.
 * The four “More” agents and user-added agents are not listed when not detected (`listedInPicker`); the one currently selected is still listed, so the collapsed label has a matching row.
 */
export function providerRows(
  drivers: readonly DriverInfo[],
  selected: DriverId | null,
  model: string | null,
  lockedTo: DriverId | null,
): ProviderRow[] {
  return drivers
    .filter((driver) => driver.id === selected || listedInPicker(driver))
    .map((driver) => {
      const isSelected = driver.id === selected;
      const ready = driver.state === 'ready';
      const locked = lockedTo !== null && driver.id !== lockedTo;
      const sub = locked
        ? AGENT_PICKER.locked
        : driver.state === 'ready'
          ? `${isSelected ? `${modelLabel(driver, model)} · ` : ''}${accountLabel(driver)}`
          : DRIVER_STATE_REASON[driver.state];
      return { id: driver.id, name: driver.name, sub, state: providerState(driver.state), ready, locked, selected: isSelected };
    });
}

export interface ModelRow {
  /** null = Agent default model. */
  model: string | null;
  label: string;
  sub: string | null;
}

const TIER_ORDER: ModelTier[] = ['balanced', 'max', 'fast'];

/**
 * Placement of model labels (design spec model-agent-setup.js `modelChoices`, `tierOf`): “Recommended” is attached only to the one selected in `recommendedDriverModel`; other `balanced` models in the table are not labeled. “Most capable” and “Fastest” follow the model table. The default-model dropdown in Settings uses the same rule.
 */
export function modelTierOf(driver: Pick<DriverInfo, 'id' | 'models'>): (model: DriverModel) => ModelTier | null {
  const recommended = recommendedDriverModel(driver.id, driver.models)?.id ?? null;
  return (model) => (model.id === recommended ? 'balanced' : model.tier === 'balanced' ? null : (model.tier ?? null));
}

/**
 * Model table at the second level (prototype `modelRows`): starts with “Agent default model”; a selected model that is not in the list is still shown.
 * The rest are sorted by tier (recommended, most capable, fastest, then unlabeled), and the secondary text shows each tier and the agent's own default.
 */
export function modelRows(driver: DriverInfo, selected: string | null): ModelRow[] {
  const config = driver.configModel;
  const defaultSub =
    config && driver.configModelKnown === false
      ? `${AGENT_PICKER.agentDefaultSub} · ${AGENT_PICKER.configModelGate(config)}`
      : config
        ? `${AGENT_PICKER.agentDefaultSub} · ${modelLabel(driver, config)}`
        : AGENT_PICKER.agentDefaultSub;
  const rows: ModelRow[] = [{ model: null, label: AGENT_PICKER.agentDefault, sub: defaultSub }];
  if (selected !== null && !driver.models.some((m) => m.id === selected)) {
    rows.push({ model: selected, label: selected, sub: AGENT_PICKER.notListed });
  }
  // Order follows the model table's own tiers; only the recommended one gets the “Recommended” label (`modelTierOf`).
  const tierOf = modelTierOf(driver);
  const rank = (m: DriverModel) => (m.tier ? TIER_ORDER.indexOf(m.tier) : TIER_ORDER.length);
  const sorted = driver.models.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i);
  for (const { m } of sorted) {
    const tier = tierOf(m);
    const sub = [tier ? MODEL_TIER_LABEL[tier] : null, m.isDefault ? AGENT_PICKER.defaultMark : null].filter(Boolean).join(' · ');
    rows.push({ model: m.id, label: m.label, sub: sub || null });
  }
  return rows;
}

/** Chinese labels for reasoning effort: 低 (low), 中 (medium), 高 (high). Unrecognized values are shown as is (native label; if there is none, the id). */
export function effortLabel(id: string, nativeLabel?: string | null): string {
  return EFFORT_COPY[id]?.label ?? (nativeLabel || id);
}

export interface EffortRow {
  id: string;
  label: string;
  sub: string | null;
}

/** The reasoning effort options for this model (dropdown from prototype data.js `efforts`). The row for the model's own default is labeled “Default”. Empty table = no effort levels. */
export function effortRows(model: DriverModel | undefined): EffortRow[] {
  if (!model) return [];
  return model.efforts.map((effort) => {
    const sub = [EFFORT_COPY[effort.id]?.sub ?? null, effort.id === model.defaultEffort ? AGENT_PICKER.defaultMark : null]
      .filter(Boolean)
      .join(' · ');
    return { id: effort.id, label: effortLabel(effort.id, effort.label), sub: sub || null };
  });
}

/** The effort currently in effect: the chosen one; if none was chosen, the model's own default. */
export function currentEffort(model: DriverModel | undefined, effort: string | null): string | null {
  return effort ?? model?.defaultEffort ?? null;
}
