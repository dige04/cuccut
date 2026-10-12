import type { ModelLicense } from '@cuccut/protocol';
import { ModelsMusicBundles as M } from '@cuccut/protocol/messages/models/music-bundles.ts';
import type { BundleComponentSource, ComponentRelease } from './bundle-registry.ts';

/**
 * audio.cpp 引擎（`audiocpp_cli`）的发布登记（架构设计 §6.3、§6.5；Model Worker 协议规范 §4.4）。引擎不随应用分发，也不是受管
 * 外部工具，而是音乐生成模型包的共享组件 `audiocpp-engine`：随模型包的安装计划下载、核对、解开到 Runtime Home 的
 * `tools/audiocpp/<版本>/`，按组件引用计数保留，最后一个用它的模型包删除时回收。这里是它唯一的登记。
 *
 * 发布物：上游 GitHub Releases（https://github.com/0xShug0/audio.cpp/releases）每个版本按平台出一个压缩包，可执行文件在包的根目录，
 * Linux 包旁边还有 `libggml*.so`，Windows 包旁边有 MSVC 运行库 DLL，所以整包下载、只解开根目录的普通文件（`archive.skip` 里的
 * 同包工具不解开）。各平台选：
 * - macOS（arm64、x64）：`metal` 包，静态链接，只依赖系统框架。
 * - Linux x64、Windows x64：`vulkan-portable` 包。上游说非 portable 的包按 GitHub 构建机的 CPU 开了 AVX-512，别的机器可能崩溃；
 *   CPU 包跑 3B 模型太慢，CUDA 包连运行库要 0.8–1.1 GB。Vulkan 包启动时要系统里有 Vulkan 加载器（显卡驱动带的 `vulkan-1.dll`、
 *   `libvulkan.so.1`），没有时启动失败。
 * - Linux arm64、Windows arm64：上游没有发布，模型包在这样的主机上报告为 `unsupported`，只能自己构建后用 `CUCCUT_AUDIOCPP_CLI` 指定。
 *
 * 大小与 sha256 取自 2026-10-11 上游 Releases API 给出的 `digest`，四个包都在本机下载后重新算过 sha256，一致。
 * 许可：上游 `LICENSE` 是 Apache-2.0（Copyright 2026 ShugoAI LLC）；CucCut 不分发引擎，从上游下载，不需要另附 NOTICE。
 * 模型权重（YuE2）的许可另算，见 `music-bundles.ts`。
 */

/** 组件目录与镜像路径里引擎的名字：`<toolsDir>/audiocpp/<版本>/`。 */
export const AUDIO_CPP_TOOL = 'audiocpp';

/** 引擎可执行文件的名字（不带 `.exe`）。 */
export const AUDIO_CPP_COMMAND = 'audiocpp_cli';

const POSIX_SKIP = ['audiocpp_server', 'audiocpp_gguf'];
const WINDOWS_SKIP = ['audiocpp_server.exe', 'audiocpp_gguf.exe'];

export const AUDIO_CPP_RELEASE: ComponentRelease = {
  name: AUDIO_CPP_TOOL,
  version: '0.9.1',
  // 上游的标签带 `v`，版本号（`--version` 打印的）不带。
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

/** 引擎的许可（模型详情的组件许可里列出）。 */
export const AUDIO_CPP_LICENSE: ModelLicense = {
  name: 'Apache-2.0',
  url: 'https://github.com/0xShug0/audio.cpp/blob/main/LICENSE',
  commercialUse: true,
  // 许可摘要给人看：用 getter，读的时候（列出状态、序列化过线）按当前语言生成。
  get summary() {
    return M.audioCppLicense().text;
  },
};

/**
 * 音乐生成模型包的引擎组件 `audiocpp-engine`。`repo` 是合成的（上游的 GitHub 仓库名），`revision` 是上游的标签，持有者与安装记录
 * 照旧按 `repo@revision` 算；以后基于 audio.cpp 的模型包用同一个对象，共用同一份。
 */
export const AUDIO_CPP_ENGINE_COMPONENT: BundleComponentSource = {
  family: 'audio-cpp-engine',
  repo: '0xShug0/audio.cpp',
  revision: `v${AUDIO_CPP_RELEASE.version}`,
  license: AUDIO_CPP_LICENSE,
  release: AUDIO_CPP_RELEASE,
};

/**
 * 从 `audiocpp_cli --version` 的输出取版本：第一行是 `audio.cpp <版本>`（发布构建是 `0.9.1`，自己构建没给版本时是 `dev`）。
 */
export function parseAudioCppVersion(output: string): string | null {
  return /^\s*audio\.cpp\s+v?(\S+)/m.exec(output)?.[1] ?? null;
}
