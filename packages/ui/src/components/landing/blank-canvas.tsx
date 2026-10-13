import { useId, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from 'cn';
import { HOME_COPY } from '../../copy.ts';
import type { BlankRatio } from '../start/blank-video.ts';
import { LANDING_COPY } from './landing-copy.ts';

type ShapeKey = keyof typeof LANDING_COPY.blank.shapes;

/** The shapes a blank video can start in (agentcut `SHAPES`), drawn at half size as the chip's glyph. */
const SHAPES: readonly { key: ShapeKey; ratio: BlankRatio; w: number; h: number }[] = [
  { key: 'wide', ratio: '16:9', w: 16, h: 9 },
  { key: 'vertical', ratio: '9:16', w: 9, h: 16 },
  { key: 'portrait', ratio: '4:5', w: 12, h: 15 },
  { key: 'square', ratio: '1:1', w: 13, h: 13 },
];

/**
 * "Start from" under the composer (agentcut `StartFrom`): a quiet row that opens a set of shape chips. A chip opens
 * an empty video of that shape straight in the editor, without the agent (the existing blank-video flow).
 * Collapsed by default so the composer stays the entry point.
 */
export function BlankCanvas({ onCreate }: { onCreate(ratio: BlankRatio): Promise<unknown> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BlankRatio | null>(null);
  const create = async (ratio: BlankRatio) => {
    if (busy) return;
    setBusy(ratio);
    try {
      await onCreate(ratio);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div data-cc className="mt-3 border-t border-border/60 pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        title={HOME_COPY.blankVideoTip}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground outline-none hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {LANDING_COPY.blank.toggle}
        <span className="text-foreground/85">{HOME_COPY.blankVideo}</span>
        <ChevronDown aria-hidden className={cn('size-3 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={id} className="mt-2 flex flex-col gap-2 px-1">
          <p className="px-2 text-xs text-muted-foreground">{LANDING_COPY.blank.hint}</p>
          <div role="group" aria-label={LANDING_COPY.blank.group} className="flex flex-wrap items-center gap-1">
            {SHAPES.map((shape) => {
              const name = LANDING_COPY.blank.shapes[shape.key];
              const working = busy === shape.ratio;
              return (
                <button
                  key={shape.key}
                  type="button"
                  disabled={!!busy}
                  aria-busy={working || undefined}
                  aria-label={LANDING_COPY.blank.create(name, shape.ratio)}
                  onClick={() => void create(shape.ratio)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-transparent px-3 text-xs text-muted-foreground transition-[background-color,border-color,color] duration-150 outline-none hover:border-white/10 hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 motion-reduce:transition-none">
                  <span aria-hidden className="flex size-4 items-center justify-center">
                    {working ? (
                      <Loader2 className="size-3.5 motion-safe:animate-spin" />
                    ) : (
                      <span className="rounded-[2px] border border-current" style={{ width: shape.w / 1.25, height: shape.h / 1.25 }} />
                    )}
                  </span>
                  {name}
                  <span className="tabular-nums text-muted-foreground/80">{shape.ratio}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
