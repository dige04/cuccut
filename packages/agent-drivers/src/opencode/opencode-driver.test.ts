import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { silentLogger } from '@cuccut/harness';
import { createFakeOpenCode, type FakeOpenCode } from '../testing/fake-opencode.ts';
import { OpenCodeDriver } from './opencode-driver.ts';

/** Probing of the OpenCode Driver against a fake opencode: version check, model table, account notes, caching, and forced refresh. */
describe('OpenCodeDriver.probe (fake opencode)', () => {
  let dir: string;
  let fake: FakeOpenCode;
  let driver: OpenCodeDriver;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-opencode-probe-'));
    fake = await createFakeOpenCode(path.join(dir, 'fake'));
    driver = new OpenCodeDriver(silentLogger, { locate: fake.locate, timeoutMs: 10_000 });
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const serveStarts = () => fake.log().filter((e) => e.kind === 'start').length;

  it('2.x: ready, model table comes from serve; with only free models, explains how to connect an account', async () => {
    const probe = await driver.probe();
    expect(probe.id).toBe('opencode');
    expect(probe.verified).toBe(true);
    expect(driver.verified).toBe(true);
    expect(driver.tested).toBe(true);
    expect(driver.describe().verified).toBe(true);
    expect(probe.state).toBe('ready');
    expect(probe.version).toBe('2.0.24');
    expect(probe.minVersion).toBe('2.0.10');
    expect(probe.capabilities).toEqual({ steer: true, approvals: true, resume: true, images: true });
    expect(probe.account).toBeNull();
    expect(probe.detail).toContain('opencode auth login');
    expect(probe.models.map((m) => m.id)).toEqual(['opencode/big-pickle', 'opencode/fledge-alpha-free']);
    expect(probe.models.find((m) => m.isDefault)?.id).toBe('opencode/fledge-alpha-free');
    expect(probe.models[1]!.efforts.map((e) => e.id)).toEqual(['low', 'high', 'max']);
    expect(probe.install.map((o) => o.command)).toEqual(['npm install -g @opencode/cli']);
    // On cold start the directory first returns an empty plugin table: wait until it is non-empty before reading the model table.
    const plugins = fake.requests('GET', '/api/plugin');
    expect(plugins.length).toBeGreaterThanOrEqual(2);
    expect(plugins[0]!.location).toBe(os.homedir());
    // The serve used for probing is shut down right after use.
    await expect.poll(() => fake.log().filter((e) => e.kind === 'exit').length).toBe(1);
  });

  it('reports the account when another provider is connected', async () => {
    fake.scenario({
      providers: [
        { id: 'opencode', name: 'OpenCode Zen' },
        { id: 'anthropic', name: 'Anthropic', activation: 'enabled' },
      ],
    });
    const probe = await driver.probe();
    expect(probe.account).toBe('Anthropic');
    expect(probe.detail).toBeNull();
  });

  it('1.x: version too old, asks to upgrade; does not start serve', async () => {
    fake.scenario({ versionOutput: '1.18.34' });
    const probe = await driver.probe();
    expect(probe.state).toBe('outdated');
    expect(probe.version).toBe('1.18.34');
    expect(probe.detail).toContain('版本过低，请升级');
    expect(probe.detail).toContain('@opencode/cli');
    expect(serveStarts()).toBe(0);
  });

  it('2.x versions earlier than 2.0.10 are also too old', async () => {
    fake.scenario({ versionOutput: 'opencode v2.0.3' });
    expect((await driver.probe()).state).toBe('outdated');
  });

  it('not installed: not-installed, and explains how to install', async () => {
    fake.scenario({ installed: false });
    const probe = await driver.probe();
    expect(probe.state).toBe('not-installed');
    expect(probe.detail).toContain('npm install -g @opencode/cli');
  });

  it('model table cannot be read: error', async () => {
    fake.scenario({ catalog: 'error' });
    const probe = await driver.probe();
    expect(probe.state).toBe('error');
    expect(probe.detail).toContain('catalog exploded');
  });

  it('model table is cached for 10 minutes, concurrent probes share one request; force really re-queries', async () => {
    await Promise.all([driver.probe(), driver.probe()]);
    await driver.probe();
    expect(serveStarts()).toBe(1);
    await driver.probe({ force: true });
    expect(serveStarts()).toBe(2);
  });
});
