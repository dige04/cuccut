import { describe, expect, it } from 'vitest';
import { TopicLog } from './topic-log.ts';

describe('TopicLog', () => {
  const make = (capacity?: number) => {
    let state = 0;
    const log = new TopicLog<number, string>(() => state, '0', capacity);
    const publish = (event: string) => {
      state++;
      return log.publish(event);
    };
    return { log, publish };
  };

  it('without a cursor, a snapshot is given, and sequence numbers are at the same watermark as the snapshot', () => {
    const { log, publish } = make();
    publish('a');
    publish('b');
    const { result } = log.subscribe(undefined, () => {});
    expect(result).toEqual({ mode: 'snapshot', seq: '2', snapshot: 2 });
  });

  it('when the cursor is in the buffer, the later events are replayed', () => {
    const { log, publish } = make();
    publish('a');
    publish('b');
    publish('c');
    const { result } = log.subscribe('1', () => {});
    expect(result).toEqual({
      mode: 'replay',
      seq: '3',
      events: [
        { seq: '2', event: 'b' },
        { seq: '3', event: 'c' },
      ],
    });
  });

  it('when the cursor is already current, the replay is empty', () => {
    const { log, publish } = make();
    publish('a');
    expect(log.subscribe('1', () => {}).result).toEqual({ mode: 'replay', seq: '1', events: [] });
  });

  it('when the replay cannot be completed (pushed out of the buffer or from the future), falls back to the snapshot', () => {
    const { log, publish } = make(2);
    for (const e of ['a', 'b', 'c', 'd']) publish(e);
    expect(log.subscribe('1', () => {}).result.mode).toBe('snapshot');
    expect(log.subscribe('2', () => {}).result.mode).toBe('replay');
    expect(log.subscribe('9', () => {}).result.mode).toBe('snapshot');
  });

  it('events published after subscribing are pushed to the listener, and not after unsubscribing', () => {
    const { log, publish } = make();
    const seen: string[] = [];
    const sub = log.subscribe(undefined, (e) => seen.push(`${e.seq}:${e.event}`));
    publish('a');
    sub.unsubscribe();
    publish('b');
    expect(seen).toEqual(['1:a']);
  });
});
