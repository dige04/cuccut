import { shortenPath } from './format.ts';

/*
 * Pure logic for the legacy project import prompt (design draft model-legacy-import.js; architecture design §2.7). The prompt itself is given by the Runtime (`legacy-import` topic),
 * and the default directory is also computed by the Runtime (the `CucCut` folder under the system “Documents” folder); this layer only computes what answer to send and how the directory is written for people to read.
 */

/** The two buttons on the dialog; closing the dialog counts as “skip”. */
export type LegacyImportChoice = 'import' | 'skip';

/**
 * Answer → decision sent to the Runtime. null means send nothing: this time is skipped, the prompt stays in the Runtime, the UI does not pop it up again this launch, and it asks again on the next launch.
 * Ticked “不再提醒” and clicked “导入”: import as usual — after importing, it would not ask again anyway.
 */
export function legacyImportDecision(choice: LegacyImportChoice, never: boolean): 'import' | 'never' | null {
  if (choice === 'import') return 'import';
  return never ? 'never' : null;
}

/**
 * How the import directory is written for people to read: macOS and Linux shorten the home directory to `~`; Windows has no `~`, so the drive letter and backslashes are written as they are.
 * The trailing separator is removed in both cases (except for the root directory).
 */
export function displayDirectory(dir: string, platform: string): string {
  const trimmed = dir.replace(/[\\/]+$/, '');
  const shown = trimmed === '' || /^[A-Za-z]:$/.test(trimmed) ? dir : trimmed;
  return platform === 'win32' ? shown : shortenPath(shown);
}
