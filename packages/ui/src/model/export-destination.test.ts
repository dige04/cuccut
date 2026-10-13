import { describe, expect, it, vi } from 'vitest';
import type { HostBridge } from '../host.ts';
import { pickExportDestination } from './export-destination.ts';

const labels = { title: 'Export', button: 'Export', pickPlace: 'Choose location' };
const hostFor = (file: string | null, platform = 'darwin') => ({
  platform, pickSavePath: vi.fn(async () => file), pickDirectory: vi.fn(async () => '/chosen'),
}) as unknown as HostBridge;

describe('export destination confirmation', () => {
  it('opens the save dialog with the default name and folder, and keeps the file name the user changed', async () => {
    const host = hostFor('/chosen/最终成片.mp4');
    expect(await pickExportDestination(host, ['访谈.zh-Hans.mp4'], '/source', labels)).toEqual({ dir: '/chosen', fileName: '最终成片.mp4', overwrite: true });
    expect(host.pickSavePath).toHaveBeenCalledExactlyOnceWith({
      title: 'Export', buttonLabel: 'Export', defaultName: '访谈.zh-Hans.mp4', defaultDir: '/source',
      filters: [{ name: 'MP4', extensions: ['mp4'] }],
    });
    expect(host.pickDirectory).not.toHaveBeenCalled();
  });
  it('cancelling the save dialog returns cancel, does not fall back to the default location; failures are reported to the caller', async () => {
    expect(await pickExportDestination(hostFor(null), ['访谈.mp4'], '/source', labels)).toBeNull();
    const host = hostFor(null);
    vi.mocked(host.pickSavePath!).mockRejectedValue(new Error('dialog failed'));
    await expect(pickExportDestination(host, ['访谈.mp4'], null, labels)).rejects.toThrow('dialog failed');
  });
  it('when Runtime appends the extension, does not overwrite another file not confirmed in the system dialog', async () => {
    for (const file of ['/chosen/改名', '/chosen/改名.mov']) {
      expect(await pickExportDestination(hostFor(file), ['访谈.mp4'], null, labels)).toMatchObject({ overwrite: false });
    }
    expect(await pickExportDestination(hostFor('/chosen/改名.MP4'), ['访谈.mp4'], null, labels)).toMatchObject({ overwrite: true });
  });
  it('multiple files choose the directory once, and do not give all outputs the same file name', async () => {
    const host = hostFor(null);
    expect(await pickExportDestination(host, ['访谈.part1.mp4', '访谈.part2.mp4'], null, labels)).toEqual({ dir: '/chosen' });
    expect(host.pickDirectory).toHaveBeenCalledExactlyOnceWith({ title: 'Choose location' });
    expect(host.pickSavePath).not.toHaveBeenCalled();
    vi.mocked(host.pickDirectory).mockResolvedValue(null);
    expect(await pickExportDestination(host, ['a.wav', 'b.wav'], null, labels)).toBeNull();
  });
  it('web keeps Runtime\'s destination and does not call the native picker', async () => {
    const host = { platform: 'web', pickDirectory: vi.fn() } as unknown as HostBridge;
    expect(await pickExportDestination(host, ['访谈.mp4'], null, labels)).toEqual({});
    expect(await pickExportDestination(host, ['访谈.mp4'], '/project/exports', labels)).toEqual({ dir: '/project/exports' });
    expect(host.pickDirectory).not.toHaveBeenCalled();
  });
  it.each([
    ['darwin', '/最终 成片.mp4', '/'],
    ['darwin', '/output/反\\斜线.mp4', '/output'],
    ['win32', 'C:\\最终 成片.mp4', 'C:\\'],
    ['win32', 'C:/output/最终 成片.mp4', 'C:/output'],
    ['win32', '\\\\server\\共享\\最终 成片.mp4', '\\\\server\\共享'],
    ['win32', '\\\\?\\C:\\output\\最终 成片.mp4', '\\\\?\\C:\\output'],
    ['win32', '\\\\?\\UNC\\server\\共享\\最终 成片.mp4', '\\\\?\\UNC\\server\\共享'],
  ])('correctly splits %s path %s', async (platform, file, dir) => {
    const destination = await pickExportDestination(hostFor(file, platform), ['访谈.mp4'], null, labels);
    expect(destination?.dir).toBe(dir);
    expect(destination?.fileName).toBe(platform === 'darwin' && file.includes('\\') ? '反\\斜线.mp4' : '最终 成片.mp4');
  });
});
