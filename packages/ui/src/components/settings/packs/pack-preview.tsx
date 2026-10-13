import type { ReactNode } from 'react';
import type { PackPreview as PackPreviewData, PackScanHit } from '@cuccut/protocol';
import { packScanReasonText } from '@cuccut/protocol';
import {
  BookA,
  Captions,
  Film,
  Image as ImageIcon,
  Languages,
  LayoutTemplate,
  Library,
  MessageSquareText,
  Package,
  Palette,
  Scale,
  Sparkles,
  Sticker,
  TriangleAlert,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../../cc/ui/badge.tsx';
import { TEMPLATE_KIND_LABEL } from '../../../copy.ts';
import { fileSizeLabel } from '../../../model/agent-skills.ts';
import { categoryLabel } from '../../../model/home-templates.ts';
import { blockedSentence, libraryKindLabel, packVersionLine, previewContents, previewStateNote, previewWarningText } from '../../../model/packs.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { Panel, PanelHeading } from '../settings-ui.tsx';
import { AgentText } from './packs-ui.tsx';

const I = () => PACKS_COPY.import;

/** The icon of a library item by its kind (`PackLibraryPreview.kind`); an unknown kind gets the library's. */
const LIBRARY_ICON: Record<string, LucideIcon> = {
  transcription: BookA,
  translation: Languages,
  color: Palette,
  captionStyle: Captions,
  image: ImageIcon,
  video: Film,
  sticker: Sticker,
  font: Type,
};

/**
 * Everything a previewed pack carries (pack design §2.3, `PackPreview`), before anything is installed: what an agent
 * will follow is shown in full, in red-tinted boxes, never summarised (template prompts, `SKILL.md`, the style guide,
 * quick actions, the reserved rules). Each template and skill says what happens to an item with the same id here; lines
 * the scan flags are named where they are, blocking ones in red.
 */
export function PackPreviewPanels({ preview }: { preview: PackPreviewData }) {
  const { manifest } = preview;
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground/5 text-muted-foreground">
            <Package className="size-5" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="m-0 text-base font-medium text-foreground [overflow-wrap:anywhere]">{manifest.name}</h3>
            <span className="text-xs text-muted-foreground">
              {packVersionLine(manifest)} · <span className="font-mono">{manifest.id}</span>
            </span>
          </div>
          <Badge variant="destructive">{I().badge}</Badge>
        </div>
        {manifest.description ? <p className="m-0 max-w-prose text-sm text-muted-foreground [overflow-wrap:anywhere]">{manifest.description}</p> : null}
        <p className="m-0 text-xs text-muted-foreground">
          {previewContents(preview)} · {I().filesLine(preview.files, fileSizeLabel(preview.bytes))}
        </p>
        {preview.installed ? <p className="m-0 text-sm text-foreground">{I().installedVersion(preview.installed.version)}</p> : null}
      </Panel>

      {preview.blocked.length ? (
        <div role="alert" className="flex flex-col gap-1 rounded-3xl bg-destructive/8 px-5 py-4 ring-1 ring-destructive/20">
          {preview.blocked.map((hit, i) => (
            <p key={i} className="m-0 text-sm text-destructive [overflow-wrap:anywhere]">
              {blockedSentence(hit, preview.style?.text.length ?? 0)} <span className="font-mono text-xs">{hit.file}</span>
            </p>
          ))}
        </div>
      ) : null}

      {preview.templates.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<LayoutTemplate />} title={I().templates} />
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {preview.templates.map((t) => (
              <Item
                key={t.id}
                title={t.title}
                meta={
                  <>
                    {TEMPLATE_KIND_LABEL[t.kind]} · {categoryLabel(t.category)} · <span className="font-mono">{t.id}</span>
                  </>
                }
                notes={[previewStateNote('template', t.state), ...t.missingSkills.map((skill) => I().missingSkill(skill))]}>
                {t.prompts.length > 1 ? (
                  // An agent follows the prompt for the UI language, so every language's prompt is shown in full.
                  t.prompts.map((p) => (
                    <div key={p.file} className="flex flex-col gap-1">
                      <p className="m-0 font-mono text-xs text-muted-foreground">
                        {p.file} · {p.language}
                      </p>
                      <AgentText label={`${t.title} (${p.language}): ${I().agentReads}`}>{p.text}</AgentText>
                    </div>
                  ))
                ) : (
                  <AgentText label={`${t.title}: ${I().agentReads}`}>{t.prompts[0]?.text ?? t.prompt}</AgentText>
                )}
              </Item>
            ))}
          </ul>
        </Panel>
      ) : null}

      {preview.skills.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<Sparkles />} title={I().skills} />
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {preview.skills.map((s) => (
              <Item
                key={s.id}
                title={s.name}
                meta={
                  <>
                    <span className="font-mono">{s.id}</span> · {I().skillFiles(s.fileCount)}
                  </>
                }
                description={s.description}
                notes={[previewStateNote('skill', s.state)]}>
                <AgentText label={`${s.name}: ${I().agentReads}`}>{s.content}</AgentText>
              </Item>
            ))}
          </ul>
        </Panel>
      ) : null}

      {preview.style || preview.examples.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<Palette />} title={I().style} hint={I().styleLede} />
          {preview.style ? (
            <>
              <AgentReads />
              <AgentText label={I().styleRegion}>{preview.style.text}</AgentText>
              <Hits hits={preview.style.hits} length={preview.style.text.length} />
            </>
          ) : null}
          {preview.examples.length ? (
            <div className="flex flex-col gap-1.5">
              <h4 className="m-0 text-xs font-medium text-muted-foreground">{I().references}</h4>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {preview.examples.map((example) => {
                  const Icon = example.kind === 'video' ? Film : ImageIcon;
                  return (
                    <li key={example.file} className="flex items-start gap-2 text-sm">
                      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className="text-foreground">{example.title || example.file}</span>
                        {example.note ? <span className="text-muted-foreground"> — {example.note}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {preview.quickActions.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<MessageSquareText />} title={I().quick} hint={I().quickLede} />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {preview.quickActions.map((action, i) => (
              <li key={i} className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{action.label}</span>
                <AgentText label={action.label}>{action.text}</AgentText>
                <Hits hits={action.hits} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {preview.library.length ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<Library />} title={I().library} />
          <ul className="m-0 flex list-none flex-col divide-y divide-foreground/8 p-0">
            {preview.library.map((item) => {
              const KindIcon = LIBRARY_ICON[item.kind] ?? Library;
              return (
                <li key={item.file} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-sm">
                  <KindIcon aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground" />
                  <span className="text-foreground [overflow-wrap:anywhere]">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {libraryKindLabel(item.kind)} · {fileSizeLabel(item.size)}
                  </span>
                  {item.duplicate ? <span className="basis-full text-xs text-muted-foreground">{I().duplicate}</span> : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {preview.reserved.rules.length || preview.reserved.review ? (
        <Panel className="flex flex-col gap-3">
          <PanelHeading icon={<Scale />} title={I().reserved} hint={I().reservedLede} />
          {preview.reserved.rules.map((rule) => (
            <div key={rule.path} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted-foreground">{rule.path}</span>
              <AgentText label={rule.path}>{rule.text}</AgentText>
            </div>
          ))}
          {preview.reserved.review ? <AgentText label={I().reserved}>{preview.reserved.review}</AgentText> : null}
        </Panel>
      ) : null}

      {preview.warnings.length ? (
        <Panel className="flex flex-col gap-2">
          <PanelHeading icon={<TriangleAlert />} title={I().warnings} />
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {preview.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {previewWarningText(warning)}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

/** One template or skill: its name and facts, what happens to an item with its id, and its text. */
function Item({ title, meta, description, notes, children }: { title: string; meta: ReactNode; description?: string; notes: string[]; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{title}</span>
        <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{meta}</span>
      </div>
      {description ? <p className="m-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">{description}</p> : null}
      {notes.filter(Boolean).map((note) => (
        <p key={note} className="m-0 text-xs text-foreground/85">
          {note}
        </p>
      ))}
      <AgentReads />
      {children}
    </li>
  );
}

function AgentReads() {
  return <p className="m-0 text-xs font-medium text-destructive">{I().agentReads}</p>;
}

/** Lines the scan flagged in one text (blocking for the guide and quick actions; the preview's `blocked` list says so too). */
function Hits({ hits, length = 0 }: { hits: PackScanHit[]; length?: number }) {
  if (!hits.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {hits.map((hit, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-destructive [overflow-wrap:anywhere]">
          <TriangleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
          {I().hitLine(hit.line, packScanReasonText(hit.why, length).text)}
          {hit.text ? <span className="text-muted-foreground"> (“{hit.text}”)</span> : null}
        </li>
      ))}
    </ul>
  );
}
