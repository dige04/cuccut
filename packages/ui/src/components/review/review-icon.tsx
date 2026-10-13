import { createIcon } from '@react-spectrum/s2';

/**
 * The review gate's mark (agentcut's ShieldCheck) for S2 icon slots (the header's Video menu, the Settings side list):
 * the lucide shield-check outline redrawn on S2's 20 grid, 1.5 stroke, currentColor only, so it sits like the S2
 * workflow icons beside it.
 */
export const ShieldCheckIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 10.8c0 4.2-2.9 6.2-6.4 7.4a.8.8 0 0 1-.55 0C6.1 17 3.5 15 3.5 10.8V5a.8.8 0 0 1 .8-.8c1.7 0 3.7-1 5.2-2.25a1 1 0 0 1 1.3 0C12.3 3.2 14.4 4.2 16 4.2a.8.8 0 0 1 .5.8z" />
    <path d="m7.5 10 1.7 1.7 3.3-3.4" />
  </svg>
));
