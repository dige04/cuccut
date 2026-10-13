import type { ModelLicense } from '@cuccut/protocol';
import { ModelsMusicBundles as M } from '@cuccut/protocol/messages/models/music-bundles.ts';
import type { BundleComponentSource, ComponentRelease } from './bundle-registry.ts';

/**
 * Release registration of the audio.cpp engine (`audiocpp_cli`) (architecture design §6.3, §6.5; Model Worker protocol spec §4.4). The engine is not distributed with the app, and it is not a managed external tool. It is the shared component `audiocpp-engine` of music generation model packages: it is downloaded, verified and unpacked to the Runtime Home's `tools/audiocpp/<version>/` according to the model package's install plan, kept by per-component reference count, and reclaimed when the last model package that uses it is deleted. This is its only registration.
 *
 * Release artefacts: each version on the upstream GitHub Releases (https://github.com/0xShug0/audio.cpp/releases) provides one archive per platform, with the executable at the root of the archive. Linux packages have `libggml*.so` alongside, and Windows packages have the MSVC runtime DLLs alongside, so the whole archive is downloaded and only the regular files at its root are unpacked (tools listed in `archive.skip` within the same archive are not unpacked). Platform choices:
 * - macOS (arm64, x64): the `metal` package, statically linked, depending only on system frameworks.
 * - Linux x64, Windows x64: the `vulkan-portable` package. Upstream says the non-portable package has AVX-512 enabled based on the CPU of the GitHub build machine, and may crash on other machines. CPU packages are too slow for 3B models, and CUDA packages need 0.8–1.1 GB for the runtime libraries alone. The Vulkan package needs a Vulkan loader in the system at startup (`vulkan-1.dll`, `libvulkan.so.1` shipped with the graphics driver); without it, startup fails.
 * - Linux arm64, Windows arm64: upstream does not publish these; model packages on such hosts report `unsupported`, and the only option is to build it yourself and point `CUCCUT_AUDIOCPP_CLI` at it.
 *
 * Size and sha256 are taken from the `digest` given by the upstream Releases API on 2026-10-11. All four packages were downloaded on this machine and their sha256 recomputed; they match.
 * Licence: upstream `LICENSE` is Apache-2.0 (Copyright 2026 ShugoAI LLC). CucCut does not distribute the engine; it is downloaded from upstream, so no separate NOTICE is needed.
 * The licence for the model weights (YuE2) is assessed separately; see `music-bundles.ts`.
 */

/** The engine's name in the component directory and mirror paths: `<toolsDir>/audiocpp/<version>/`. */
export const AUDIO_CPP_TOOL = 'audiocpp';

/** Engine executable name (without `.exe`). */
export const AUDIO_CPP_COMMAND = 'audiocpp_cli';

const POSIX_SKIP = ['audiocpp_server', 'audiocpp_gguf'];
const WINDOWS_SKIP = ['audiocpp_server.exe', 'audiocpp_gguf.exe'];

export const AUDIO_CPP_RELEASE: ComponentRelease = {
  name: AUDIO_CPP_TOOL,
  version: '0.9.1',
  // Upstream tags carry a `v`; the version number (as printed by `--version`) does not.
  urlTemplate: 'https://github.com/0xShug0/audio.cpp/releases/download/v{version}/{file}',
  assets: {
    'darwin-arm64': {
      fileName: 'audio-v0.9.1-bin-macos-arm64-metal.tar.gz',
      size: 30519606,
      sha256: '960436787b84bf137a70ea1713ac460207ef2ac7b2617380fb7a1f4650d1100d',
      archive: { format: 'tar.gz', skip: POSIX_SKIP },
      executable: AUDIO_CPP_COMMAND,
    },
    'darwin-x64': {
      fileName: 'audio-v0.9.1-bin-macos-x64-metal.tar.gz',
      size: 32363206,
      sha256: 'e8987115a6150330c4a3ba6a00494b0a1f28db8c5553d1f457ba2279a15f9ff1',
      archive: { format: 'tar.gz', skip: POSIX_SKIP },
      executable: AUDIO_CPP_COMMAND,
    },
    'linux-x64': {
      fileName: 'audio-v0.9.1-bin-ubuntu-x64-vulkan-portable.tar.gz',
      size: 71553729,
      sha256: '1aae59b03d10c0fa289fe11f4529ef8325bec4dad5c003652b99c23f3d9f5e32',
      archive: { format: 'tar.gz', skip: POSIX_SKIP },
      executable: AUDIO_CPP_COMMAND,
    },
    'win32-x64': {
      fileName: 'audio-v0.9.1-bin-windows-x64-vulkan-portable.zip',
      size: 61728860,
      sha256: '423226fa8a0fd09de8534a6bc146ea8758801c8937e406dafa6bffb6bfb22f73',
      archive: { format: 'zip', skip: WINDOWS_SKIP },
      executable: `${AUDIO_CPP_COMMAND}.exe`,
    },
  },
};

/** The engine's licence (listed in the component licences of the model details). */
export const AUDIO_CPP_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://github.com/0xShug0/audio.cpp/blob/main/LICENSE',
  commercialUse: true,
  // The licence summary is for display: a getter, generated in the current language when read (when listing status or serialising over the wire).
  get summary() {
    return M.audioCppLicense().text;
  },
};

/**
 * The engine component `audiocpp-engine` of music generation model packages. `repo` is synthetic (the upstream GitHub repository name), and `revision` is the upstream tag. The owner and install record are still keyed as `repo@revision`. Future model packages based on audio.cpp will use the same object and share the same copy.
 */
export const AUDIO_CPP_ENGINE_COMPONENT: BundleComponentSource = {
  family: 'audio-cpp-engine',
  repo: '0xShug0/audio.cpp',
  revision: `v${AUDIO_CPP_RELEASE.version}`,
  license: AUDIO_CPP_LICENSE,
  release: AUDIO_CPP_RELEASE,
};

/**
 * Gets the version from the output of `audiocpp_cli --version`: the first line is `audio.cpp <version>` (release builds print `0.9.1`; a self-build given no version prints `dev`).
 */
export function parseAudioCppVersion(output: string): string | null {
  return /^\s*audio\.cpp\s+v?(\S+)/m.exec(output)?.[1] ?? null;
}
