import { createIcon } from '@react-spectrum/s2';

/**
 * Agent (robot) icon: the S2 workflow icons have no such meaning, so it is drawn from the prototype's outline geometry on a 20×20 grid,
 * with a 1.5 stroke width and only using currentColor, so it aligns with the S2 originals when placed in the icon slot of buttons and SideNav.
 */
export const AgentIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.4 6.6h7.2A2.3 2.3 0 0 1 15.9 8.9v4.4a2.3 2.3 0 0 1-2.3 2.3H6.4a2.3 2.3 0 0 1-2.3-2.3V8.9a2.3 2.3 0 0 1 2.3-2.3z" />
    <path d="M10 6.6V4.5" />
    <path d="M10 2.2a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3z" />
    <path d="M7.9 10.7h.01M12.1 10.7h.01" />
    <path d="M4.1 11.1H2.4M15.9 11.1h1.7" />
  </svg>
));
