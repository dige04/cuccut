import { describe, expect, it } from 'vitest';
import { RpcError } from '../wire.ts';
import { isOffsetTimestamp, resolveTimeField, resolveTimeFieldTimestamp } from './time-field.ts';

function code(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RpcError);
    return ((error as RpcError).details as { code: string }).code;
  }
  return null;
}

describe('publication time field', () => {
  it('keeps the saved instant, with its seconds, while the day and time read the same', () => {
    const saved = '2026-10-01T18:00:42-06:00';
    expect(resolveTimeField('2026-10-01', '18:00', 'America/Mexico_City', saved)).toBe(saved);
    expect(resolveTimeField('2026-10-01', '18:01', 'America/Mexico_City', saved)).toBe('2026-10-02T00:01:00.000Z');
    expect(resolveTimeField('2026-10-02', '18:00', 'America/Mexico_City', saved)).toBe('2026-10-03T00:00:00.000Z');
  });

  it('keeps which side of a DST fold the saved instant is on', () => {
    const second = '2026-11-01T01:30:00-05:00';
    expect(resolveTimeField('2026-11-01', '01:30', 'America/New_York', second)).toBe(second);
    expect(code(() => resolveTimeField('2026-11-01', '01:30', 'America/New_York', null))).toBe('LOCAL_TIME_FOLD');
    expect(code(() => resolveTimeField('2026-03-08', '02:30', 'America/New_York', null))).toBe('LOCAL_TIME_GAP');
  });

  it('needs both a day and a time', () => {
    expect(code(() => resolveTimeField('', '10:00', 'UTC', null))).toBe('TIME_REQUIRED');
    expect(code(() => resolveTimeField('2026-10-01', '', 'UTC', null))).toBe('TIME_REQUIRED');
  });

  it('an exact timestamp must carry its UTC offset', () => {
    expect(resolveTimeFieldTimestamp(' 2026-10-01T18:00:00-06:00 ')).toBe('2026-10-01T18:00:00-06:00');
    expect(resolveTimeFieldTimestamp('2026-10-01T18:00Z')).toBe('2026-10-01T18:00Z');
    expect(code(() => resolveTimeFieldTimestamp('2026-10-01T18:00:00'))).toBe('TIMESTAMP_INVALID');
    expect(code(() => resolveTimeFieldTimestamp('2026-02-30T18:00:00Z'))).toBe('TIMESTAMP_INVALID');
    expect(isOffsetTimestamp('2026-10-01T18:00:00.123+05:30')).toBe(true);
    expect(isOffsetTimestamp('tomorrow')).toBe(false);
  });
});
