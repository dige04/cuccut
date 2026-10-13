import { useEffect } from 'react';
import { Button, ButtonGroup, Content, Dialog, DialogContainer, Heading } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { SHORTCUT_SHEET_COPY as COPY } from '../../copy.ts';
import { keyLabel } from '../../model/key-labels.ts';
import { useEditor } from '../../state/editor-store.ts';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/**
 * Editor shortcut list (the SHEET and dialog from the prototype editor-keys.jsx): opened with `?`, lists only the keys that really exist in the editor.
 * The prototype also puts the fullscreen player's ↑/↓, M and F keys in the list: volume and mute only affect how loud the preview sounds (not the video), and F enters fullscreen playback.
 * The fullscreen player has its own key table (fullscreen-player.tsx, shown by pressing ? in fullscreen), which is not listed here.
 * The help center (help-keys) uses the same rows.
 */
export function ShortcutSheet() {
  const open = useEditor((s) => s.shortcutsOpen);
  const setOpen = useEditor((s) => s.setShortcutsOpen);
  // Closed when leaving the editor, so it does not pop up by itself the next time.
  useEffect(() => () => setOpen(false), [setOpen]);
  return (
    <DialogContainer onDismiss={() => setOpen(false)}>
      {open ? (
        <Dialog size="S">
          {({ close }) => (
            <>
              <Heading slot="title">{COPY.title}</Heading>
              <Content>
                <div className={list}>
                  {COPY.rows.map(([label, keys]) => (
                    <div key={label} className={row}>
                      <span className={name}>{label}</span>
                      <kbd className={kbd}>{keyLabel(keys, MAC)}</kbd>
                    </div>
                  ))}
                </div>
                <p className={hint}>{COPY.hint}</p>
              </Content>
              <ButtonGroup>
                <Button variant="secondary" onPress={close}>
                  {COPY.done}
                </Button>
              </ButtonGroup>
            </>
          )}
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}

const list = style({ display: 'flex', flexDirection: 'column', gap: '[6px]' });
const row = style({ display: 'flex', alignItems: 'baseline', gap: 12 });
const name = style({ flexGrow: 1, minWidth: 0, font: 'body-sm', color: 'neutral' });
const kbd = style({ flexShrink: 0, font: 'code-xs', color: 'neutral-subdued', whiteSpace: 'nowrap' });
const hint = style({ font: 'body-xs', color: 'neutral-subdued', marginTop: 12, marginBottom: 0 });
