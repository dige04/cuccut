import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Staging for the original link (architecture design §7.9): the link normalized with query parameters (signatures, tokens) removed, the one download still needs unchanged. It does not go into the task record (`jobs.*` can read the frozen parameters); it exists only in this file (permission 0600), referenced by digest (`sourceRef`).
 *
 * Lifecycle: written at submission; deleted when the pipeline completes. At Runtime startup, only references for link-import pipelines that have not completed are kept (failed, cancelled and interrupted ones can be retried); the rest are deleted.
 */
export interface LinkSources {
  put(ref: string, url: string): Promise<void>;
  get(ref: string): Promise<string | null>;
  delete(ref: string): Promise<void>;
  /** Keeps only those in `keep`. */
  prune(keep: ReadonlySet<string>): Promise<void>;
}

/** File implementation: the whole file is one JSON object, written atomically. */
export class FileLinkSources implements LinkSources {
  readonly #file: string;
  #chain: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.#file = file;
  }

  put(ref: string, url: string): Promise<void> {
    return this.#change((all) => {
      all[ref] = url;
    });
  }

  async get(ref: string): Promise<string | null> {
    await this.#chain.catch(() => {});
    return (await this.#read())[ref] ?? null;
  }

  delete(ref: string): Promise<void> {
    return this.#change((all) => {
      delete all[ref];
    });
  }

  prune(keep: ReadonlySet<string>): Promise<void> {
    return this.#change((all) => {
      for (const ref of Object.keys(all)) if (!keep.has(ref)) delete all[ref];
    });
  }

  async #read(): Promise<Record<string, string>> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.#file, 'utf8')) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  #change(fn: (all: Record<string, string>) => void): Promise<void> {
    const next = this.#chain
      .catch(() => {})
      .then(async () => {
        const all = await this.#read();
        const before = JSON.stringify(all);
        fn(all);
        if (JSON.stringify(all) === before) return;
        if (Object.keys(all).length === 0) {
          await fs.rm(this.#file, { force: true });
          return;
        }
        await fs.mkdir(path.dirname(this.#file), { recursive: true });
        const tmp = `${this.#file}.${randomUUID()}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(all), { mode: 0o600 });
        await fs.rename(tmp, this.#file);
      });
    this.#chain = next;
    return next;
  }
}
