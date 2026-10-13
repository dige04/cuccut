import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PACK_DIRS,
  PACK_LIMITS,
  RpcError,
  SKILL_FILE,
  SKILL_LIMITS,
  TEMPLATE_PROMPT_FILE,
  packScanReasonText,
  scanPackStyle,
  scanPackText,
  templateTranslationFiles,
  type LibraryName,
  type Localized,
  type PackFileHit,
  type PackLibraryItem,
  type PackPreview,
  type PackPreviewItemState,
  type PackPreviewLibraryItem,
  type PackPreviewSkill,
  type PackPreviewTemplate,
  type PackScanHit,
  type PackWarning,
} from '@cuccut/protocol';
import { readLibraryImport } from '@cuccut/runtime-storage/library';
import { RcPacks } from '@cuccut/protocol/messages/runtime-core';
import { loadSkill, type LoadedSkill, type SkillCatalog } from '../skills/skill-catalog.ts';
import { loadTemplate, localizeTemplate, type LoadedTemplate, type TemplateCatalog } from '../templates/template-catalog.ts';
import { packDirHash, readReservedTexts, readText, sha256File, type InstalledPack, type PackLibraryView, type PackRegistry } from './pack-registry.ts';
import type { StagedPack } from './pack-source.ts';

/**
 * Inspect (pack spec §5, §6): turns a staged pack into what the person reads before installing (`PackPreview`), and what the installer needs to write it.
 *
 * - Every template is loaded with `loadTemplate` and every skill with `loadSkill`, as the catalogs will load them; every library file is read with the library's own import
 *   (`readLibraryImport`). A template, skill or library file that would not load refuses the whole pack (`PACK_INVALID`), as do voices.
 * - The style guide, reference titles and notes and quick actions are scanned (`scanPackText`); a hit blocks the install. Template prompts and `SKILL.md` are scanned too,
 *   as warnings: they are instructions by nature.
 * - Each template and skill gets a state against this computer: `new`, `update` (this pack wrote it and nobody changed it), `changed`, `exists` (the user's own) or `builtin`.
 *
 * The installer runs the same inspection again on the staged folder before writing, so the states are those of the moment of install.
 */

/** A template or skill and where it would land. */
export interface InspectedDir {
  id: string;
  /** In the staged folder. */
  source: string;
  /** `<home>/templates/<id>` or `<home>/skills/<id>`. */
  target: string;
  state: PackPreviewItemState;
}

/** A library file and whether an earlier install already created an entry with the same bytes. */
export interface InspectedLibraryItem {
  item: PackLibraryItem;
  /** In the staged folder. */
  source: string;
  library: LibraryName;
  /** sha256 (hex) of the file's bytes. */
  contentHash: string;
  /** An entry an installed pack created from the same bytes, still in the library: reused, not imported again. */
  reuse: { library: LibraryName; entryId: string } | null;
}

export interface PackInspection {
  staged: StagedPack;
  /** The pack installed under this id now, if any. */
  previous: InstalledPack | null;
  preview: Omit<PackPreview, 'token' | 'expiresAt'>;
  templates: InspectedDir[];
  skills: InspectedDir[];
  library: InspectedLibraryItem[];
}

export interface PackInspectDeps {
  templates: TemplateCatalog;
  skills: SkillCatalog;
  registry: PackRegistry;
  library?: PackLibraryView;
}

/** Inspects a staged pack. Refuses with `PACK_INVALID` (every problem in `issues`) when an item would not load. */
export async function inspectStagedPack(staged: StagedPack, deps: PackInspectDeps): Promise<PackInspection> {
  const { manifest, dir } = staged;
  const { registry } = deps;
  const issues: Localized[] = [];
  const [templateScan, skillScan, installed, previous] = await Promise.all([
    deps.templates.scan(),
    deps.skills.scan(),
    registry.scan(),
    registry.get(manifest.id),
  ]);
  const builtinTemplates = new Set(templateScan.templates.filter((t) => t.origin === 'builtin').map((t) => t.manifest.id));
  const builtinSkills = new Set(skillScan.skills.filter((s) => s.scope === 'builtin').map((s) => s.id));
  const knownSkills = new Set([...skillScan.skills.map((s) => s.id), ...manifest.skills]);

  const stateOf = async (id: string, target: string, builtin: boolean, owned: readonly { id: string; dirHash: string }[] | undefined) => {
    if (builtin) return 'builtin' as const;
    if (!(await exists(target))) return 'new' as const;
    const mine = owned?.find((item) => item.id === id);
    if (!mine) return 'exists' as const;
    return (await packDirHash(target).catch(() => null)) === mine.dirHash ? ('update' as const) : ('changed' as const);
  };

  const warnings: PackWarning[] = [];
  const blocked: PackFileHit[] = [];
  const warn = (file: string, hits: PackScanHit[]) => {
    for (const hit of hits) warnings.push({ kind: 'scan', file, ...hit });
  };
  const block = (file: string, hits: PackScanHit[]) => {
    for (const hit of hits) blocked.push({ file, ...hit });
  };

  // Templates
  const templates: InspectedDir[] = [];
  const previewTemplates: PackPreviewTemplate[] = [];
  for (const id of manifest.templates) {
    const source = path.join(dir, PACK_DIRS.templates, id);
    const loaded = await loadTemplate(source, 'user');
    if ('code' in loaded) {
      issues.push(itemProblem(`${PACK_DIRS.templates}/${id}`, [loaded.message, ...loaded.issues]));
      continue;
    }
    const target = path.join(registry.templatesDir, id);
    const state = await stateOf(id, target, builtinTemplates.has(id), previous?.record.installed.templates);
    templates.push({ id, source, target, state });
    const localized = localizeTemplate(loaded);
    const missingSkills = (loaded.manifest.skills ?? []).filter((skill) => !knownSkills.has(skill));
    for (const skill of missingSkills) warnings.push({ kind: 'missing-skill', template: id, skill });
    const prompts = templatePrompts(loaded);
    for (const p of prompts) warn(`${PACK_DIRS.templates}/${id}/${p.file}`, scanPackText(p.text));
    previewTemplates.push({
      id,
      title: localized.manifest.title,
      kind: loaded.manifest.kind,
      category: loaded.manifest.category,
      prompt: localized.prompt,
      prompts,
      state,
      missingSkills,
    });
  }

  // Skills
  const skills: InspectedDir[] = [];
  const previewSkills: PackPreviewSkill[] = [];
  for (const id of manifest.skills) {
    const source = path.join(dir, PACK_DIRS.skills, id);
    const loaded = await loadSkill(source, 'user');
    const where = `${PACK_DIRS.skills}/${id}`;
    if ('code' in loaded) {
      issues.push(itemProblem(where, [loaded.message, ...loaded.issues]));
      continue;
    }
    const problem = skillProblem(loaded, id);
    if (problem) {
      issues.push(itemProblem(where, [problem.text]));
      continue;
    }
    const target = path.join(registry.skillsDir, id);
    const state = await stateOf(id, target, builtinSkills.has(id), previous?.record.installed.skills);
    skills.push({ id, source, target, state });
    warn(`${where}/${SKILL_FILE}`, scanPackText(loaded.content));
    previewSkills.push({ id, name: loaded.name, description: loaded.description, content: loaded.content, fileCount: loaded.files.length, state });
  }

  // Library
  const library: InspectedLibraryItem[] = [];
  const previewLibrary: PackPreviewLibraryItem[] = [];
  const createdBefore = installed.packs.flatMap((p) => p.record.installed.library);
  for (const item of manifest.library) {
    const source = path.join(dir, ...item.file.split('/'));
    let candidate;
    try {
      candidate = await readLibraryImport(source);
    } catch (error) {
      issues.push(RcPacks.libraryUnreadable({ path: item.file, issue: error instanceof Error ? error.message : String(error) }));
      continue;
    }
    if (candidate.library === 'voices') {
      issues.push(RcPacks.libraryVoice({ path: item.file }));
      continue;
    }
    const contentHash = await sha256File(source);
    const earlier = createdBefore.find((c) => c.contentHash === contentHash && c.library === candidate.library && deps.library?.entry(c.library, c.entryId));
    const reuse = earlier ? { library: earlier.library, entryId: earlier.entryId } : null;
    library.push({ item, source, library: candidate.library, contentHash, reuse });
    const kind = (candidate.content as { kind?: unknown }).kind;
    previewLibrary.push({
      file: item.file,
      name: item.name ?? candidate.content.name,
      library: candidate.library,
      kind: typeof kind === 'string' ? kind : candidate.library,
      size: (await fsp.stat(source)).size,
      duplicate: reuse !== null,
    });
  }

  // Style guide, references, quick actions: blocking.
  let style: PackPreview['style'] = null;
  if (manifest.style) {
    const text = await readText(path.join(dir, manifest.style), PACK_LIMITS.manifestBytes);
    if (text === null) issues.push(RcPacks.styleNotText({ file: manifest.style }));
    else {
      const hits = scanPackStyle(text);
      block(manifest.style, hits);
      style = { text, hits };
    }
  }
  manifest.examples.forEach((example, index) => {
    block(`pack.json#examples[${index}].title`, scanPackText(example.title));
    block(`pack.json#examples[${index}].note`, scanPackText(example.note));
  });
  const quickActions = manifest.quickActions.map((action, index) => {
    const labelHits = scanPackText(action.label);
    const textHits = scanPackText(action.text);
    block(`pack.json#quickActions[${index}].label`, labelHits);
    block(`pack.json#quickActions[${index}].text`, textHits);
    return { ...action, hits: [...labelHits, ...textHits] };
  });

  if (issues.length) {
    throw new RpcError('invalid-request', RcPacks.invalid({ issue: issues[0]! }), {
      code: 'PACK_INVALID',
      packId: manifest.id,
      issues: issues.map((issue) => issue.text),
    });
  }

  const { files: _files, ...shown } = manifest;
  return {
    staged,
    previous,
    templates,
    skills,
    library,
    preview: {
      manifest: shown,
      source: staged.source,
      installed: previous ? { version: previous.record.version } : null,
      templates: previewTemplates,
      skills: previewSkills,
      library: previewLibrary,
      style,
      examples: manifest.examples,
      quickActions,
      reserved: await readReservedTexts(dir, manifest),
      warnings,
      blocked,
      clashes: [...templates, ...skills].some((item) => item.state === 'exists' || item.state === 'changed'),
      files: staged.files.length,
      bytes: staged.bytes,
    },
  };
}

/**
 * The refusal of a pack with blocking scan hits (`PACK_BLOCKED`): the first hit in the message, all of them in `details.hits`. `styleLength` says how long the style guide
 * is, for a `too-long` hit.
 */
export function blockedError(packId: string, blocked: readonly PackFileHit[], styleLength = 0): RpcError {
  const first = blocked[0]!;
  return new RpcError(
    'invalid-request',
    RcPacks.blocked({ file: first.file, line: first.line, why: packScanReasonText(first.why, styleLength).text, text: first.text }),
    { code: 'PACK_BLOCKED', packId, file: first.file, line: first.line, why: first.why, hits: blocked },
  );
}

/** Every prompt of a template (`prompt.md` and each translation's), with its template-relative path and language. */
function templatePrompts(template: LoadedTemplate): { file: string; language: string; text: string }[] {
  return [
    { file: TEMPLATE_PROMPT_FILE, language: template.manifest.language, text: template.prompt },
    ...[...template.translations].map(([locale, entry]) => ({ file: templateTranslationFiles(locale).prompt, language: locale, text: entry.prompt })),
  ];
}

/** A skill folder in a pack must keep the id the manifest gives it and stay within the skill limits (adding it by hand would check the same). */
function skillProblem(skill: LoadedSkill, id: string): Localized | null {
  if (skill.id !== id) return RcPacks.skillIdMismatch({ id, normalized: skill.id });
  const bytes = skill.files.reduce((sum, f) => sum + f.size, 0);
  if (bytes > SKILL_LIMITS.totalBytes) return RcPacks.skillTooLarge({ bytes, limit: SKILL_LIMITS.totalBytes });
  return null;
}

function itemProblem(where: string, problems: string[]): Localized {
  return RcPacks.itemInvalid({ path: where, issue: problems.filter(Boolean).join('; ') });
}

async function exists(target: string): Promise<boolean> {
  return fsp.lstat(target).then(
    () => true,
    () => false,
  );
}
