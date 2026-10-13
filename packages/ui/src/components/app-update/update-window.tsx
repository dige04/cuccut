import { useRef } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Button, ProgressBar } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { XIcon } from 'lucide-react';
import { Button as CcButton } from '../../cc/ui/button.tsx';
import { Dialog, DialogContent, DialogFooter } from '../../cc/ui/dialog.tsx';
import type { DialogView } from '../../model/app-update.ts';
import { U } from './update-copy.ts';
import { useUpdateActions } from './use-update-actions.ts';

/*
 * 更新窗（设计稿 settings-update.jsx `UpdateWindow`、settings-update.css `.upddlg`）：模态，宽 480。头是标题、
 * 「CucCut 2.3.0 · Build 57」与关闭；正文是当前版本一句（已下载时接着说退出时也会装）、「更新内容」与全部说明（可滚）；
 * 底栏随态。×、Esc、点背景、「稍后」都只关窗；「重启并更新」与关于页、toast 走同一个动作。
 *
 * The surface is agentcut's dialog (cc/ui/dialog.tsx): 20px corners, near-black translucent material, a fine lit
 * edge, a blurred dim backdrop; the footer sits on a darker strip under a fine line.
 */

const frame = style({ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '[min(560px, calc(100vh - 96px))]' });
const head = style({ display: 'flex', alignItems: 'start', gap: 12 });
const headText = style({ flexGrow: 1, minWidth: 0 });
const title = style({ margin: 0, font: 'title', color: 'gray-900' });
const sub = style({ marginTop: 2, font: 'ui-sm', color: 'gray-600' });
const body = style({ flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: 'auto', marginTop: 16 });
const current = style({ marginTop: 0, marginBottom: 16, font: 'body-sm', color: 'gray-800' });
const notesTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const notes = style({ marginTop: 8, marginBottom: 0, paddingStart: 20, font: 'body-sm', color: 'gray-700', userSelect: 'text' });
const note = style({ marginTop: { default: 0, ':nth-child(n+2)': 4 } });
const left = style({ display: 'flex', alignItems: 'center', gap: 8, flexGrow: 1, minWidth: 0 });
const progress = style({ width: 120, flexShrink: 0 });
/** 按钮不让位：左边的进度、出错与等待说明换行，按钮的字不折。 */
const actions = style({ display: 'flex', gap: 8, flexShrink: 0 });
const leftText = style({ font: 'ui-sm', color: { default: 'gray-700', isError: 'negative-900' }, fontVariantNumeric: 'tabular-nums' });

/** The update window; `view` is null while there is nothing to show (the last view stays for the closing animation). */
export function UpdateWindow({ open, view, onClose }: { open: boolean; view: DialogView | null; onClose: () => void }) {
  const last = useRef<DialogView | null>(null);
  if (view) last.current = view;
  const shown = view ?? last.current;
  return (
    <Dialog open={open && view !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className="flex w-[min(480px,calc(100%-2rem))] flex-col gap-0 overflow-hidden sm:max-w-[min(480px,calc(100%-2rem))]">
        {shown ? <UpdateBody view={shown} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function UpdateBody({ view, onClose }: { view: DialogView; onClose: () => void }) {
  const act = useUpdateActions();
  const f = view.footer;
  return (
    <div className={frame}>
      <div className={head}>
        <div className={headText}>
          <DialogPrimitive.Title className={title}>{view.title}</DialogPrimitive.Title>
          <div className={sub}>{view.sub}</div>
        </div>
        {/* The dialog is portalled outside any `data-cc` subtree; the cc button needs the scoped preflight. */}
        <span data-cc="" className="contents">
          <CcButton variant="ghost" size="icon-sm" aria-label={U.close} title={U.close} onClick={onClose}>
            <XIcon aria-hidden />
          </CcButton>
        </span>
      </div>
      <div className={body}>
        {view.current || view.note ? <p className={current}>{[view.current, view.note].filter(Boolean).join('')}</p> : null}
        <div className={notesTitle}>{view.notesTitle}</div>
        <ul className={notes}>
          {view.notes.map((text, i) => (
            <li key={i} className={note}>
              {text}
            </li>
          ))}
        </ul>
      </div>
      {/* agentcut's dialog footer: the darker strip under a fine line; progress and notes on the left. */}
      <DialogFooter className="mt-5 items-stretch py-4 sm:items-center">
        <div className={left}>
          {f.left && 'progress' in f.left ? (
            <>
              <ProgressBar size="S" aria-label={U.progress} value={f.left.progress} styles={progress} />
              <span className={leftText({})}>{f.left.text}</span>
            </>
          ) : null}
          {f.left && 'error' in f.left ? <span className={leftText({ isError: true })}>{f.left.error}</span> : null}
          {f.left && 'note' in f.left ? <span className={leftText({})}>{f.left.note}</span> : null}
        </div>
        <div className={actions}>
          {f.buttons.map((b) => (
            <Button key={b.k} variant={b.variant} onPress={() => act(b.k)}>
              {b.label}
            </Button>
          ))}
        </div>
      </DialogFooter>
    </div>
  );
}
