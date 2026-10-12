import fs from 'node:fs/promises';
import path from 'node:path';
import type { ComponentRelease, ComponentReleaseAsset } from './bundle-registry.ts';
import { removeEmptyParents } from './model-staging.ts';

/**
 * 来自 GitHub 发布页的组件（`BundleComponentSource.release`，目前只有音乐模型包的 audio.cpp 引擎；架构设计 §6.3）的位置与地址。
 *
 * - 组件目录：`<toolsDir>/<name>/<version>/`（Runtime Home 的 `tools/`，不在模型目录里，移动模型目录时不跟着走）。解开的文件旁边
 *   写一份 `.ccut-manifest.json`（每个文件的大小与 sha256），装没装好、校验与修复照旧按清单判断。
 * - 暂存区：`<toolsDir>/.ccut-staging/<name>@<version>/`，与组件目录在同一个卷上（发布是改名）。里面是压缩包（没下完的是
 *   `<文件名>.part`）与解开中的 `unpacked/`。
 * - 下载地址：给了工具下载镜像（设置 `tools.downloadEndpoint` 或 `CUCCUT_TOOLS_ENDPOINT`）时是 `<基址>/<name>/<version>/<文件名>`，
 *   否则是登记的官方地址模板（与受管外部工具的规则相同）。
 */

export const TOOLS_STAGING_DIR = '.ccut-staging';
/** 暂存区里解开中的目录名。 */
export const UNPACK_DIR = 'unpacked';

/** 主机的平台键：`<process.platform>-<process.arch>`，如 `darwin-arm64`、`win32-x64`。 */
export function hostPlatformKey(platform: string = process.platform, arch: string = process.arch): string {
  return `${platform}-${arch}`;
}

/** 这个平台的压缩包；没有时 null（这个平台不支持）。 */
export function releaseAsset(release: ComponentRelease, platformKey: string): ComponentReleaseAsset | null {
  return release.assets[platformKey] ?? null;
}

/** 组件目录：`<toolsDir>/<name>/<version>/`。 */
export function releaseDir(toolsDir: string, release: ComponentRelease): string {
  return path.join(toolsDir, release.name, release.version);
}

/** 暂存目录：`<toolsDir>/.ccut-staging/<name>@<version>/`。 */
export function releaseStagingDir(toolsDir: string, release: ComponentRelease): string {
  return path.join(toolsDir, TOOLS_STAGING_DIR, `${release.name}@${release.version}`);
}

/** 压缩包的下载地址：镜像 `<基址>/<name>/<version>/<文件名>`，没有镜像时按官方地址模板。 */
export function releaseUrl(release: ComponentRelease, asset: ComponentReleaseAsset, toolsEndpoint: string | null | undefined): string {
  if (toolsEndpoint) {
    const base = toolsEndpoint.replace(/\/+$/, '');
    return `${base}/${encodeURIComponent(release.name)}/${encodeURIComponent(release.version)}/${encodeURIComponent(asset.fileName)}`;
  }
  return release.urlTemplate.replace('{version}', encodeURIComponent(release.version)).replace('{file}', encodeURIComponent(asset.fileName));
}

/** 安装计划里的来源（不含凭据）：镜像的基址，或官方地址模板里文件之前的部分（发布页）。 */
export function releaseSource(release: ComponentRelease, toolsEndpoint: string | null | undefined): string {
  if (toolsEndpoint) return toolsEndpoint.replace(/\/+$/, '');
  const template = release.urlTemplate.replace('{version}', release.version);
  const cut = template.indexOf('/download/');
  return cut > 0 ? template.slice(0, cut) : template.slice(0, template.lastIndexOf('/'));
}

/** 暂存区里已经收到的压缩包字节（核对过的整份或没下完的 `.part`）；没有时 0。 */
export async function releaseStagedBytes(toolsDir: string, release: ComponentRelease, asset: ComponentReleaseAsset): Promise<number> {
  const stage = releaseStagingDir(toolsDir, release);
  for (const name of [asset.fileName, `${asset.fileName}.part`]) {
    const stat = await fs.stat(path.join(stage, name)).catch(() => null);
    if (stat?.isFile()) return stat.size;
  }
  return 0;
}

/** 删掉一个发布页组件的暂存目录（连同空了的暂存区）。 */
export async function discardReleaseStaging(toolsDir: string, release: ComponentRelease): Promise<void> {
  const stage = releaseStagingDir(toolsDir, release);
  await fs.rm(stage, { recursive: true, force: true });
  await removeEmptyParents(path.dirname(stage), path.join(toolsDir, TOOLS_STAGING_DIR));
}
