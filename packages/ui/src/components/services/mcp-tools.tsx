import type { ServiceLevel } from '@cuccut/protocol';
import { Badge, Button, Switch, Text } from '@react-spectrum/s2';
import Copy from '@react-spectrum/s2/icons/Copy';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { GATE_LABEL, MCP_TOOL_GROUPS, MCP_TOOLS, toolGate, toolsSummary, type McpToolGate } from '../../model/services-mcp.ts';
import { detail, detailXs, panel } from './service-card.tsx';
import { PlannedNote, SectionHead } from './service-parts.tsx';
import { MCP_COPY } from './services-copy.ts';

/*
 * MCP service › Tools (prototype designs/cuccut/app/page-services-mcp-tools.jsx `McpToolsSection`): what appears in tools/list, and where each tool goes (answered directly / executed directly / asked before calling / not offered under read-only permission). The catalog is derived from the protocol constant MCP_SERVICE_TOOL_NAMES
 * (model/services-mcp.ts). The prototype can toggle each tool individually, expand to see parameters, and “Copy definition” / “Copy tools/list”. The Runtime has no per-tool toggle,
 * and it does not expose the tool catalog or parameters to the UI, so the toggles are greyed out, parameters are not expandable, the copy buttons are greyed out, and the reason is written below.
 */

const BADGE: Record<McpToolGate, 'positive' | 'notice' | 'neutral'> = { answer: 'neutral', auto: 'positive', ask: 'notice', hidden: 'neutral' };

const group = style({ marginTop: 16 });
const ghead = style({ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 4 });
const gname = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const tool = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingY: 8,
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
  opacity: { default: 1, isDim: 0.6 },
});
const id = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const name = style({ font: 'code-sm', color: 'gray-900' });
const foot = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 });
const grow = style({ flexGrow: 1, minWidth: 0 });

export function McpTools({ level }: { level: ServiceLevel }) {
  return (
    <>
      <SectionHead title={MCP_COPY.toolsTitle} aside={toolsSummary(level)} />
      <section className={panel}>
        <p className={detail}>{MCP_COPY.toolsLede}</p>
        {MCP_TOOL_GROUPS.map((g) => (
          <div key={g.group} className={group}>
            <div className={ghead}>
              <span className={gname}>{g.label}</span>
              <span className={detailXs}>{g.hint}</span>
            </div>
            {MCP_TOOLS.filter((t) => t.group === g.group).map((t) => {
              const gate = toolGate(t, level);
              return (
                <div key={t.name} className={tool({ isDim: gate === 'hidden' })}>
                  <span className={id}>
                    <code className={name}>{t.name}</code>
                    <span className={detailXs}>{t.title}</span>
                  </span>
                  <Badge size="S" fillStyle="subtle" variant={BADGE[gate]}>
                    {GATE_LABEL[gate]}
                  </Badge>
                  <Switch size="S" aria-label={MCP_COPY.toggleTool(t.name)} isSelected={gate !== 'hidden'} isDisabled />
                </div>
              );
            })}
          </div>
        ))}
        <div className={foot}>
          <span className={`${detailXs} ${grow}`}>{level === 'read' ? MCP_COPY.toolsHiddenNote : ''}</span>
          <Button variant="secondary" size="S" isDisabled>
            <Copy />
            <Text>{MCP_COPY.copyTools}</Text>
          </Button>
        </div>
        <PlannedNote>{MCP_COPY.toolsFixed}</PlannedNote>
      </section>
    </>
  );
}
