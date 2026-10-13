import type { ReactNode } from 'react';
import type { ProfileRule } from '@cuccut/protocol';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { cn } from 'cn';
import { Badge } from '../../cc/ui/badge.tsx';
import { Button } from '../../cc/ui/button.tsx';
import { Switch } from '../../cc/ui/switch.tsx';
import { ruleEffects, stageLabel, type RuleEffect, type RuleTemplateOption } from '../../model/profile.ts';
import { PANEL } from '../settings/settings-ui.tsx';
import { RULES_COPY } from './rules-copy.ts';

const C = () => RULES_COPY;

/** What a rule does, as bullets: the template it uses (marked when not installed) and the agent instruction. */
export function RuleEffectList({ effects, empty, className }: { effects: RuleEffect[]; empty?: ReactNode; className?: string }) {
  if (!effects.length) return empty ? <p className={cn('m-0 text-sm text-muted-foreground', className)}>{empty}</p> : null;
  return (
    <ul className={cn('m-0 flex list-disc flex-col gap-1 ps-5 text-sm [overflow-wrap:anywhere] text-muted-foreground', className)}>
      {effects.map((effect, i) => (
        <li key={i} className={effect.missing ? 'text-foreground/80' : undefined}>
          {effect.text}
        </li>
      ))}
    </ul>
  );
}

/** A move button that is off at the end of the list, saying why on hover (a disabled button gets no pointer events, so the reason sits on its wrapper). */
function MoveButton({ label, reason, disabled, onPress, children }: {
  label: string;
  reason: string | null;
  disabled: boolean;
  onPress(): void;
  children: ReactNode;
}) {
  return (
    <span title={reason ?? undefined} className="inline-flex">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onPress}>
        {children}
      </Button>
    </span>
  );
}

/**
 * One rule in a list (agentcut `RuleRow`): its place in the order, name, stage, condition and effects; move earlier or later, switch it on or off,
 * edit it, delete it (the list offers Undo). `lock` says why nothing here can change.
 */
export function RuleRow({ rule, index, count, templates, lock, busy, onMove, onToggle, onEdit, onDelete }: {
  rule: ProfileRule;
  index: number;
  count: number;
  templates: readonly RuleTemplateOption[];
  lock: string | null;
  /** A change to this rule (or the order) is in flight. */
  busy: boolean;
  onMove(by: -1 | 1): void;
  onToggle(enabled: boolean): void;
  onEdit(): void;
  onDelete(): void;
}) {
  const first = index === 0;
  const last = index === count - 1;
  const off = !!lock || busy;
  return (
    <li className={cn(PANEL, 'flex flex-col gap-3 px-5 py-3.5')}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span aria-hidden className="mt-0.5 w-5 shrink-0 text-end font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <span className={cn('text-sm font-medium [overflow-wrap:anywhere]', rule.enabled ? 'text-foreground' : 'text-muted-foreground')}>{rule.name}</span>
            <Badge variant="secondary">{stageLabel(rule.stage)}</Badge>
          </p>
          <p className="m-0 mt-1 text-sm [overflow-wrap:anywhere] text-muted-foreground">{C().rule.when(rule.when)}</p>
          <RuleEffectList effects={ruleEffects(rule, templates)} className="mt-1.5 text-xs" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MoveButton label={C().rule.moveUp(rule.name)} reason={first ? C().rule.firstAlready : lock} disabled={first || off} onPress={() => onMove(-1)}>
            <ChevronUp />
          </MoveButton>
          <MoveButton label={C().rule.moveDown(rule.name)} reason={last ? C().rule.lastAlready : lock} disabled={last || off} onPress={() => onMove(1)}>
            <ChevronDown />
          </MoveButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-8">
        <Switch checked={rule.enabled} about={rule.name} label={rule.enabled ? C().rule.on : C().rule.off} disabled={off} onCheckedChange={onToggle} />
        <span className="flex-1" />
        <Button type="button" variant="outline" size="xs" disabled={!!lock} title={lock ?? undefined} onClick={onEdit}>
          <Pencil aria-hidden />
          {C().rule.edit}
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={C().rule.remove(rule.name)} title={lock ?? C().rule.remove(rule.name)} disabled={off} onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
