import type { AssetRecord, Id, Sequence } from '@cuccut/protocol';
import { Content, Dialog, DialogContainer, Heading } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { create } from 'zustand';
import { VideoPage } from './inspector-video.tsx';
import { EDITOR_LAYOUT_COPY as L } from './editor-layout-copy.ts';

const body = style({ display: 'flex', flexDirection: 'column', gap: 8 });

const useVideoSettings = create<{ open: boolean }>(() => ({ open: false }));

/** Open the video's own settings (canvas, background, format) — the header's Video menu and the empty inspector both do. */
export function openVideoSettings(): void {
  useVideoSettings.setState({ open: true });
}

/**
 * The video as a whole, in a dialog of its own (agentcut's "Video settings" behind the header's Video menu): the right
 * column is about the selection and nothing else, so what used to be the properties page with nothing selected lives here.
 */
export function VideoSettingsDialog({ sequence, assets }: { sequence: Sequence; assets: Record<Id, AssetRecord> }) {
  const open = useVideoSettings((s) => s.open);
  return (
    <DialogContainer onDismiss={() => useVideoSettings.setState({ open: false })}>
      {open ? (
        <Dialog size="M" isDismissible>
          <Heading slot="title">{L.videoSettings}</Heading>
          <Content>
            <div className={body}>
              <VideoPage sequence={sequence} assets={assets} />
            </div>
          </Content>
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}
