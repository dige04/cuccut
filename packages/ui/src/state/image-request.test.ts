import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MAX_ATTACHMENTS_PER_MESSAGE, type MediaHandle } from '@cuccut/protocol';
import { addImageRequest } from './image-request.ts';
import { useDraftImages } from './draft-images-store.ts';
import { useShell } from './shell-store.ts';
const handle: MediaHandle = { url: 'http://localhost/media/test', mimeType: 'image/png', size: 3, fileName: 'a.png', expiresAt: '' };
const target = { conversationId: 'c1', path: 'a.png' };
beforeEach(() => { useDraftImages.setState({ images: {} }); useShell.setState({ drafts: { c1: 'existing' } }); });
afterEach(() => { useDraftImages.getState().clear('c1'); vi.unstubAllGlobals(); });
it('new text typed during reading is kept, a duplicate image is attached only once, the request is not sent automatically', async () => {
  let finish!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', fetch);
  const promise = addImageRequest('c1', target, handle, 'a.png', {} as HTMLImageElement, 'change');
  useShell.getState().setDraft('c1', 'typed while reading');
  finish(new Response(Uint8Array.of(1, 2, 3))); await promise;
  expect(useShell.getState().drafts.c1).toBe('typed while reading\n\nchange');
  await addImageRequest('c1', target, handle, 'a.png', {} as HTMLImageElement, 'ratio');
  expect(useDraftImages.getState().images.c1).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('a read failure does not pollute the draft and attachments; when full, files are not read either', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('', { status: 404 })); vi.stubGlobal('fetch', fetch);
  await expect(addImageRequest('c1', target, handle, 'a.png', {} as HTMLImageElement, 'change')).rejects.toThrow('404');
  expect(useShell.getState().drafts.c1).toBe('existing');
  expect(useDraftImages.getState().images.c1).toBeUndefined();
  useDraftImages.getState().add('c1', Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, i) => ({ id: String(i), file: new File([], 'test.png'), url: 'blob:test' })));
  await expect(addImageRequest('c1', target, handle, 'a.png', {} as HTMLImageElement, 'change')).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('a failed batch preparation does not modify the draft; the second check protects attachments added during reading',async()=>{
  const {addImageBatch}=await import('./image-request.ts');
  const fetch=vi.fn().mockResolvedValue(new Response('',{status:404}));vi.stubGlobal('fetch',fetch);
  await expect(addImageBatch('c1',[{target,handle,name:'a.png',image:{} as HTMLImageElement}], 'batch')).rejects.toThrow();
  expect(useShell.getState().drafts.c1).toBe('existing');expect(useDraftImages.getState().images.c1).toBeUndefined();
});

it('an edit request where the composer already has images does not attach the images again',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  useDraftImages.getState().add('c1',[{id:'img_existing',file:new File(['x'],'a.png',{type:'image/png'}),url:'blob:existing'}]);
  await addImageRequest('c1',{conversationId:'c1',attachmentId:'img_existing'},handle,'a.png',{} as HTMLImageElement,'adjust');
  expect(fetch).not.toHaveBeenCalled();expect(useDraftImages.getState().images.c1).toHaveLength(1);
  expect(useShell.getState().drafts.c1).toBe('existing\n\nadjust');
});
