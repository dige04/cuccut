import type { ReactNode } from 'react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { VideoEditor } from './video-editor.tsx';
import { EDITOR_COPY as E } from './editor-copy.ts';

const editorArea = style({ position: 'relative', display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, minHeight: 0 });

/**
 * Content area after a video is opened in Space (product design §2.1, §5.1, user revision): only the editor, with a floating session (`overlay`) at the bottom right. Home's video is in a tab of the function bar (workspace/workspace-panes.tsx); the layout of the session column and the editor is in HomePage. Opening and closing the video follows routing and the function-bar tabs (see AppShell); this file only handles layout.
 */
export function EditorWorkspace({ overlay }: { overlay?: ReactNode }) {
  return (
    <section className={editorArea} aria-label={E.editor}>
      <VideoEditor />
      {overlay}
    </section>
  );
}
