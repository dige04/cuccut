import { useId, type SVGProps } from 'react';

/**
 * The CucCut mark: a "C" ring opened like a mouth, cut through once on the diagonal, with the playhead dot at its
 * centre. One `currentColor` drawing, masked so the holes are real holes on any background.
 */
type MarkProps = SVGProps<SVGSVGElement>;

export function CucCutMark({ className = 'size-6', ...props }: MarkProps) {
  const id = `cc${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden focusable="false" className={className} {...props}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <circle cx="50" cy="50" r="44" fill="#fff" />
        <circle cx="50" cy="50" r="25" fill="#000" />
        {/* the mouth of the C */}
        <path d="M50 50 L100 22 L100 78 Z" fill="#000" />
        {/* the cut */}
        <path d="M12 30 L44 47 L41 52 L9 35 Z" fill="#000" />
        <circle cx="50" cy="50" r="9" fill="#fff" />
      </mask>
      <rect width="100" height="100" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}

/** The mark on its yellow tile, as it appears in the navigation bar and the app icon. */
export function CucCutTile({ className = 'size-7' }: { className?: string }) {
  return (
    <span
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-[30%] bg-primary bg-linear-to-b from-[#ffff5e] to-primary text-primary-foreground shadow-[var(--control-highlight),0_3px_12px_-6px_var(--primary)]`}>
      <CucCutMark className="size-[72%]" />
    </span>
  );
}
