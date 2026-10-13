import { describe, expect, it } from 'vitest';
import { DEVICE_PRESETS, deviceFrame, WEB_ZOOM_STEPS, displayUrl, resolveAddress, webShortcut, zoomStep } from './web-address.ts';

describe('web tab address bar', () => {
  it('URL-like input opens as a URL, with the protocol added', () => {
    expect(resolveAddress('example.com')).toBe('https://example.com/');
    expect(resolveAddress('  example.com/a?b=1  ')).toBe('https://example.com/a?b=1');
    expect(resolveAddress('http://example.com')).toBe('http://example.com/');
    expect(resolveAddress('localhost:3000')).toBe('http://localhost:3000/');
    expect(resolveAddress('127.0.0.1:8080/x')).toBe('http://127.0.0.1:8080/x');
    expect(resolveAddress('example.com:8443')).toBe('https://example.com:8443/');
  });

  it('invalid URLs return null: non-http/https, or containing credentials', () => {
    expect(resolveAddress('file:///etc/passwd')).toBeNull();
    expect(resolveAddress('javascript:alert(1)')).toBeNull();
    expect(resolveAddress('https://user:pw@example.com')).toBeNull();
    expect(resolveAddress('   ')).toBeNull();
  });

  it('everything else is treated as a search term and goes to Google', () => {
    expect(resolveAddress('剪辑 教程')).toBe('https://www.google.com/search?q=%E5%89%AA%E8%BE%91%20%E6%95%99%E7%A8%8B');
    expect(resolveAddress('react hooks')).toBe('https://www.google.com/search?q=react%20hooks');
  });

  it('the URL shown at rest omits the protocol and the root path', () => {
    expect(displayUrl('https://example.com/')).toBe('example.com');
    expect(displayUrl('https://example.com:8443/a/b?q=1#top')).toBe('example.com:8443/a/b?q=1#top');
    expect(displayUrl('')).toBe('');
  });
});

describe('web tab shortcuts', () => {
  const key = (over: Partial<Parameters<typeof webShortcut>[0]>) => ({
    key: 'l',
    code: 'KeyL',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
  });

  it('macOS uses ⌘, other platforms use Ctrl; judged by physical key', () => {
    expect(webShortcut(key({ metaKey: true }), true)).toBe('focus-address');
    expect(webShortcut(key({ metaKey: true, key: 'r', code: 'KeyR' }), true)).toBe('reload');
    expect(webShortcut(key({ metaKey: true, shiftKey: true, code: 'KeyR' }), true)).toBe('force-reload');
    expect(webShortcut(key({ ctrlKey: true, code: 'KeyF' }), false)).toBe('find');
    expect(webShortcut(key({ metaKey: true, key: 'ｌ' }), true)).toBe('focus-address');
    expect(webShortcut(key({ ctrlKey: true }), false)).toBe('focus-address');
    expect(webShortcut(key({ ctrlKey: true }), true)).toBeNull();
    expect(webShortcut(key({ metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(webShortcut(key({}), true)).toBeNull();
    expect(webShortcut(key({ metaKey: true, key: 'k', code: 'KeyK' }), true)).toBeNull();
  });
});

describe('web page zoom', () => {
  it('zooms in and out one step at a time, and stops at the limits', () => {
    expect(zoomStep(100, 1)).toBe(110);
    expect(zoomStep(100, -1)).toBe(90);
    expect(zoomStep(200, 1)).toBe(200);
    expect(zoomStep(50, -1)).toBe(50);
    expect(zoomStep(80, 1)).toBe(90);
    expect(zoomStep(80, -1)).toBe(75);
    expect(WEB_ZOOM_STEPS[0]).toBe(50);
    expect(WEB_ZOOM_STEPS.at(-1)).toBe(200);
  });
});

it('device viewport scales proportionally to fit the current panel, without exceeding the native view bounds', () => {
  expect(deviceFrame(DEVICE_PRESETS.phone, { width: 422, height: 876 })).toEqual(DEVICE_PRESETS.phone);
  const frame = deviceFrame({ width: 1440, height: 900 }, { width: 752, height: 482 });
  expect(frame).toEqual({ width: 720, height: 450 });
  expect(deviceFrame(DEVICE_PRESETS.phone, { width: 0, height: 0 })).toEqual({ width: 0, height: 0 });
});
