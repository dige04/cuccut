import {expect,it} from 'vitest';
import type {SpaceEntry} from '@cuccut/protocol';
import {previewMemoryKey} from './media.ts';
it('body, file tag and Space share the same media playback state',()=>{
  const entries=[{id:'e1',source:{projectId:'p1'},relPath:'clip.mp4'} as SpaceEntry];
  const conversations=[{id:'c1',projectId:'p1'}];
  const keys=[{entryId:'e1'},{projectId:'p1',path:'clip.mp4'},{conversationId:'c1',path:'clip.mp4'}].map(target=>previewMemoryKey(target,entries,conversations));
  expect(new Set(keys).size).toBe(1);
  expect(previewMemoryKey({conversationId:'c1',attachmentId:'a1'},entries,conversations)).not.toBe(keys[0]);
});
it('absolute paths are not mistaken for project-relative paths; Windows and Unix behave the same',()=>{
  expect(previewMemoryKey({conversationId:'c1',path:'C:\\Video\\clip.mp4'},[],[{id:'c1',projectId:'p1'}])).toBe('conv:c1:C:\\Video\\clip.mp4');
  expect(previewMemoryKey({conversationId:'c1',path:'/tmp/clip.mp4'},[],[{id:'c1',projectId:'p1'}])).toBe('conv:c1:/tmp/clip.mp4');
});
