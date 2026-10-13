import { describe, expect, it } from 'vitest';
import { MODEL_CHECK_CODES, modelCheckCode, modelCheckRepair } from './models.ts';

describe('reasons a check did not pass', () => {
  it('whether repair helps: broken file yes, wrong output maybe, others no; unrecognized codes count as no', () => {
    expect(modelCheckRepair('MODEL_FILES_DAMAGED')).toBe('yes');
    expect(modelCheckRepair('MODEL_OUTPUT_WRONG')).toBe('maybe');
    for (const code of ['APP_FILE_MISSING', 'MODEL_OUT_OF_MEMORY', 'MODEL_WORKER_FAILED', 'SOMETHING_NEW', null, undefined]) {
      expect(modelCheckRepair(code), String(code)).toBe('no');
    }
  });

  it('only recognizes registered codes', () => {
    for (const code of MODEL_CHECK_CODES) expect(modelCheckCode(code)).toBe(code);
    expect(modelCheckCode('MODEL_SELF_TEST_FAILED')).toBeNull();
    expect(modelCheckCode(undefined)).toBeNull();
    expect(modelCheckCode(42)).toBeNull();
  });
});
