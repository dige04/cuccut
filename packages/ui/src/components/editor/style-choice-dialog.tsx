import { useEffect, useId, useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { Id, PackActiveStyle } from '@cuccut/protocol';
import { Button } from '../../cc/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../cc/ui/dialog.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../cc/ui/select.tsx';
import { activeStyleCaption, packErrorMessage, STYLE_CHOICE_MISSING, styleChoiceFromActive, styleChoiceOf, styleDialogOptions } from '../../model/packs.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { activePackStyle, choosePackStyle, loadPacks } from '../../runtime/pack-commands.ts';
import { useConnection } from '../../state/connection-store.ts';
import { usePacks } from '../../state/packs-store.ts';
import { PACKS_COPY } from '../settings/packs-copy.ts';

const S = () => PACKS_COPY.style;

/**
 * Video menu → Style guide… (pack design §2.6): which installed pack's style guide agents follow for the videos in this
 * project — decide on its own, none, or one pack with a guide — and the guide in use now with the reason. The choice is
 * the same `packs.choose` that `packs_choose_style` calls, and it is saved as soon as it is picked. A video outside a
 * project has no choice to make: the select is off and says why, and the caption still says what is used.
 */
export function StyleChoiceDialog({ source, onClose }: { source: { projectId: Id | null; conversationId: Id | null }; onClose(): void }) {
  const runtime = useRuntime();
  const id = useId();
  const connected = useConnection((s) => s.state.status === 'connected');
  const packs = usePacks((s) => s.packs);
  const { projectId, conversationId } = source;
  const target = projectId ? { projectId } : conversationId ? { conversationId } : null;
  const [active, setActive] = useState<PackActiveStyle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    void loadPacks(runtime);
    if (target) {
      activePackStyle(runtime, target).then(
        (next) => !cancelled && setActive(next),
        (reason: unknown) => !cancelled && setError(packErrorMessage(reason, 'choose')),
      );
    }
    return () => {
      cancelled = true;
    };
    // `target` is rebuilt each render; the ids are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, connected, projectId, conversationId]);

  const choose = async (key: string) => {
    if (!projectId || key === STYLE_CHOICE_MISSING || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await choosePackStyle(runtime, projectId, styleChoiceOf(key));
      setActive(result.active);
    } catch (reason) {
      setError(packErrorMessage(reason, 'choose'));
    } finally {
      setSaving(false);
    }
  };

  const options = styleDialogOptions(packs, active);
  const value = active ? styleChoiceFromActive(active) : 'auto';
  const disabledReason = !projectId ? S().noProject : !connected ? PACKS_COPY.list.disconnected : null;
  const caption = active ? activeStyleCaption(active) : connected && target ? S().checking : null;
  const noGuides = !packs.some((p) => p.hasStyle);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-[min(440px,calc(100%-2rem))] sm:max-w-[min(440px,calc(100%-2rem))]">
        {/* The dialog is portalled outside any `data-cc` subtree; the cc primitives need the scoped preflight. */}
        <div data-cc className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{S().dialogTitle}</DialogTitle>
            <DialogDescription>{projectId ? S().dialogLede : S().dialogLedeNoProject}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label id={`${id}-label`} className="text-sm font-medium text-foreground">
              {S().choiceLabel}
            </label>
            <Select value={value} disabled={disabledReason !== null || saving || !active} onValueChange={(next) => next != null && void choose(String(next))}>
              <SelectTrigger aria-labelledby={`${id}-label`} aria-describedby={`${id}-caption`} title={disabledReason ?? undefined} className="w-full">
                <SelectValue>{(key: unknown) => options.find((o) => o.key === key)?.label ?? S().auto}</SelectValue>
              </SelectTrigger>
              <SelectContent data-cc>
                {options.map((option) => (
                  <SelectItem key={option.key} value={option.key} disabled={option.key === STYLE_CHOICE_MISSING}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div id={`${id}-caption`} className="flex flex-col gap-1">
              {!projectId ? <p className="m-0 text-xs text-muted-foreground">{S().noProject}</p> : null}
              {caption ? (
                <p role="status" className="m-0 text-sm text-foreground">
                  {caption}
                </p>
              ) : null}
              {noGuides && projectId ? <p className="m-0 text-xs text-muted-foreground">{S().noGuides}</p> : null}
            </div>
            {error ? (
              <p role="alert" className="m-0 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="items-stretch sm:items-center sm:justify-between">
            <p className="m-0 text-xs text-muted-foreground">{S().nextSession}</p>
            <DialogPrimitive.Close render={<Button />}>{S().done}</DialogPrimitive.Close>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
