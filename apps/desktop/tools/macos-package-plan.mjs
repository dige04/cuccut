// Local Intel packages use whisper.cpp Metal; published Mac packages remain Apple Silicon.
export function macPackagePlan({ target, local = false, variant = 'cpu', hostPlatform = process.platform, hostArch = process.arch }) {
  target ??= local && hostArch === 'x64' ? 'x86_64-apple-darwin' : 'aarch64-apple-darwin';
  const intel = target === 'x86_64-apple-darwin';
  if (!intel && target !== 'aarch64-apple-darwin') throw new Error(`Unsupported target: ${target}`);
  if (hostPlatform !== 'darwin' || hostArch !== (intel ? 'x64' : 'arm64') || variant !== 'cpu') {
    throw new Error('Mac packaging requires the matching native Mac architecture and no Windows GPU variant');
  }
  if (intel && !local) throw new Error('Intel Mac packaging requires --local; public Intel releases are not configured');
  return {
    target, intel, electronArch: intel ? 'x64' : 'arm64', directory: intel ? 'mac' : 'mac-arm64',
    modelWorkerFeatures: intel ? ['backend-candle', 'whisper-ggml-metal'] : [],
    noDefaultFeatures: intel,
    needsMlxLibrary: !intel,
  };
}
