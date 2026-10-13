import {
  localizeText,
  type ImageModelInfo,
  type ModelBundleStatus,
  type ModelCapabilitiesView,
  type ModelComponentStatus,
  type ModelLicense,
  type MusicModelInfo,
} from '@cuccut/protocol';
import type { ModelCategory } from './settings-nav.ts';
import { M } from './models-local-copy.ts';

/**
 * Model › Local models (design draft settings-local.jsx): model packs in the `models` theme are split by class into “Installed / Downloadable” (whether their own files are on disk, see
 * `localGroups`), plus the default-model menu.
 * Confirmations, progress and remediation for install, repair and removal are in models-install.ts; checks are in model-check.ts.
 */

/** ID of the local Provider (packages/models/src/local-source.ts). */
export const LOCAL_PROVIDER = 'local';

/** Local text-to-image models: model pack ID → description (“Test draw” reads the prompt length limit and availability). */
export function localImageModels(view: ModelCapabilitiesView | null): Map<string, ImageModelInfo> {
  const local = view?.generateImage.providers.find((p) => p.providerId === LOCAL_PROVIDER);
  return new Map((local?.models ?? []).map((m) => [m.modelId, m]));
}

/** Local music-generation models (by model pack ID): ones not yet fully installed are included too; `available` says whether they can be used. */
export function localMusicModels(view: ModelCapabilitiesView | null): Map<string, MusicModelInfo> {
  const local = view?.generateMusic.providers.find((p) => p.providerId === LOCAL_PROVIDER);
  return new Map((local?.models ?? []).map((m) => [m.modelId, m]));
}

/** Which class a model pack belongs to: transcription, alignment and speaker diarization are speech recognition; synthesis is speech synthesis; text-to-image is image generation; separation is audio source separation. */
export function bundleCategory(bundle: Pick<ModelBundleStatus, 'capability'>): ModelCategory {
  switch (bundle.capability) {
    case 'transcribe':
    case 'align':
    case 'diarize':
      return 'asr';
    case 'synthesize':
      return 'tts';
    case 'image':
      return 'image';
    case 'music':
      return 'music';
    case 'separate':
      return 'sep';
  }
}

export interface LocalGroups {
  installed: ModelBundleStatus[];
  available: ModelBundleStatus[];
}

/**
 * Whether the model pack is installed (usable): counts when all required components are installed (including ones that failed to load, were disabled, or failed verification); without component info, go by status, and `not-installed` and ones in their first download don't count. Grouping ignores this: a pack with weights present but missing common components is still under “Installed” (`localGroups`).
 */
export function isBundleInstalled(bundle: Pick<ModelBundleStatus, 'state' | 'components'>): boolean {
  const required = bundle.components?.filter((c) => !c.optional);
  if (required?.length) return required.every((c) => c.state === 'installed');
  return bundle.state !== 'not-installed' && bundle.state !== 'downloading';
}

/**
 * Components to download for “Complete” (design draft settings-local.jsx `half`): the pack's own files are on disk (`ownFiles`, see `hasOwnFiles`; by default, counts as not installed if it is installed), and some components are still missing. An installed pack only lacks optional components (aligner, speaker model) and works as usual; adding them gives word-level timing and cross-chunk speaker merging; with weights present but common components missing, adding them is what makes it usable. `models.install` downloads only the missing pieces. Packs whose own files are not present, or that can't run on this computer, are not counted (the former uses “Download”, and the latter wouldn't be usable even after adding).
 */
export function missingParts(
  bundle: Pick<ModelBundleStatus, 'state' | 'reason' | 'components'>,
  ownFiles = isBundleInstalled(bundle),
): ModelComponentStatus[] {
  if (!ownFiles || bundle.reason === 'unsupported' || bundle.reason === 'worker-missing') return [];
  return (bundle.components ?? []).filter((c) => c.state === 'missing');
}

/** Human-readable name of the component; falls back to the component name if not listed. */
export function componentLabel(component: string): string {
  return M.componentName[component] ?? component;
}

/** One-sentence description of what the component does (the line on common components); null if not listed. */
export function componentDesc(component: string): string | null {
  return M.componentDesc[component] ?? null;
}

/**
 * Where the component is downloaded from (the component line in details): GitHub release pages (the audio.cpp engine for music model packs) read “GitHub release <repo> <tag>”, with the tag verbatim;
 * model repos read `<repo>@<first 7 characters of the commit hash>`.
 */
export function componentSource(c: Pick<ModelComponentStatus, 'repo' | 'revision' | 'origin'>): string {
  return c.origin === 'github-release' ? M.githubRelease(c.repo, c.revision) : `${c.repo}@${c.revision.slice(0, 7)}`;
}

/**
 * Model packs of this class are split into “Installed / Downloadable” (design draft model-local-models.js `catalog`): those with their own files on disk (`hasOwnFiles`) are under “Installed”, as are those whose weights are present but whose common components are missing, with a “Complete” action on their row. `placed`: the group a downloading model pack was last placed in (true means “Installed”). The Runtime updates the status each time a component is installed; on the first download the weights arrive first, so the row jumps to “Installed” partway through the download. A remembered placement stays where it was remembered; once the download ends (or is discarded), it is grouped by files again.
 */
export function localGroups(
  bundles: readonly ModelBundleStatus[],
  category: ModelCategory,
  placed?: ReadonlyMap<string, boolean>,
): LocalGroups {
  const mine = bundles.filter((b) => bundleCategory(b) === category).sort((a, b) => a.bundleId.localeCompare(b.bundleId));
  const shared = sharedComponents(bundles, category);
  const installed = (b: ModelBundleStatus) => (b.install ? placed?.get(b.bundleId) : undefined) ?? hasOwnFiles(b, shared);
  return { installed: mine.filter(installed), available: mine.filter((b) => !installed(b)) };
}

/** Which group a downloading model pack is in this time: passed to the next `placed` of `localGroups`. */
export function installingPlacement(groups: LocalGroups): Map<string, boolean> {
  const placed = new Map<string, boolean>();
  for (const b of groups.installed) if (b.install) placed.set(b.bundleId, true);
  for (const b of groups.available) if (b.install) placed.set(b.bundleId, false);
  return placed;
}

export type ChipTone = 'accent' | 'positive' | 'notice' | 'negative' | 'neutral';
export interface ModelChip {
  label: string;
  tone: ChipTone;
}

/**
 * Labels for a model pack row: default, Worker status, reason it is unavailable, and missing components (`missingParts`; `ownFiles` is the same). Nothing is added for “installed but not loaded”; a downloading pack doesn't say what is missing.
 */
export function bundleChips(bundle: ModelBundleStatus, isDefault: boolean, ownFiles = isBundleInstalled(bundle)): ModelChip[] {
  const chips: ModelChip[] = isDefault ? [{ label: M.chipDefault, tone: 'accent' }] : [];
  switch (bundle.state) {
    case 'loading':
      chips.push({ label: M.chipLoading, tone: 'neutral' });
      break;
    case 'ready':
      chips.push({ label: M.chipReady, tone: 'positive' });
      break;
    case 'busy':
      chips.push({ label: M.chipBusy, tone: 'neutral' });
      break;
    case 'unloading':
      chips.push({ label: M.chipUnloading, tone: 'neutral' });
      break;
    case 'error':
      chips.push({ label: bundle.reason ? M.reason[bundle.reason] : M.chipUnavailable, tone: 'negative' });
      break;
    case 'not-installed':
      // Show a hint for a pack that was installed but whose files are wrong; never-installed packs get no label. Missing components (`incomplete`) are spelled out by the “Missing …” text below, which says which pieces; a pack whose common components were installed by someone else, with none of its own, also doesn't count as installed.
      if (bundle.reason && bundle.reason !== 'missing-manifest' && bundle.reason !== 'incomplete') {
        chips.push({ label: M.reason[bundle.reason], tone: 'notice' });
      }
      break;
    case 'installed':
      break;
  }
  const missing = bundle.install && bundle.install.state !== 'paused' ? [] : missingParts(bundle, ownFiles);
  if (missing.length) chips.push({ label: M.chipMissing(missing.map((c) => componentLabel(c.component))), tone: 'notice' });
  return chips;
}

const BACKEND_LABEL: Record<ModelBundleStatus['backend'], string> = { mlx: 'MLX', coreml: 'Core ML', candle: 'Candle', ggml: 'GGML', 'audio-cpp': 'audio.cpp' };

/** One-line facts for a model pack row: purpose · backend · device · notes. */
export function bundleFacts(bundle: ModelBundleStatus): string {
  return [M.capability[bundle.capability], BACKEND_LABEL[bundle.backend], bundle.device, localizeText(bundle.detail, bundle.detailRef)]
    .filter(Boolean)
    .join(' · ');
}

/** A model pack disabled after repeated crashes, or that failed to load, can be re-enabled (`models.enable`). It clears the verification record so the next load re-verifies, so only call it at that point. */
export function canReenable(bundle: Pick<ModelBundleStatus, 'state' | 'reason'>): boolean {
  return bundle.state === 'error' && (bundle.reason === 'resource' || bundle.reason === 'load-failed');
}

/** Key for the “Auto select” item in the local page's default menu. */
export const AUTO_DEFAULT = 'auto';

export interface LocalDefaultPicker {
  /** null: no item is checked. The default is a cloud or node model (the Picker shows `other`), or speech synthesis has no default set yet (shows “Not set”). */
  selectedKey: string | null;
  items: { key: string; label: string }[];
  /** Name (provider · model) of the default when it is not a local model. */
  other: string | null;
  /** Which local model “Auto select” currently resolves to. */
  autoUses: string | null;
  /** Whether the menu has “Auto select”: speech recognition and source separation have factory defaults (architecture design §6.2); speech synthesis does not. */
  hasAuto: boolean;
}

/** The kinds of model packs the local page can set as default, and their names in the capability view. */
export type LocalDefaultCapability = 'transcribe' | 'synthesize' | 'image' | 'separate' | 'music';
export const VIEW_CAPABILITY = {
  transcribe: 'transcribe',
  synthesize: 'synthesizeSpeech',
  image: 'generateImage',
  separate: 'separateAudio',
  music: 'generateMusic',
} as const;

/** Human-readable name of a model pack: registered packs all have `label`; older snapshots without it fall back to `bundleId`. */
export function bundleName(bundle: Pick<ModelBundleStatus, 'bundleId' | 'label'>): string {
  return bundle.label ?? bundle.bundleId;
}

/**
 * Default model menu on the local page.
 * - Speech recognition and source separation: “Auto select” = no default set, using the factory-default local model pack; the rest are the installed packs of this class.
 * - Speech synthesis, image generation and music generation: no factory default (architecture design §6.2), so there is no “Auto select” in the menu; if none is set, or the one set is no longer selectable, nothing is checked and it shows “Not set”; only installed packs of this class are listed.
 *   To clear the default, choose “Choose each time” on the cloud page.
 * Each capability has only one default value, shared with the cloud page. When the default is a cloud or node model, nothing is checked here, stated honestly; choosing a local one replaces it.
 */
export function localDefaultPicker(
  view: ModelCapabilitiesView | null,
  bundles: readonly ModelBundleStatus[],
  kind: LocalDefaultCapability = 'transcribe',
): LocalDefaultPicker {
  const hasAuto = kind === 'transcribe' || kind === 'separate';
  // Speech recognition and source separation keep the original rule (listed unless the status is not-installed); speech synthesis and image generation only list packs that are fully installed, and ones in their first download don't count.
  const installed = bundles.filter((b) => b.capability === kind && (hasAuto ? b.state !== 'not-installed' : isBundleInstalled(b)));
  const items = [...(hasAuto ? [{ key: AUTO_DEFAULT, label: M.auto }] : []), ...installed.map((b) => ({ key: b.bundleId, label: bundleName(b) }))];
  const capability = view?.[VIEW_CAPABILITY[kind]];
  const effective = capability?.effective;
  const autoUses =
    hasAuto && effective && effective.source === 'factory-default' && effective.providerId === LOCAL_PROVIDER ? effective.modelId : null;
  const current = capability?.default ?? null;
  if (!current) return { selectedKey: hasAuto ? AUTO_DEFAULT : null, items, other: null, autoUses, hasAuto };
  if (current.providerId === LOCAL_PROVIDER) {
    // Speech synthesis and image generation have no factory default: a stored default that is no longer selectable (deleted elsewhere, or missing components) counts as “Not set” (design draft `defaultView`). When a model pack is deleted,
    // the Runtime already clears defaults pointing to it (architecture design §6.8); this covers cases that did not go through `models.remove`.
    if (!hasAuto && !items.some((i) => i.key === current.modelId)) return { selectedKey: null, items, other: null, autoUses, hasAuto };
    if (!items.some((i) => i.key === current.modelId)) {
      const known = bundles.find((b) => b.bundleId === current.modelId);
      items.push({ key: current.modelId, label: M.notInstalled(known ? bundleName(known) : current.modelId) });
    }
    return { selectedKey: current.modelId, items, other: null, autoUses, hasAuto };
  }
  const provider = capability?.providers.find((p) => p.providerId === current.providerId);
  return { selectedKey: null, items, other: `${provider?.label ?? current.providerId} · ${current.modelId}`, autoUses, hasAuto };
}

/** One item of the local menu → arguments for `models.setDefault`. */
export function localDefaultChoice(key: string): { providerId: string | null; modelId?: string } {
  return key === AUTO_DEFAULT ? { providerId: null } : { providerId: LOCAL_PROVIDER, modelId: key };
}

// ---- Common components ----

/**
 * Same component: component name + repo + version. Looking only at the repo would count IndexTTS2's weights (`tts`) and the auxiliary parts borrowed by IndexTTS 2.5 (`aux`) as common components; the design draft counts the latter as belonging to 2.5 itself (model-local-models.js `layout`).
 */
function componentKey(c: Pick<ModelComponentStatus, 'component' | 'repo' | 'revision'>): string {
  return `${c.component}:${c.repo}@${c.revision}`;
}

/** Order in the common-components area (design draft data.js `setComponents`: VAD, aligner, tokenizer, speaker embedding…); unlisted ones go last. */
const SHARED_ORDER = ['vad', 'aligner', 'tokenizer', 'speaker', 'segmentation', 'codec', 'aux', 'audiocpp-engine'];

export interface SharedComponent {
  key: string;
  /** Component name (`vad`, `aligner`…). */
  component: string;
  repo: string;
  installed: boolean;
  /** Size taken when installed, to download when not installed; null if unknown. */
  bytes: number | null;
  /** Model packs that declare it, sorted by ID (same order as “Installed / Downloadable”). */
  users: ModelBundleStatus[];
}

/**
 * Common components of a class (design draft model-local-models.js `layout`): a component declared by two or more model packs in this class. Whether it is common depends only on the catalog, not on whether it is installed; deleting one model does not make the component disappear from here. Old snapshots without component info have no common components.
 */
export function sharedComponents(bundles: readonly ModelBundleStatus[], category: ModelCategory): SharedComponent[] {
  const byKey = new Map<string, { status: ModelComponentStatus[]; users: ModelBundleStatus[] }>();
  const mine = bundles.filter((b) => bundleCategory(b) === category).sort((a, b) => a.bundleId.localeCompare(b.bundleId));
  for (const bundle of mine) {
    for (const c of bundle.components ?? []) {
      const key = componentKey(c);
      const entry = byKey.get(key) ?? { status: [], users: [] };
      entry.status.push(c);
      if (!entry.users.includes(bundle)) entry.users.push(bundle);
      byKey.set(key, entry);
    }
  }
  const rank = (component: string) => {
    const i = SHARED_ORDER.indexOf(component);
    return i < 0 ? SHARED_ORDER.length : i;
  };
  return [...byKey.entries()]
    .filter(([, e]) => e.users.length >= 2)
    .map(([key, e]) => {
      const first = e.status[0]!;
      const installed = e.status.some((c) => c.state === 'installed');
      const sized = e.status.find((c) => (installed ? c.state === 'installed' && c.bytes !== null : c.estimatedBytes != null));
      const bytes = installed ? (sized?.bytes ?? first.estimatedBytes ?? null) : (sized?.estimatedBytes ?? null);
      return { key, component: first.component, repo: first.repo, installed, bytes, users: e.users };
    })
    .sort((a, b) => rank(a.component) - rank(b.component) || a.key.localeCompare(b.key));
}

/**
 * The model pack's own files are on disk (the design draft's `on[m.id]`, weights present): installed, or there are installed components beyond the common and optional ones. Weights present but common components missing (`incomplete`) also counts. Only common components installed by another model, with optional components alone, doesn't count; components from GitHub release pages (the audio.cpp engine, installed under `tools/` in the Runtime Home, or the self-built engine pointed to by `CUCCUT_AUDIOCPP_CLI`) also don't count; an engine with no weights is still “Downloadable”.
 */
export function hasOwnFiles(bundle: ModelBundleStatus, shared: readonly SharedComponent[]): boolean {
  if (isBundleInstalled(bundle)) return true;
  const keys = new Set(shared.map((c) => c.key));
  return (bundle.components ?? []).some(
    (c) => c.state === 'installed' && !c.optional && c.origin !== 'github-release' && !keys.has(componentKey(c)),
  );
}

/**
 * How much more must be downloaded to complete this model pack (design draft `needSize`): the sum of the sizes of the missing components in the manifest, including optional ones (both install and complete download them). null if any component's size is unknown, or when there is no component info.
 */
export function needBytes(bundle: Pick<ModelBundleStatus, 'components'>): number | null {
  if (!bundle.components?.length) return null;
  let total = 0;
  for (const c of bundle.components) {
    if (c.state !== 'missing') continue;
    if (c.estimatedBytes == null) return null;
    total += c.estimatedBytes;
  }
  return total;
}

/**
 * The size shown at the in-place download spot (same number as the settings page row): with component info it is `needBytes`. With weights present and common components missing, only the missing part counts; if a missing component's size is unknown, nothing is written. Old snapshots without component info use `estimatedBytes`, estimated from the bundled manifest. null when unknown or when nothing is missing.
 */
export function downloadBytes(bundle: Pick<ModelBundleStatus, 'components' | 'estimatedBytes'>): number | null {
  return (bundle.components?.length ? needBytes(bundle) : bundle.estimatedBytes) || null;
}

const installing = (b: ModelBundleStatus) => !!b.install && b.install.state !== 'paused';
const cannotRun = (b: ModelBundleStatus) => b.reason === 'unsupported' || b.reason === 'worker-missing';

export type SharedAction =
  | { kind: 'installed' }
  /** A model pack that uses it is downloading (either the Complete clicked here, or the Download/Complete on a row): missing components download along with it, and its progress is shown. */
  | { kind: 'running'; bundle: ModelBundleStatus }
  /** “Download” = complete `target` (only downloads what it is missing). */
  | { kind: 'get'; target: ModelBundleStatus }
  /** For models that don't have their own files on disk: no button; they wait to download together when the model is installed. */
  | { kind: 'later' };

/**
 * What the right side of a common-component row does (design draft model-local-models.js `compAction`). Components are not installed on their own: when one is missing, borrow it from a model pack that has its own files on disk, that is used, and that this computer can run, to complete it, picking the one with the least to download (unknown sizes sort last); on a tie, by ID order.
 */
export function sharedAction(c: SharedComponent, shared: readonly SharedComponent[]): SharedAction {
  if (c.installed) return { kind: 'installed' };
  const running = c.users.find(installing);
  if (running) return { kind: 'running', bundle: running };
  let target: ModelBundleStatus | null = null;
  let best = Infinity;
  for (const b of c.users) {
    if (cannotRun(b) || !hasOwnFiles(b, shared)) continue;
    const need = needBytes(b) ?? Infinity;
    if (!target || need < best) {
      target = b;
      best = need;
    }
  }
  return target ? { kind: 'get', target } : { kind: 'later' };
}

/** Subtitle of a common-component row (design draft `compUsage`): how many of the models with files on disk use it, and how many need it in total. */
export function sharedUsage(c: SharedComponent, shared: readonly SharedComponent[]): { live: number; all: number } {
  return { live: c.users.filter((b) => hasOwnFiles(b, shared)).length, all: c.users.length };
}

/** Common components awaiting completion (design draft `catalog.repair`): missing, while a model with files on disk needs it. When there are any, the common-components area expands automatically. */
export function sharedRepair(shared: readonly SharedComponent[]): SharedComponent[] {
  return shared.filter((c) => !c.installed && c.users.some((b) => hasOwnFiles(b, shared)));
}

// ---- License ----

export interface LicenseLine {
  /** Name of the “model weights” or of the component. */
  part: string;
  /** Whether this is a component's license (not the weights'). */
  component: boolean;
  license: ModelLicense;
}

/**
 * What the “License” row in details lists (design draft model-local-models.js `licenseLines`): the weights' license, plus one line for each component that requires attribution (CC-BY) or has a license different from the weights'. `weights`: the weights' license (registered by the model pack; for speech synthesis, also read from the model description). With no licenses at all, an empty table; the row is not drawn.
 */
export function licenseLines(bundle: Pick<ModelBundleStatus, 'components'>, weights: ModelLicense | null): LicenseLine[] {
  const lines: LicenseLine[] = weights ? [{ part: M.weights, component: false, license: weights }] : [];
  for (const c of bundle.components ?? []) {
    const license = c.license;
    if (!license) continue;
    if (!weights || license.name !== weights.name || /^CC-BY/.test(license.name)) {
      lines.push({ part: componentLabel(c.component), component: true, license });
    }
  }
  return lines;
}

/** Wording for one license: when there is only one and it is the weights', don't write “Model weights · ”. */
export function licenseLineText(line: LicenseLine, count: number): string {
  return `${count > 1 || line.component ? `${line.part} · ` : ''}${line.license.name} · ${line.license.summary}`;
}
