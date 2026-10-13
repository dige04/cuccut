import { describe, expect, it } from 'vitest';
import { generatedImageGallery, imageFit, imagePoint, imageRegion, imageZoomStep, appendImageRequest } from './image-preview.ts';
import type { SpaceEntry } from '@cuccut/protocol';

describe('image preview model', () => {
  it('annotation coordinates do not depend on display scale; out-of-bounds values clamp to the image edge', () => {
    const a = imagePoint({ x: 150, y: 100 }, { left: 100, top: 50, width: 100, height: 100 })!;
    const b = imagePoint({ x: 200, y: 150 }, { left: 100, top: 50, width: 200, height: 200 })!;
    expect(a).toEqual(b);
    expect(imageRegion(a, { x: 0.2, y: 0.1 })).toEqual({ x: 0.2, y: 0.1, width: 0.3, height: 0.4 });
    expect(imagePoint({ x: -1, y: 999 }, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 1 });
    expect(imagePoint(a, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });
  it('fit-to-window does not enlarge small images; zoom uses steps with upper and lower limits', () => {
    expect(imageFit({ width: 100, height: 100 }, { width: 600, height: 600 })).toBe(1);
    expect(imageFit({ width: 1000, height: 500 }, { width: 548, height: 548 })).toBe(0.5);
    expect(imageZoomStep(83, 1)).toBe(100);
    expect(imageZoomStep(83, -1)).toBe(75);
    expect(imageZoomStep(25, -1)).toBe(10);
    expect(imageZoomStep(300, 1)).toBe(400);
  });
  it('groups only same-task candidates; does not merge standalone images, other sessions or recycled files', () => {
    const entry = (id: string, jobId?: string, conversationId = 'c1', trash: string | null = null): SpaceEntry => ({ id, kind: 'image', name: id, fileName: `${id}.png`, source: { projectId: 'p1', conversationId: null }, relPath: `${id}.png`, size: 1, lastActivityAt: '', status: null, user: { favorite: false, displayName: null, trashedAt: trash }, origin: { source: 'generated', jobId, conversationId } });
    const entries = [entry('a', 'j1'), entry('b', 'j1'), entry('c', 'j2'), entry('d', 'j1', 'c2'), entry('e', 'j1', 'c1', 'now')];
    expect(generatedImageGallery({ target: { entryId: 'a' }, name: 'a' }, entries).map(i => i.name)).toEqual(['a', 'b']);
    expect(generatedImageGallery({ target: { conversationId: 'c1', path: 'single.png' }, name: 'single' }, entries)).toHaveLength(1);
  });
  it('appended requests do not delete existing spaces or line breaks', () => {
    expect(appendImageRequest(' draft \n', 'request')).toBe(' draft \n\n\nrequest');
  });
});

it('canvas merges generated groups by session and deduplicates; standalone images and uploaded attachments are not mixed in', async()=>{
  const {canvasImageCandidates}=await import('./image-preview.ts');
  const a={target:{conversationId:'c1',path:'a.png'},name:'a',conversationId:'c1',generated:true};
  const b={...a,target:{conversationId:'c1',path:'b.png'},name:'b'};
  const unrelated={...b,conversationId:'c2'};
  expect(canvasImageCandidates([a],{first:[a],second:[b],other:[unrelated]},'c1').map(x=>x.name)).toEqual(['a','b']);
  const single={...a,generated:false};expect(canvasImageCandidates([single],{second:[b]},'c1')).toEqual([single]);
});
