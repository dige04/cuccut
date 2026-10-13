import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localizeText, RpcError, setLocale } from '@cuccut/protocol';
import { credentialProblem, CredentialStoreError } from './credential-store.ts';
import { GrantStore } from './grant-store.ts';
import { decodeGlossaryMarkdown } from './library/glossary-markdown.ts';

/** When the UI language is English, the text the storage layer writes for people is English. Grant purposes that the Runtime writes and persists carry a message reference. */
describe('English copy for runtime-storage', () => {
  let dir: string;

  beforeEach(async () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-storage-en-'));
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('explanation of credential problems', () => {
    expect(credentialProblem(new CredentialStoreError('denied', 'nope')).message).toBe('Access denied: nope');
  });

  it('grants: errors carry a citation; the purpose of default grants carries a citation, regenerated after switching back to Chinese', async () => {
    const store = await GrantStore.open(path.join(dir, 'grants.json'));
    let caught: unknown;
    try {
      store.update({ grantId: 'grant_missing' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RpcError);
    expect((caught as RpcError).message).toBe('No such grant');
    expect((caught as RpcError).messageRef?.key).toBe('runtimeStorageGrants.grantNotFound');

    const grant = store.ensureProviderGrant({ recipient: 'openai', dataKinds: ['transcript'], enabledAt: '2026-01-01T00:00:00.000Z', label: 'OpenAI' })!;
    expect(grant.purpose).toBe('Issued by default when OpenAI was turned on');
    expect(grant.purposeRef?.key).toBe('runtimeStorageGrants.providerGrantPurpose');
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
    expect(localizeText(grant.purpose, grant.purposeRef)).toBe('启用 OpenAI 时默认发放');
  });

  it('format error in the glossary file', () => {
    let caught: unknown;
    try {
      decodeGlossaryMarkdown('no front matter');
    } catch (error) {
      caught = error;
    }
    expect((caught as RpcError).message).toBe('A glossary file must start with front matter (lines wrapped in ---)');
    expect((caught as RpcError).messageRef?.key).toBe('runtimeStorageLibrary.glossaryNoFrontMatter');
  });
});
