import type { CSSProperties } from 'react';
import { HOME_COPY } from '../../copy.ts';
import { homeStarters, type HomeStarter, type StarterKey, type StarterTone } from '../../model/home-starters.ts';
import { LANDING_COPY } from '../landing/landing-copy.ts';
import { LandingSection } from '../landing/landing-section.tsx';

// The little drawing inside each card: how many marks (<i>) it has. The geometry lives in app.css (.cc-quick-screen[data-kind]).
const STARTER_ART: Record<StarterKey, number> = { sub: 2, trans: 4, clean: 9, a2v: 7 };

// One hue per job, drawn into the illustration only; the card itself stays a neutral solid surface.
const TONE_HUE: Record<StarterTone, string> = {
  blue: 'var(--chart-5)',
  green: 'var(--chart-3)',
  orange: 'var(--chart-2)',
  magenta: 'oklch(0.68 0.2 350)',
};

const toneVars = (tone: StarterTone): CSSProperties => {
  const hue = TONE_HUE[tone];
  return {
    '--cc-quick-200': `color-mix(in oklab, ${hue} 9%, var(--card))`,
    '--cc-quick-300': `color-mix(in oklab, ${hue} 16%, var(--card))`,
    '--cc-quick-400': `color-mix(in oklab, ${hue} 40%, var(--secondary))`,
    '--cc-quick-1000': hue,
    '--cc-quick-screen': 'var(--background)',
    '--cc-quick-mute': 'var(--input)',
  } as CSSProperties;
};

/**
 * The landing page's quick start (common jobs on a video or a sound you already have): solid cards with a small
 * drawing and a name. A click puts a prompt into the composer; nothing is sent. `target` is the language last used
 * for "Transcribe and translate"; without one that prompt keeps a slot to fill in.
 */
export function HomeStarters({ target, onPick }: { target: string | null; onPick(starter: HomeStarter): void }) {
  return (
    <LandingSection title={HOME_COPY.quickStart} blurb={LANDING_COPY.quickStartBlurb}>
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {homeStarters(target).map((starter) => (
          <button
            key={starter.key}
            type="button"
            title={starter.tip}
            aria-label={starter.title}
            onClick={() => onPick(starter)}
            style={toneVars(starter.tone)}
            className="cc-quick-card group flex min-w-0 flex-col gap-2 rounded-3xl bg-card p-2 text-left ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 outline-none hover:bg-white/[0.06] hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
            <span aria-hidden className="block overflow-hidden rounded-[27px]">
              {/* A flatter frame than the drawing's own 16:10 so four cards read as a row of shortcuts, not posters. */}
              <span className="cc-quick-art" style={{ aspectRatio: '16 / 7' }}>
                <span className="cc-quick-screen" data-kind={starter.key}>
                  {Array.from({ length: STARTER_ART[starter.key] }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              </span>
            </span>
            <span className="truncate px-2 pb-1.5 text-sm font-medium text-foreground">{starter.title}</span>
          </button>
        ))}
      </div>
    </LandingSection>
  );
}
