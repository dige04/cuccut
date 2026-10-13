import { useState } from 'react';
import { Check, LayoutGrid } from 'lucide-react';
import { cn } from 'cn';
import { HOME_COPY } from '../../copy.ts';
import { isExample, templateShelf, type HomeTemplate } from '../../model/home-templates.ts';
import { Button } from '../../cc/ui/button.tsx';
import { LANDING_COPY } from '../landing/landing-copy.ts';
import { LandingSection } from '../landing/landing-section.tsx';
import { TemplateCover, TemplateKindBadge } from './template-cover.tsx';
import { TemplateLibrary } from './template-library.tsx';

/**
 * One template card: a solid card with the cover clipped to its own rounded frame, the title (showcase examples carry
 * "Example") and one line of summary. A scene template is a toggle: a click puts it on the composer, another takes it
 * off. A showcase example puts its prompt into the composer; it is never "selected".
 */
function ShelfCard({
  template,
  picked,
  onScene,
  onExample,
}: {
  template: HomeTemplate;
  picked: boolean;
  onScene(template: HomeTemplate | null): void;
  onExample(template: HomeTemplate): void;
}) {
  const example = isExample(template);
  return (
    <button
      type="button"
      title={template.summary}
      aria-label={example ? HOME_COPY.useExampleLabel(template.title) : HOME_COPY.useTemplateLabel(template.title)}
      aria-pressed={example ? undefined : picked}
      onClick={() => (example ? onExample(template) : onScene(picked ? null : template))}
      className={cn(
        'group flex w-full min-w-0 flex-col gap-1 rounded-3xl p-2 text-left ring-1 transition-[background-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
        picked ? 'bg-primary/10 ring-primary/50' : 'bg-card ring-foreground/10 hover:bg-white/[0.06] hover:ring-foreground/20',
      )}>
      {/* The cover keeps the template's own aspect inside a 16:10 frame; the frame clips it to the card's inner radius. */}
      <span className="relative block overflow-hidden rounded-[27px]">
        <TemplateCover template={template} />
        {picked ? (
          <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-white/10">
            <Check aria-hidden className="size-3.5" />
            {HOME_COPY.templatePicked}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 px-2 pt-1.5 text-sm font-medium text-foreground">
        <span className="truncate">{template.title}</span>
        <TemplateKindBadge template={template} />
      </span>
      <span className="truncate px-2 pb-1.5 text-xs text-muted-foreground">{template.summary}</span>
    </button>
  );
}

/**
 * The template section under the composer: up to eight cards, the ones used last first, scene templates and showcase
 * examples mixed; the rest are in "All templates". Before the catalog arrives only the heading and that button show.
 */
export function HomeTemplateShelf({
  catalog,
  scene,
  shelf,
  onScene,
  onExample,
}: {
  /** The template catalog (state/template-catalog-store). */
  catalog: readonly HomeTemplate[];
  /** The id of the scene template on the composer. */
  scene: string | null;
  /** Ids of the templates used last. */
  shelf: readonly string[];
  onScene(template: HomeTemplate | null): void;
  onExample(template: HomeTemplate): void;
}) {
  const [library, setLibrary] = useState(false);
  const cards = templateShelf(catalog, shelf);
  return (
    <LandingSection
      title={HOME_COPY.templates}
      blurb={LANDING_COPY.templatesBlurb}
      actions={
        <Button variant="outline" size="sm" onClick={() => setLibrary(true)}>
          <LayoutGrid aria-hidden />
          {HOME_COPY.allTemplates}
        </Button>
      }>
      {cards.length ? (
        <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4" role="list">
          {cards.map((t) => (
            <div key={t.id} role="listitem" className="min-w-0">
              <ShelfCard template={t} picked={scene === t.id} onScene={onScene} onExample={onExample} />
            </div>
          ))}
        </div>
      ) : null}
      <TemplateLibrary
        open={library}
        picked={scene}
        onClose={() => setLibrary(false)}
        onUse={(t) => {
          setLibrary(false);
          if (isExample(t)) onExample(t);
          else onScene(t);
        }}
      />
    </LandingSection>
  );
}
