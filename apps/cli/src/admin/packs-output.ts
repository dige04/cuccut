import {
  PACK_ID_PATTERN,
  PACK_LIMITS,
  packScanReasonText,
  type PackChangeResult,
  type PackFileHit,
  type PackPreview,
  type PackPreviewItemState,
  type PackRemoveResult,
  type PackScanHit,
  type PackSummary,
} from '@cuccut/protocol';
import { M } from './packs-copy.ts';

/**
 * Arguments and output of the `cuccut packs` admin command (pack spec §8). Listing and reading are derived commands (`packs list|read`), as is the project's style
 * choice (`packs choose-style`). Inspect prints everything an agent will read in full, since nothing should be installed before a person has read it.
 */

/** `<id>`: the CLI checks the shape locally; whether the pack exists is decided by the Runtime (`PACK_NOT_FOUND`). */
export function parsePackId(value: string): string {
  const id = value.trim();
  if (id.length > PACK_LIMITS.id || !PACK_ID_PATTERN.test(id)) throw new Error(M.idFormat(value));
  return id;
}

/** `--library <glossaries|brand>:<entryId>`: voices never travel in a pack. */
export function parseLibraryItem(value: string): { library: 'glossaries' | 'brand'; id: string } {
  const match = /^(glossaries|brand):(\S+)$/.exec(value.trim());
  if (!match) throw new Error(M.libraryFormat(value));
  return { library: match[1] as 'glossaries' | 'brand', id: match[2]! };
}

/** The contents line of an installed pack ("1 template · 2 skills · …"). */
export function packContents(pack: Pick<PackSummary, 'counts' | 'hasStyle'>): string {
  return M.contents(pack.counts.templates, pack.counts.skills, pack.counts.library, pack.hasStyle, pack.counts.quickActions);
}

function stateText(state: PackPreviewItemState): string {
  switch (state) {
    case 'new':
      return M.stateNew;
    case 'update':
      return M.stateUpdate;
    case 'changed':
      return M.stateChanged;
    case 'exists':
      return M.stateExists;
    case 'builtin':
      return M.stateBuiltin;
  }
}

function hitText(hit: PackScanHit & { file: string }, length = 0): string {
  return M.scanHit(hit.file, hit.line, packScanReasonText(hit.why, length).text, hit.text);
}

/** Text an agent will follow, indented under its heading, so it reads as quoted. */
function quoted(text: string): string[] {
  return text
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => (line ? `    ${line}` : ''));
}

/** `cuccut packs inspect`: the whole preview, agent text in full; ends with how to install it (or why it won't). */
export function formatPreview(preview: PackPreview, source: string): string[] {
  const { manifest } = preview;
  const styleLength = preview.style?.text.length ?? 0;
  const lines = [M.title(manifest.name, manifest.id, manifest.version, manifest.author)];
  lines.push(preview.installed ? M.installedVersion(preview.installed.version) : M.notInstalled);
  if (manifest.description) lines.push(manifest.description);
  lines.push(M.contents(preview.templates.length, preview.skills.length, preview.library.length, preview.style !== null, preview.quickActions.length));

  if (preview.templates.length) {
    lines.push('', `${M.sectionTemplates}:`);
    for (const template of preview.templates) {
      lines.push(`- ${template.id}: ${template.title} (${template.kind}, ${template.category}) — ${stateText(template.state)}`);
      lines.push(`  ${M.agentReads}`, ...quoted(template.prompt));
    }
  }
  if (preview.skills.length) {
    lines.push('', `${M.sectionSkills}:`);
    for (const skill of preview.skills) {
      lines.push(`- ${skill.id}: ${skill.name} (${M.skillFiles(skill.fileCount)}) — ${stateText(skill.state)}`);
      if (skill.description) lines.push(`  ${skill.description}`);
      lines.push(`  ${M.agentReads}`, ...quoted(skill.content));
    }
  }
  if (preview.library.length) {
    lines.push('', `${M.sectionLibrary}:`);
    for (const item of preview.library) {
      lines.push(`- ${item.name} (${item.library}/${item.kind}, ${M.bytes(item.size)})${item.duplicate ? ` — ${M.duplicate}` : ''}`);
    }
  }
  if (preview.style) {
    lines.push('', `${M.sectionStyle}:`, `  ${M.agentReads}`, ...quoted(preview.style.text));
  }
  if (preview.examples.length) {
    lines.push('', `${M.sectionExamples}:`);
    for (const example of preview.examples) lines.push(`- ${example.file} (${example.kind}): ${example.title} — ${example.note}`);
  }
  if (preview.quickActions.length) {
    lines.push('', `${M.sectionQuick}:`);
    for (const action of preview.quickActions) lines.push(`- ${action.label}`, ...quoted(action.text));
  }
  if (preview.reserved.rules.length || preview.reserved.review !== null) {
    lines.push('', `${M.sectionReserved}:`);
    for (const rule of preview.reserved.rules) lines.push(`- ${rule.path}`, ...quoted(rule.text));
    if (preview.reserved.review !== null) lines.push('- review.json', ...quoted(preview.reserved.review));
  }
  if (preview.warnings.length) {
    lines.push('', `${M.sectionWarnings}:`);
    for (const warning of preview.warnings) {
      lines.push(`- ${warning.kind === 'scan' ? hitText(warning) : M.missingSkill(warning.template, warning.skill)}`);
    }
  }
  lines.push('');
  if (preview.blocked.length) {
    for (const hit of preview.blocked) lines.push(blockedLine(hit, styleLength));
  } else {
    lines.push(M.installHint(quoteArg(source)));
    if (preview.clashes) lines.push(M.replaceHint);
  }
  return lines;
}

function blockedLine(hit: PackFileHit, styleLength: number): string {
  return M.blocked(hit.file, hit.line, packScanReasonText(hit.why, styleLength).text, hit.text);
}

/** `cuccut packs install` / `restore`: the receipt, and each item that was skipped. */
export function formatInstalled(result: PackChangeResult): string[] {
  return [M.installed(result.pack.name, result.pack.version, packContents(result.pack)), ...result.skipped.map((s) => M.skipped(s.kind, s.id, s.reason))];
}

/** `cuccut packs remove`: what went, what stayed, and the Undo command. */
export function formatRemoved(result: PackRemoveResult): string[] {
  const lines = [M.removed(result.removed.name, result.moved.templates, result.moved.skills)];
  if (result.kept.length) lines.push(M.kept(result.kept.length, result.kept.map((k) => k.id).join(', ')));
  lines.push(M.undo(result.trashId));
  return lines;
}

/** A source as typed back on a command line: quoted when it has spaces or shell characters. */
function quoteArg(value: string): string {
  return /^[\w@%+=:,./~-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;
}
