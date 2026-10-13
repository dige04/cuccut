import { describe, expect, it } from 'vitest';
import { diffPath, textDiff } from './unified-diff.ts';

describe('textDiff', () => {
  const file = diffPath('/w/a.txt', '/w');

  it('unchanged lines at both ends keep at most 3 lines of context; line numbers are each side\'s own, old and new', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n');
    const after = ['1', '2', '3', '4', '5', 'six', 'six-b', '7', '8', '9', '10'].join('\n');
    expect(textDiff(file, before, after)).toBe(
      ['--- a/a.txt', '+++ b/a.txt', '@@ -3,7 +3,8 @@', ' 3', ' 4', ' 5', '-6', '+six', '+six-b', ' 7', ' 8', ' 9'].join('\n'),
    );
  });

  it('all deleted and no change', () => {
    expect(textDiff(file, 'a\nb\n', '')).toBe(['--- a/a.txt', '+++ b/a.txt', '@@ -1,2 +0,0 @@', '-a', '-b'].join('\n'));
    expect(textDiff(file, 'same\n', 'same\n')).toBeNull();
  });

  it('files outside the working directory use their original path', () => {
    expect(diffPath('/elsewhere/b.txt', '/w')).toEqual({ a: '/elsewhere/b.txt', b: '/elsewhere/b.txt' });
  });
});
