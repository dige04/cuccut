import { Button } from '@react-spectrum/s2';
import type { ToolInfo } from '../../model/tool-catalog.ts';
import { EmptyCard } from '../models/model-parts.tsx';
import { useShell } from '../../state/shell-store.ts';
import { TOOL_ICON } from './tool-icon.tsx';
import { ToolPage } from './tool-parts.tsx';
import { PLANNED_COPY } from './tools-copy.ts';

/**
 * A tool with no backend yet (subtitle translation): when deep-linked to, it honestly says “Coming soon” and why, and does not draw an operable form
 * (the form in design file tool-llm.jsx waits until the capability is connected).
 */
export function PlannedTool({ tool, reason }: { tool: ToolInfo; reason: string }) {
  const go = useShell((s) => s.go);
  const Icon = TOOL_ICON[tool.icon];
  return (
    <ToolPage title={tool.name}>
      <EmptyCard
        icon={<Icon />}
        title={PLANNED_COPY.title}
        body={PLANNED_COPY.body(reason)}
        actions={
          <Button variant="secondary" onPress={() => go({ tab: 'tools' })}>
            {PLANNED_COPY.back}
          </Button>
        }
        note={tool.desc}
      />
    </ToolPage>
  );
}
