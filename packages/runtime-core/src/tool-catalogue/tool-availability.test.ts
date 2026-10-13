import { describe, expect, it } from 'vitest';
import { RpcError, type ExternalToolStatus, type ModelServiceCapability } from '@cuccut/protocol';
import { TOOL_CATALOGUE } from '@cuccut/jobs';
import { capabilityError, toolStatuses, type ToolAvailabilityDeps } from './tool-availability.ts';

/** Availability of the tool catalogue: capabilities and external tools are replaced with fake states; no probing, no network. */

function external(name: string, partial: Partial<ExternalToolStatus> = {}): ExternalToolStatus {
  return {
    name,
    label: name,
    purpose: '',
    state: 'installed',
    reason: null,
    path: `/fake/${name}`,
    version: '1',
    source: 'system',
    minVersion: null,
    installable: true,
    offer: null,
    consentRequired: false,
    consent: null,
    managed: null,
    userPath: null,
    installJobId: null,
    update: null,
    updateJobId: null,
    platform: 'darwin',
    remedy: null,
    ...partial,
  };
}

function notConfigured(capability: ModelServiceCapability): RpcError {
  return new RpcError('conflict', `没有配置${capability}`, {
    code: 'CAPABILITY_NOT_CONFIGURED',
    capability,
    reason: 'no-default',
    remedy: { action: 'set-default', capability, hint: `设一个默认的 ${capability} 模型` },
  });
}

function deps(
  options: { missing?: ModelServiceCapability[]; tools?: ExternalToolStatus[]; offline?: boolean } = {},
): ToolAvailabilityDeps & {
  asked: ModelServiceCapability[];
} {
  const asked: ModelServiceCapability[] = [];
  return {
    asked,
    capability: async (capability) => {
      asked.push(capability);
      return options.missing?.includes(capability) ? notConfigured(capability) : null;
    },
    externalTools: async () => options.tools ?? [external('ffmpeg'), external('yt-dlp')],
    offlineStrict: () => options.offline ?? false,
  };
}

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((t) => t.id === id)!;

describe('tool availability', () => {
  it('all capabilities configured and external tools present: all available, no restrictions', async () => {
    const statuses = await toolStatuses(TOOL_CATALOGUE, deps());
    expect(statuses.map((s) => [s.id, s.available, s.problems.length, s.limitations.length])).toEqual(
      TOOL_CATALOGUE.map((t) => [t.id, true, 0, 0]),
    );
  });

  it('capability not configured: tools that use it are unavailable, with reason CAPABILITY_NOT_CONFIGURED; merely optional ones are restricted; the same capability is checked only once', async () => {
    const d = deps({ missing: ['generateText', 'transcribe'] });
    const statuses = await toolStatuses(TOOL_CATALOGUE, d);
    expect(byId(statuses, 'translate-subtitles')).toMatchObject({
      available: false,
      problems: [
        { code: 'CAPABILITY_NOT_CONFIGURED', capability: 'generateText', reason: 'no-default', remedy: '设一个默认的 generateText 模型' },
      ],
    });
    expect(byId(statuses, 'transcribe')).toMatchObject({ available: false, problems: [{ capability: 'transcribe' }] });
    // Text generation for dubbing is used only when translating: still available, with the limitation stated.
    expect(byId(statuses, 'dub')).toMatchObject({ available: true, problems: [], limitations: [{ capability: 'generateText' }] });
    expect(byId(statuses, 'link-import')).toMatchObject({ available: true, limitations: [{ capability: 'transcribe' }] });
    expect(byId(statuses, 'compress-video').available).toBe(true);
    expect(byId(statuses, 'extract-audio')).toMatchObject({ available: true, problems: [], limitations: [] });
    expect(d.asked.filter((c) => c === 'generateText')).toHaveLength(1);
  });

  it('external tool not installed, too old, not consented, or not registered: each keeps its TOOL_* error code and remedy', async () => {
    const tools = [
      external('ffmpeg', { state: 'missing', path: null, remedy: '在设置里下载 ffmpeg' }),
      external('yt-dlp', { consentRequired: true, consent: null }),
    ];
    const statuses = await toolStatuses(TOOL_CATALOGUE, deps({ tools }));
    expect(byId(statuses, 'merge-video')).toMatchObject({
      available: false,
      problems: [{ code: 'TOOL_NOT_INSTALLED', tool: 'ffmpeg', remedy: '在设置里下载 ffmpeg' }],
    });
    // Audio extraction likewise depends only on ffmpeg.
    expect(byId(statuses, 'extract-audio')).toMatchObject({
      available: false,
      problems: [{ code: 'TOOL_NOT_INSTALLED', tool: 'ffmpeg' }],
    });
    expect(byId(statuses, 'dub').problems).toEqual([expect.objectContaining({ code: 'TOOL_NOT_INSTALLED', tool: 'ffmpeg' })]);
    expect(byId(statuses, 'link-import')).toMatchObject({
      available: false,
      problems: [{ code: 'TOOL_CONSENT_REQUIRED', tool: 'yt-dlp' }],
    });
    // Transcription does not need a download tool (links go through “import from link”).
    expect(byId(statuses, 'transcribe')).toMatchObject({ available: true, limitations: [] });
    // External tools used only for certain inputs: available, with the limitation stated.
    const optional = { ...structuredClone(TOOL_CATALOGUE[0]!), id: 'optional-tool', optionalExternalTools: ['yt-dlp'] };
    expect((await toolStatuses([optional], deps({ tools })))[0]).toMatchObject({
      available: true,
      limitations: [{ code: 'TOOL_CONSENT_REQUIRED', tool: 'yt-dlp' }],
    });

    const outdated = await toolStatuses(TOOL_CATALOGUE, deps({ tools: [external('ffmpeg', { state: 'outdated', reason: '要 6.0' })] }));
    expect(byId(outdated, 'compress-video').problems).toEqual([expect.objectContaining({ code: 'TOOL_OUTDATED' })]);
    expect(byId(outdated, 'link-import').problems).toEqual([expect.objectContaining({ code: 'TOOL_UNAVAILABLE', tool: 'yt-dlp' })]);
  });

  it('strict offline: importing from a link is unavailable; tools that go online only for some inputs are merely restricted', async () => {
    const statuses = await toolStatuses(TOOL_CATALOGUE, deps({ offline: true }));
    expect(byId(statuses, 'link-import')).toMatchObject({ available: false, problems: [{ code: 'OFFLINE_STRICT' }] });
    expect(byId(statuses, 'transcribe')).toMatchObject({ available: true, limitations: [] });
    const optional = { ...structuredClone(TOOL_CATALOGUE[0]!), id: 'optional-network', network: 'optional' as const };
    expect((await toolStatuses([optional], deps({ offline: true })))[0]).toMatchObject({
      available: true,
      limitations: [{ code: 'OFFLINE_STRICT' }],
    });
    expect(byId(statuses, 'generate-text').available).toBe(true);
  });

  it('when selecting a capability, only RpcError is treated as unavailable', async () => {
    await expect(capabilityError(async () => 'ok')).resolves.toBeNull();
    const refused = notConfigured('generateImage');
    await expect(
      capabilityError(async () => {
        throw refused;
      }),
    ).resolves.toBe(refused);
    await expect(
      capabilityError(async () => {
        throw new Error('坏了');
      }),
    ).rejects.toThrow('坏了');
  });
});
