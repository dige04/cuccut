import { Badge } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { AiTool } from '../../model/ai-tools.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { panelBody, PanelHead } from './panel-head.tsx';

const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'gray-75',
  font: 'ui-sm',
  color: 'gray-800',
  lineHeight: '[1.5]',
});
const title = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const why = style({ margin: 0, color: 'gray-700' });

/**
 * Tool page for smart crop, not yet available: it needs to track the subject on screen and adjust the framing box, and the Runtime does not have that flow yet.
 * It stays listed as usual; opening it only says “coming soon” and why, and no operable form is drawn (same as tools/planned-tool.tsx).
 */
export function AiToolSoon({ tool, onBack }: { tool: AiTool; onBack(): void }) {
  return (
    <>
      <PanelHead title={tool.name} back={{ label: C.back, onPress: onBack }}>
        <Badge size="S" variant="neutral">
          {C.soon}
        </Badge>
      </PanelHead>
      <div className={`${panelBody} cc-scroll`}>
        <div className={card}>
          <span className={title}>{tool.name}</span>
          <span>{tool.desc}</span>
          <p className={why}>{tool.why}</p>
        </div>
      </div>
    </>
  );
}
