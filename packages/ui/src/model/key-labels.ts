/**
 * Shortcut notation: the list is always written for macOS (⌘ ⇧ ⌥); on Windows and Linux the modifier keys are replaced with Ctrl+, Shift+ and Alt+.
 * The editor's shortcut sheet (shortcut-sheet) and the shortcuts page of the help center share this one place (prototype help-center.jsx `keyLabel`).
 */
export function keyLabel(keys: string, mac: boolean): string {
  if (mac) return keys;
  // A modifier written on its own, as in “⇧ 走 5%” (⇧ moves 5%) or “⌥ 以中心对称” (⌥ mirrors about the center), is followed by a space, not by “+”.
  return keys
    .replace(/⇧(?= )/g, 'Shift')
    .replace(/⌘(?= )/g, 'Ctrl')
    .replace(/⌥(?= )/g, 'Alt')
    .replace(/⇧/g, 'Shift+')
    .replace(/⌘/g, 'Ctrl+')
    .replace(/⌥/g, 'Alt+');
}
