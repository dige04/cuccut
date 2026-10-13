import { useRef, useState } from 'react';
import type { FileTarget } from '@cuccut/protocol';
import { ActionButton, Popover, Text } from '@react-spectrum/s2';
import Close from '@react-spectrum/s2/icons/Close';
import Comment from '@react-spectrum/s2/icons/Comment';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { DESIGN } from '../model/design-copy.ts';
import { DESIGN_SYSTEM } from '../model/design-system-copy.ts';
import { SLIDES } from '../model/slides-copy.ts';
import { itemKey, type AnnotatedEditorKind } from '../model/workspace.ts';
import { useShell } from '../state/shell-store.ts';
import { useEditorReveal } from '../state/editor-bridge.ts';

/** Looks the same as the reference tag above the composer and in Space entries (composer.tsx `tag`); in a sent message it is just a faint one-line marker. */
const token = style({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  maxWidth: 'full',
  height: 24,
  borderRadius: 'default',
  backgroundColor: { default: 'transparent', isDraft: 'gray-100' },
  font: 'ui-xs',
  color: { default: 'gray-600', isDraft: 'gray-800' },
  boxSizing: 'border-box',
});
/** The styles that start from the prototype's home-slides.css `.home-slides-notes__list`. */
const list = style({ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, margin: 0, padding: 0, overflow: 'auto', listStyleType: 'none' });
const item = style({ display: 'flex', alignItems: 'start', gap: 4 });
const jump = style({
  display: 'flex',
  alignItems: 'start',
  gap: 8,
  flexGrow: 1,
  minWidth: 0,
  padding: 8,
  borderRadius: 'lg',
  borderWidth: 0,
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isPressed: 'gray-200' },
  color: 'gray-900',
  textAlign: 'start',
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
});
const badge = style({
  flexShrink: 0,
  size: 20,
  borderRadius: 'full',
  backgroundColor: 'blue-900',
  color: 'gray-25',
  font: 'ui-xs',
  fontWeight: 'bold',
  lineHeight: '[20px]',
  textAlign: 'center',
});
const body = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const where = style({ font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere' });
const note = style({ font: 'ui-sm', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
const panel = style({ width: 360, maxWidth: '[calc(100vw - 32px)]' });
const closeIcon = iconStyle({ size: 'XS' });

/**
 * One item in the list: drafts carry their own id; sent ones use an id built from `sentAnnotationId`, which is temporarily handed to the editor when jumping.
 * `target` is the deck, design or design system directory; `section` is the section of the design system it belongs to.
 */
export interface AnnotationTokenItem {
  id: string;
  target: FileTarget;
  anchor: string;
  section?: string;
  label: string;
  text: string;
}

const COPY = { slides: SLIDES, design: DESIGN, 'design-system': DESIGN_SYSTEM } satisfies Record<AnnotatedEditorKind, unknown>;

/**
 * Reference tag for annotations (slides docs/design/slides §8.2 steps 5 and 6, design docs/design/canvas §8.2, design system §10.6;
 * ported from the prototype's home-slides-notes.jsx `SlideNotesToken`, home-design-notes.jsx `DesignNotesToken`,
 * and home-design-system-notes.jsx `DesignSystemNotesToken`). Above the composer and in sent messages it reads “幻灯片标注 · N 条” (slide annotations · N items),
 * “设计稿标注 · N 条” (design annotations · N items), or “设计系统标注 · N 条” (design system annotations · N items). Opening it lists each item: its position and comment; clicking one opens (or switches to) that document and jumps to that position.
 * When `onRemove` is given it is a draft, and items can be removed one by one or all at once; without it, it is a sent message and is read-only.
 */
export function AnnotationsToken({
  kind,
  items,
  onRemove,
  onClear,
}: {
  kind: AnnotatedEditorKind;
  items: readonly AnnotationTokenItem[];
  onRemove?: (id: string) => void;
  onClear?: () => void;
}) {
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  if (!items.length) return null;
  const draft = !!onRemove;
  const label = copy.token(items.length);
  const reveal = (n: AnnotationTokenItem) => {
    setOpen(false);
    const pane = { kind, target: n.target };
    useShell.getState().openPane(pane);
    useEditorReveal.getState().request(itemKey(pane), n.id, n.anchor, n.section);
  };
  return (
    <span ref={anchorRef} className={token({ isDraft: draft })}>
      <ActionButton isQuiet size="XS" aria-expanded={open} aria-haspopup="dialog" onPress={() => setOpen((v) => !v)}>
        <Comment />
        <Text>{label}</Text>
      </ActionButton>
      {onClear ? (
        <ActionButton isQuiet size="XS" aria-label={copy.removeAll} onPress={onClear}>
          <Close styles={closeIcon} data-cc-icons="own" />
        </ActionButton>
      ) : null}
      <Popover triggerRef={anchorRef} isOpen={open} onOpenChange={setOpen} placement={draft ? 'top start' : 'bottom end'} aria-label={label}>
        <div className={panel}>
          <ol className={list}>
            {items.map((n, i) => (
              <li key={n.id} className={item}>
                <RACButton className={jump} aria-label={copy.item(i + 1, n.label, n.text)} onPress={() => reveal(n)}>
                  <span className={badge}>{i + 1}</span>
                  <span className={body}>
                    <span className={where}>{n.label}</span>
                    <span className={note}>{n.text}</span>
                  </span>
                </RACButton>
                {onRemove ? (
                  <ActionButton
                    isQuiet
                    size="XS"
                    aria-label={copy.removeOne(i + 1)}
                    onPress={() => {
                      if (items.length === 1) setOpen(false);
                      onRemove(n.id);
                    }}>
                    <Close styles={closeIcon} data-cc-icons="own" />
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </Popover>
    </span>
  );
}
