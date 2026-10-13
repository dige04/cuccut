import {
  TEMPLATE_ID_PATTERN,
  live,
  templateExampleText,
  type TemplateDetail,
  type TemplateDiagnostic,
  type TemplateListResult,
  type TemplateSendRef,
  type TemplateSummary,
} from '@cuccut/protocol';
import { M } from './templates-copy.ts';

/**
 * Output of `cuccut templates` (template package spec §6). Split out of main.ts so it can be tested on its own.
 */

const KIND_LABELS: Readonly<Record<TemplateSummary['manifest']['kind'], string>> = live(() => M.kindLabels);
const ORIGIN_LABELS: Readonly<Record<TemplateSummary['origin'], string>> = live(() => M.originLabels);

/** “16:9 · 60 seconds”; when not set, write “auto”. */
function spec(template: TemplateSummary): string {
  const { ratio, durationSeconds } = template.manifest;
  return M.spec(ratio ?? null, durationSeconds || null);
}

/** One row in the list: `<id>  <kind>  <source>  <aspect · duration>  <title>: <one-line summary>`. */
export function describeTemplate(template: TemplateSummary): string {
  const { manifest } = template;
  return `${manifest.id}  ${KIND_LABELS[manifest.kind]}  ${ORIGIN_LABELS[template.origin]}  ${spec(template)}  ${M.summaryLine(manifest.title, manifest.summary)}`;
}

export function describeDiagnostic(diagnostic: TemplateDiagnostic): string {
  const head = M.diagnosticHead(ORIGIN_LABELS[diagnostic.origin], diagnostic.dir, diagnostic.code, diagnostic.message);
  return [head, ...diagnostic.issues.map((issue) => `  - ${issue}`), M.folder(diagnostic.path)].join('\n');
}

/** `cuccut templates`: scene templates first, then work examples, each sorted by id; skipped templates are at the end. */
export function formatTemplateList(result: TemplateListResult): string[] {
  const order = (t: TemplateSummary) => (t.manifest.kind === 'scene' ? 0 : 1);
  const sorted = [...result.templates].sort((a, b) => order(a) - order(b) || a.manifest.id.localeCompare(b.manifest.id));
  const lines = sorted.length ? sorted.map(describeTemplate) : [M.none];
  if (result.diagnostics.length) {
    lines.push('', M.skipped(result.diagnostics.length), ...result.diagnostics.map(describeDiagnostic));
  }
  return lines;
}

/** `cuccut templates show <id>`: the key points of the manifest and the full text of `prompt.md`. */
export function formatTemplateDetail(detail: TemplateDetail): string[] {
  const { manifest, origin, files } = detail.template;
  const lines = [
    M.detailHead(manifest.title, manifest.id, manifest.version, KIND_LABELS[manifest.kind], ORIGIN_LABELS[origin]),
    manifest.summary,
    manifest.description,
    M.meta(manifest.category, spec(detail.template), manifest.language),
    M.author(manifest.author, manifest.source, manifest.license),
  ];
  if (manifest.tags.length) lines.push(M.tags(manifest.tags));
  if (manifest.brief) lines.push(M.sample(templateExampleText(manifest.brief, manifest.fields)));
  if (files.cover) lines.push(M.cover(manifest.cover.file ?? ''));
  if (files.preview) lines.push(M.preview(manifest.preview.file ?? ''));
  for (const asset of manifest.assets ?? []) lines.push(M.asset(asset.path, asset.type, asset.note));
  const check = manifest.verification;
  if (check) {
    lines.push(
      M.verification({
        date: check.date,
        engine: check.engine,
        version: check.version,
        outcome: check.outcome,
        output: check.output ? { ratio: check.output.ratio, seconds: check.output.durationSeconds } : null,
        missing: check.capabilities,
      }),
    );
  }
  lines.push('', '--- prompt.md ---', detail.prompt.trimEnd());
  return lines;
}

/**
 * `cuccut chat --template <id>`: the scene template attached when sending (template package spec §5.2). Only the id is carried; the version and assets are decided by the Runtime according to the template currently in the catalog;
 * an id that is not kebab-case is rejected locally. Whether a work example can be attached is decided by the Runtime (`TEMPLATE_NOT_SCENE`).
 */
export function parseChatTemplate(value: string | undefined): TemplateSendRef | undefined {
  if (value === undefined) return undefined;
  const id = value.trim();
  if (!TEMPLATE_ID_PATTERN.test(id)) throw new Error(M.templateFlag(value));
  return { id };
}
