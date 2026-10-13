import { useEffect, useRef, type CSSProperties } from 'react';
import type { TextItem } from '@cuccut/protocol';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { STAGE_COPY } from '../../copy.ts';
import { asObject, resolveLineStyle } from '../../render/text-style.ts';
import type { View } from './stage-boxes.tsx';

const shell = style({ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' });
/** Prototype .txtedit: no second focus ring (the selection box outside already provides one); the caret follows the text color. */
const field = style({
  width: 'full',
  outlineStyle: 'none',
  cursor: 'text',
  minWidth: 12,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  userSelect: 'text',
});

/**
 * In-place text editing (prototype stage-elements.jsx TextEdit): an editable body is laid over the text's selection box, with font, size, color and alignment converted from this text's styles to the stage's display size. The copy on the canvas is hidden first (handled by the overlay). Entering selects the whole text. Enter commits, Shift+Enter inserts a line break, Esc commits and exits,
 * and losing focus also commits. Enter during IME composition does not count. All keys are swallowed locally, so editor shortcuts do not apply while this text is being edited.
 */
export function StageTextEdit({
  item,
  view,
  canvas,
  onDone,
}: {
  item: TextItem;
  view: View;
  canvas: { width: number; height: number };
  /** `text` is null when nothing changed; `byKey` is true when the edit ended with Enter / Esc (focus should return to the stage). */
  onDone(text: string | null, byKey: boolean): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const finish = (byKey: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = (ref.current?.innerText ?? item.text ?? '').replace(/\n+$/, '');
    onDone(value === item.text ? null : value, byKey);
  };

  const line = resolveLineStyle(asObject(item.style), 'original', canvas);
  const k = view.kx;
  const look: CSSProperties = {
    fontFamily: line.fontFamily,
    fontSize: line.fontSize * k,
    fontWeight: line.fontWeight,
    fontStyle: line.italic ? 'italic' : undefined,
    textDecoration: line.underline ? 'underline' : undefined,
    color: line.color,
    letterSpacing: line.letterSpacing * k,
    lineHeight: line.lineHeight,
    textTransform: line.textTransform as CSSProperties['textTransform'],
    textAlign: line.textAlign,
    WebkitTextStroke: line.outline ? `${line.outline.width * k}px ${line.outline.color}` : undefined,
    paintOrder: line.outline ? 'stroke fill' : undefined,
  };

  return (
    <div className={shell} data-stage-editor>
      <div
        ref={ref}
        className={field}
        style={look}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={STAGE_COPY.textEditor}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onBlur={() => finish(false)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
            event.preventDefault();
            finish(true);
          }
        }}
      >
        {item.text}
      </div>
    </div>
  );
}
