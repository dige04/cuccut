import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveEditorFile, type EditorExportCopy } from './editor-save-file.ts';

const mocks = vi.hoisted(() => ({ positive: vi.fn(), negative: vi.fn(), downloadBlob: vi.fn() }));
vi.mock('@react-spectrum/s2', () => ({ ToastQueue: { positive: mocks.positive, negative: mocks.negative } }));
vi.mock('../media/gif.ts', () => ({ downloadBlob: mocks.downloadBlob }));

const copy: EditorExportCopy = {
  exportMenu: 'Export',
  exportHtml: 'HTML',
  exportPdf: 'PDF',
  exportPng: 'PNG',
  exportDialogTitle: 'Export design',
  exportDialogButton: 'Export',
  exportSaved: (path) => `saved ${path}`,
  exportFailed: (reason) => `failed ${reason}`,
  exportUnsupported: (name) => `unsupported ${name}`,
};

beforeEach(() => vi.clearAllMocks());

describe('saves the export file handed over by the editor', () => {
  it('Web: assigns the type from the extension and hands it to the browser download, with no extra prompt', async () => {
    const data = new ArrayBuffer(3);
    expect(await saveEditorFile({}, { filename: 'Landing/page.html', data }, copy)).toBe('saved');
    expect(mocks.downloadBlob).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), 'Landing page.html');
    const html = mocks.downloadBlob.mock.calls[0]![0] as Blob;
    expect([html.type, html.size]).toEqual(['text/html', 3]);
    expect(mocks.positive).not.toHaveBeenCalled();
    await saveEditorFile({}, { filename: 'Main@1x.PNG', data: new Blob(['png'], { type: 'text/plain' }) }, copy);
    const png = mocks.downloadBlob.mock.calls[1]![0] as Blob;
    expect([png.type, await png.text()]).toEqual(['image/png', 'png']);
  });

  it('desktop: the save dialog filters by extension, and shows the path after saving', async () => {
    const saveFile = vi.fn(async () => '/Users/me/Desktop/Landing.png');
    expect(await saveEditorFile({ saveFile }, { filename: 'Landing.png', data: new Blob([new Uint8Array([1, 2])]) }, copy)).toBe('saved');
    expect(saveFile).toHaveBeenCalledExactlyOnceWith({
      title: 'Export design',
      buttonLabel: 'Export',
      defaultName: 'Landing.png',
      filters: [{ name: 'PNG', extensions: ['png'] }],
      data: new Uint8Array([1, 2]),
    });
    expect(mocks.positive).toHaveBeenCalledWith('saved ~/Desktop/Landing.png', expect.anything());
  });

  it('desktop: cancel returns declined with no prompt; a write failure returns failed and shows the reason', async () => {
    expect(await saveEditorFile({ saveFile: async () => null }, { filename: 'a.zip', data: new ArrayBuffer(1) }, copy)).toBe('declined');
    expect(mocks.positive).not.toHaveBeenCalled();
    expect(mocks.negative).not.toHaveBeenCalled();
    const broken = async () => {
      throw new Error('disk full');
    };
    expect(await saveEditorFile({ saveFile: broken }, { filename: 'a.zip', data: new ArrayBuffer(1) }, copy)).toBe('failed');
    expect(mocks.negative).toHaveBeenCalledWith('failed disk full', expect.anything());
  });

  it('extension outside the allowed range: not saved, returns failed', async () => {
    const saveFile = vi.fn(async () => '/x');
    expect(await saveEditorFile({ saveFile }, { filename: 'run.exe', data: new ArrayBuffer(1) }, copy)).toBe('failed');
    expect(saveFile).not.toHaveBeenCalled();
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
    expect(mocks.negative).toHaveBeenCalledWith('unsupported run.exe', expect.anything());
  });
});
