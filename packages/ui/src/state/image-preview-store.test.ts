import { beforeEach, expect, it } from 'vitest';
import { useImagePreview } from './image-preview-store.ts';
beforeEach(() => useImagePreview.setState({ notes: {}, groups: {}, activeGroups: {} }));
it('switching images keeps each one\'s annotation draft; editing does not create duplicates; deleting clears the matching edit draft', () => {
  const store = useImagePreview.getState();
  const region = { x: .2, y: .3, width: .4, height: .1 };
  store.patch('a', { region, text: 'A' }); store.patch('b', { region, text: 'B' });
  store.save('a');
  expect(useImagePreview.getState().notes.b?.draft.text).toBe('B');
  const id = useImagePreview.getState().notes.a!.comments[0]!.id;
  store.patch('a', { region, text: 'edited', editing: id }); store.save('a');
  expect(useImagePreview.getState().notes.a!.comments).toEqual([{ id, region, text: 'edited' }]);
  store.patch('a', { region, text: 'unsaved', editing: id }); store.remove('a', id);
  expect(useImagePreview.getState().notes.a!.draft.editing).toBeNull();
  expect(useImagePreview.getState().notes.a!.comments).toEqual([]);
});
it('images in the same reply are deduplicated; another reply does not mix into the same group', () => {
  const image = { target: { conversationId: 'c1', path: 'a.png' }, name: 'a' };
  const store = useImagePreview.getState(); store.register('reply1', image); store.register('reply1', image);
  store.register('reply2', { ...image, name: 'b', target: { conversationId: 'c1', path: 'b.png' } });
  expect(useImagePreview.getState().groups.reply1).toEqual([image]);
});
it('candidates are still shown in body order when handles return in a different order', () => {
  const store = useImagePreview.getState();
  store.register('reply', { target: { entryId: 'b' }, name: 'b', order: [2, 0] });
  store.register('reply', { target: { entryId: 'a' }, name: 'a', order: [1, 0] });
  expect(useImagePreview.getState().groups.reply!.map(c => c.name)).toEqual(['a', 'b']);
});

it('when the same image appears in two replies, the candidate group is selected by the reply clicked this time', () => {
  const store = useImagePreview.getState();
  const image = { target: { entryId: 'shared' }, name: 'shared' };
  store.register('first', image); store.register('second', image);
  store.activate('second');
  expect(useImagePreview.getState().activeGroups['entry:shared']).toBe('second');
});
