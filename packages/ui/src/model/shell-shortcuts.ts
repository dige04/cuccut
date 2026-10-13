/** App-level keyboard shortcuts (prototype main.jsx). The keys of the editor and input fields are not here. */
export type ShellAction = 'back' | 'forward' | 'new' | 'space' | 'tasks' | 'settings' | 'sidebar';

export interface KeyLike {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * macOS uses ⌘; Windows and Linux use Ctrl; back and forward use Alt+←/→.
 * Letters are matched by physical key (`code`), so they are recognized even when the IME or Shift rewrites `key`.
 */
export function shellShortcut(event: KeyLike, mac: boolean): ShellAction | null {
  const mod = mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  const letter = event.code?.startsWith('Key') ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
  if (mac ? mod && !event.shiftKey && event.key === '[' : event.altKey && !event.ctrlKey && event.key === 'ArrowLeft') return 'back';
  if (mac ? mod && !event.shiftKey && event.key === ']' : event.altKey && !event.ctrlKey && event.key === 'ArrowRight') return 'forward';
  if (mac && event.metaKey && event.ctrlKey && !event.shiftKey && !event.altKey && letter === 's') return 'sidebar';
  if (!mod || event.altKey) return null;
  if (!event.shiftKey && letter === 'n') return 'new';
  if (!event.shiftKey && (event.key === ',' || event.code === 'Comma')) return 'settings';
  if (event.shiftKey && letter === 'h') return 'space';
  if (event.shiftKey && letter === 'b') return 'tasks';
  return null;
}
