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

/** composer 上方与 Space 条目的引用标签同一个样子（composer.tsx `tag`）；已发送消息里只是一行淡色的标记。 */
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
/** 原型 home-slides.css `.home-slides-notes__list` 起的那几样。 */
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
 * 列表里的一条：草稿里的带自己的 id；已发送的用 `sentAnnotationId` 拼的 id，跳转时临时交给编辑器。
 * `target` 是 deck、设计稿或设计系统目录；`section` 是设计系统里它所在的章节。
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
 * 标注的引用标签（幻灯片 docs/design/slides §8.2 第 5、6 步、设计稿 docs/design/canvas §8.2、设计系统 §10.6；
 * 移植自原型 home-slides-notes.jsx `SlideNotesToken`、home-design-notes.jsx `DesignNotesToken`、
 * home-design-system-notes.jsx `DesignSystemNotesToken`）：composer 上方与已发送的消息里都是「幻灯片标注 · N 条」
 * 「设计稿标注 · N 条」「设计系统标注 · N 条」。点开列出各条：位置、批注，点一条打开（或切到）那份文档并跳到那个位置。
 * 给了 `onRemove` 是草稿，可以逐条移除或全部移除；不给是已发送的消息，只读。
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
