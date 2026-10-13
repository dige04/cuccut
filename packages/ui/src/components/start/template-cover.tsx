import type { ReactNode } from 'react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { HOME_COPY } from '../../copy.ts';
import { isExample, type HomeTemplate } from '../../model/home-templates.ts';
import { useTemplateFileUrl } from './use-templates.ts';

// A uniform 16:10 cell: portrait and square images leave empty space on both sides, so a row of cards lines up. The geometry is in app.css (.cc-tpl-cover).
const box = style({ backgroundColor: 'gray-100' });
// The small badge for a work example: same geometry as the “已选” (selected) mark on the card.
const kindBadge = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 20,
  paddingX: '[6px]',
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui-xs',
  color: 'gray-700',
  fontWeight: 'normal',
  lineHeight: '[1]',
});
const art = style({
  backgroundColor: {
    tone: {
      blue: 'blue-200',
      orange: 'orange-200',
      green: 'green-200',
      purple: 'purple-200',
      cyan: 'cyan-200',
      indigo: 'indigo-200',
      magenta: 'magenta-200',
      seafoam: 'seafoam-200',
      brown: 'brown-200',
    },
  },
  color: {
    tone: {
      blue: 'blue-1000',
      orange: 'orange-1000',
      green: 'green-1000',
      purple: 'purple-1000',
      cyan: 'cyan-1000',
      indigo: 'indigo-1000',
      magenta: 'magenta-1000',
      seafoam: 'seafoam-1000',
      brown: 'brown-1000',
    },
  },
});

/**
 * Template cover (prototype home-templates.jsx `HomeTemplateThumb`): draws one frame in the template's own aspect ratio and fits it into the uniform cell.
 * `size`: xs = small colour swatch in the template row and input box (no text); md = card cover; lg = preview in the detail view.
 * `slide`: null = cover; a number = the preview is played up to that scene.
 * When the manifest has a cover image (`cover.file`), the cover shows that image. The placeholder cover is still drawn underneath, and it is what shows before the image loads or if loading fails (spec §3.3).
 * The preview video is not here; the detail view holds it separately (template-library.tsx).
 */
export function TemplateCover({
  template,
  size = 'md',
  slide = null,
  children,
}: {
  template: HomeTemplate;
  size?: 'xs' | 'md' | 'lg';
  slide?: number | null;
  children?: ReactNode;
}) {
  const count = template.beats.length;
  const at = slide == null ? null : slide % count;
  const image = useTemplateFileUrl(template.id, slide == null ? template.cover : null);
  return (
    <span className={`cc-tpl-cover ${box}`} data-size={size} aria-hidden>
      <span className={`cc-tpl-art ${art({ tone: template.tone })}`} data-ratio={template.ratio ?? '16:9'}>
        {size !== 'xs' ? <span className="cc-tpl-art__kicker">{at == null ? template.kicker : `${at + 1} / ${count}`}</span> : null}
        <span className="cc-tpl-art__fig" data-fig={template.figure}>
          <i />
          <i />
          <i />
          <i />
        </span>
        {size !== 'xs' ? <span className="cc-tpl-art__word">{at == null ? template.title : template.beats[at]}</span> : null}
        {size !== 'xs' ? <span className="cc-tpl-art__line" /> : null}
      </span>
      {image.url ? <img className="cc-tpl-cover__image" src={image.url} alt="" decoding="async" onError={image.fail} /> : null}
      {children}
    </span>
  );
}

/** The “示例” (Example) badge on work examples (scene templates are not marked): used next to the card title and on the line below the input box (prototype `HomeTemplateKind`). */
export function TemplateKindBadge({ template }: { template: Pick<HomeTemplate, 'kind'> }) {
  return isExample(template) ? <span className={kindBadge}>{HOME_COPY.exampleBadge}</span> : null;
}
