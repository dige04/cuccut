import { createContext } from 'react';

/**
 * The row under the frame where the selection's toolbar docks (agentcut's clip toolbar, off the picture since 2026-09-21).
 * The preview provides it; the stage's toolbars portal into it instead of floating over the picture. Null: float.
 */
export const ToolbarRowContext = createContext<HTMLElement | null>(null);
