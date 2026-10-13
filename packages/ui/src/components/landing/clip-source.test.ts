import { describe, expect, it } from 'vitest';
import { clipSourceError, normalizeClipSource } from './clip-source.ts';
import { LANDING_COPY } from './landing-copy.ts';

describe('normalizeClipSource', () => {
  it('adds https:// to a bare web address with a path or www.', () => {
    expect(normalizeClipSource('  youtube.com/watch?v=abc ')).toBe('https://youtube.com/watch?v=abc');
    expect(normalizeClipSource('youtu.be/xyz')).toBe('https://youtu.be/xyz');
    expect(normalizeClipSource('www.example.com')).toBe('https://www.example.com');
  });

  it('leaves full links, paths and bare file names alone', () => {
    expect(normalizeClipSource('https://youtube.com/watch?v=abc')).toBe('https://youtube.com/watch?v=abc');
    expect(normalizeClipSource('/Users/me/talk.mp4')).toBe('/Users/me/talk.mp4');
    expect(normalizeClipSource('notes.txt')).toBe('notes.txt');
    expect(normalizeClipSource('clip.mp4')).toBe('clip.mp4');
  });
});

describe('clipSourceError', () => {
  it('accepts links (with or without the scheme) and local video files', () => {
    expect(clipSourceError('youtube.com/watch?v=abc')).toBeNull();
    expect(clipSourceError('https://vimeo.com/123')).toBeNull();
    expect(clipSourceError('/Users/me/talk.mov')).toBeNull();
  });

  it('says what is wrong otherwise', () => {
    expect(clipSourceError('   ')).toBe(LANDING_COPY.clips.empty);
    expect(clipSourceError('notes.txt')).toBe(LANDING_COPY.clips.notVideo);
    expect(clipSourceError('/Users/me/notes.pdf')).toBe(LANDING_COPY.clips.notVideo);
  });
});
