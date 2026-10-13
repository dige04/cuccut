import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/*
 * Slots in the session layout that the open pane fills (agentcut editor): the pane's actions sit in the session's
 * glass header (undo, redo, saved, Render), and the selection inspector sits in the right column under the chat.
 * The session layout renders `<SessionSlot name=…>` where each goes; a pane renders `<IntoSessionSlot name=…>` with
 * its content. Without a matching slot (a pane shown elsewhere) `IntoSessionSlot` renders its fallback in place.
 */

export type SessionSlotName = 'header-actions' | 'header-title' | 'inspector';

type Slots = Partial<Record<SessionSlotName, HTMLElement>>;

interface SlotContext {
  slots: Slots;
  register: (name: SessionSlotName, element: HTMLElement | null) => void;
}

const Context = createContext<SlotContext | null>(null);

export function SessionSlotsProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slots>({});
  const register = useCallback((name: SessionSlotName, element: HTMLElement | null) => {
    setSlots((current) => {
      if ((current[name] ?? null) === element) return current;
      const next = { ...current };
      if (element) next[name] = element;
      else delete next[name];
      return next;
    });
  }, []);
  const value = useMemo(() => ({ slots, register }), [slots, register]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Where a slot sits in the session layout. `className` styles the container (e.g. the inspector card's spacing). */
export function SessionSlot({ name, className }: { name: SessionSlotName; className?: string }) {
  const context = useContext(Context);
  const ref = useCallback(
    (element: HTMLDivElement | null) => {
      context?.register(name, element);
    },
    [context, name],
  );
  return <div ref={ref} className={className} data-session-slot={name} />;
}

/** Whether the session layout currently shows this slot (e.g. to hide an empty inspector card). */
export function useSessionSlotFilled(name: SessionSlotName): boolean {
  return !!useContext(Context)?.slots[name];
}

/** Renders `children` into the named slot when the session layout has one, otherwise `fallback` (default: in place). */
export function IntoSessionSlot({ name, children, fallback }: { name: SessionSlotName; children: ReactNode; fallback?: ReactNode }) {
  const target = useContext(Context)?.slots[name];
  if (target) return createPortal(children, target);
  return <>{fallback === undefined ? children : fallback}</>;
}
