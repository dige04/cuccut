import { useEffect, useId, useState } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { Download, FolderOpen, LoaderCircle } from 'lucide-react';
import { Button } from '../../../cc/ui/button.tsx';
import { Input } from '../../../cc/ui/input.tsx';
import { packErrorMessage, previewBlockedReason } from '../../../model/packs.ts';
import { useRuntime } from '../../../runtime/context.tsx';
import { clearPackPreview, inspectPack, installPack, restorePack } from '../../../runtime/pack-commands.ts';
import { useConnection } from '../../../state/connection-store.ts';
import { usePacks } from '../../../state/packs-store.ts';
import { useShell } from '../../../state/shell-store.ts';
import { PACKS_COPY } from '../packs-copy.ts';
import { Panel } from '../settings-ui.tsx';
import { PackPreviewPanels } from './pack-preview.tsx';
import { ErrorLine, PacksPageHeader, packsRoute } from './packs-ui.tsx';

const I = () => PACKS_COPY.import;

/**
 * Settings › Packs › Import a pack (pack design §2.3, agentcut `ImportFlow`): a folder, a GitHub address or a web
 * address is read into a preview (`packs.inspect`), and nothing is installed until the person has seen everything it
 * carries. Install takes the preview's token, so what is installed is exactly what was read; a preview older than 30
 * minutes says to read it again.
 *
 * One tinted action at a time: "Read it" until there is a preview, then "Install". "Install and replace mine" shows
 * only when an item clashes with one of the person's own; what it moves to the trash comes back with the toast's Undo.
 * Leaving the page forgets the preview. Reading and installing
 * write to the Runtime Home, so a browser shows where it is done instead.
 */
export function PackImport() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const id = useId();
  const go = useShell((s) => s.go);
  const connected = useConnection((s) => s.state.status === 'connected');
  const preview = usePacks((s) => s.preview);
  const [source, setSource] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [installing, setInstalling] = useState<'install' | 'replace' | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  // A preview belongs to this page: leaving it (or opening it afresh) starts from nothing.
  useEffect(() => {
    clearPackPreview();
    return () => clearPackPreview();
  }, []);

  if (web) {
    return (
      <div data-cc className="flex min-w-0 flex-col gap-5">
        <PacksPageHeader title={I().title} blurb={I().lede} />
        <p className="m-0 text-sm text-muted-foreground">{PACKS_COPY.webOnly}</p>
      </div>
    );
  }

  const read = async (from = source) => {
    if (!from.trim() || reading) return;
    setReading(true);
    setReadError(null);
    setInstallError(null);
    try {
      await inspectPack(runtime, from);
    } catch (error) {
      setReadError(packErrorMessage(error, 'read'));
    } finally {
      setReading(false);
    }
  };

  const choose = async () => {
    const picked = await runtime.host.pickDirectory({ title: I().pickTitle });
    if (!picked) return;
    setSource(picked);
    await read(picked);
  };

  const install = async (replace: boolean) => {
    if (!preview || installing) return;
    setInstalling(replace ? 'replace' : 'install');
    setInstallError(null);
    try {
      const result = await installPack(runtime, preview, replace);
      go(packsRoute());
      // "Install and replace mine" moved the person's own items to the trash: say so, and offer them back.
      const replaced = result.replaced;
      if (replaced) {
        ToastQueue.neutral(I().replacedToast(result.pack.name, replaced.templates.length + replaced.skills.length), {
          timeout: 8000,
          actionLabel: PACKS_COPY.pack.undo,
          shouldCloseOnAction: true,
          onAction: () => {
            restorePack(runtime, replaced.trashId).then(
              () => ToastQueue.positive(I().replacedRestored, { timeout: 4000 }),
              (reason: unknown) => ToastQueue.negative(packErrorMessage(reason, 'restore'), { timeout: 8000 }),
            );
          },
        });
      }
    } catch (error) {
      setInstallError(packErrorMessage(error, 'install'));
    } finally {
      setInstalling(null);
    }
  };

  const cancel = () => {
    clearPackPreview();
    go(packsRoute());
  };

  const readReason = !connected ? PACKS_COPY.list.disconnected : !source.trim() ? I().needSource : null;
  const blocked = preview ? previewBlockedReason(preview) : null;

  return (
    <div data-cc className="flex min-w-0 flex-col gap-5">
      <PacksPageHeader title={I().title} blurb={I().lede} />
      <Panel>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void read();
          }}>
          <label htmlFor={`${id}-source`} className="text-sm font-medium text-foreground">
            {I().sourceLabel}
          </label>
          <div className="flex flex-col gap-2 @md:flex-row">
            <Input
              id={`${id}-source`}
              value={source}
              spellCheck={false}
              autoComplete="off"
              placeholder={I().sourcePlaceholder}
              aria-describedby={`${id}-why`}
              className="min-w-0 flex-1 font-mono text-xs md:text-xs"
              onChange={(event) => {
                setSource(event.target.value);
                setReadError(null);
                if (preview) clearPackPreview();
              }}
            />
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" disabled={reading} onClick={() => void choose()}>
                <FolderOpen aria-hidden />
                {I().chooseFolder}
              </Button>
              <Button type="submit" variant={preview ? 'outline' : 'default'} disabled={reading || readReason !== null} title={readReason ?? undefined}>
                {reading ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : null}
                {reading ? I().reading : I().read}
              </Button>
            </div>
          </div>
          <span id={`${id}-why`} className="sr-only">
            {readReason ?? ''}
          </span>
          <ErrorLine>{readError}</ErrorLine>
        </form>
      </Panel>

      {preview ? (
        <>
          <PackPreviewPanels preview={preview} />
          <div className="flex flex-col gap-2">
            <ErrorLine>{installError}</ErrorLine>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={installing !== null || blocked !== null} title={blocked ?? undefined} aria-describedby={blocked ? `${id}-blocked` : undefined} onClick={() => void install(false)}>
                {installing === 'install' ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : <Download aria-hidden />}
                {installing === 'install' ? I().installing : I().install}
              </Button>
              {preview.clashes ? (
                <Button variant="outline" disabled={installing !== null || blocked !== null} title={blocked ?? I().replaceHint} onClick={() => void install(true)}>
                  {installing === 'replace' ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : null}
                  {I().replace}
                </Button>
              ) : null}
              <Button variant="ghost" disabled={installing !== null} onClick={cancel}>
                {I().cancel}
              </Button>
            </div>
            {blocked ? (
              <p id={`${id}-blocked`} className="m-0 text-xs text-destructive">
                {blocked}
              </p>
            ) : preview.clashes ? (
              <p className="m-0 text-xs text-muted-foreground">{I().replaceHint}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
