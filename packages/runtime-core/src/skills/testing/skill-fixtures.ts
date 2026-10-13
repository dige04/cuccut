import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * For tests: writes a skill folder under `root`. When `name` or `description` is an empty string, that line is left out; `extra` is the body; `files` are other files in the same directory.
 */
export async function writeSkill(
  root: string,
  dirName: string,
  options: { name?: string; description?: string; extra?: string; files?: Record<string, string | Buffer> } = {},
): Promise<string> {
  const dir = path.join(root, dirName);
  await fs.mkdir(dir, { recursive: true });
  const head = ['---'];
  if (options.name !== '') head.push(`name: ${options.name ?? dirName}`);
  if (options.description !== '') head.push(`description: ${options.description ?? `${dirName} 的说明`}`);
  head.push('---', '', options.extra ?? `# ${dirName}\n\n按步骤做。`);
  await fs.writeFile(path.join(dir, 'SKILL.md'), head.join('\n'));
  for (const [file, body] of Object.entries(options.files ?? {})) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), body);
  }
  return dir;
}
