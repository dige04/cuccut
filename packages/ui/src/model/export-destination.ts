import type { ExportDestination } from '@cuccut/protocol';
import type { HostBridge } from '../host.ts';

/** null means the user cancelled; the web has no native save capability, so the Runtime still does the saving. */
export async function pickExportDestination(
  host: HostBridge,
  names: readonly string[],
  dir: string | null,
  labels: { title: string; button: string; pickPlace: string },
): Promise<ExportDestination | null> {
  if (!host.pickSavePath) return dir ? { dir } : {};
  if (names.length !== 1) {
    const picked = await host.pickDirectory({ title: labels.pickPlace });
    return picked ? { dir: picked } : null;
  }
  const name = names[0]!;
  const extension = name.slice(name.lastIndexOf('.') + 1);
  const file = await host.pickSavePath({
    title: labels.title,
    buttonLabel: labels.button,
    defaultName: name,
    ...(dir ? { defaultDir: dir } : {}),
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (!file) return null;
  const cut = host.platform === 'win32' ? Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\')) : file.lastIndexOf('/');
  // A root directory must keep its separator (/ and C:\); UNC / extended-path prefixes are passed to the Runtime unchanged.
  const root = cut === 0 || (cut === 2 && /^[A-Za-z]:/.test(file));
  const fileName = file.slice(cut + 1);
  // The Runtime appends the format extension; the other file it appends was not confirmed in a system dialog, so it must not replace the existing file.
  const overwrite = fileName.toLowerCase().endsWith(`.${extension.toLowerCase()}`);
  return { dir: file.slice(0, cut + (root ? 1 : 0)), fileName, overwrite };
}
