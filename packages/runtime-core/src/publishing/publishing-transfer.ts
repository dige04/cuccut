import path from 'node:path';
import type { Logger } from '@cuccut/harness';
import { RpcError, newId, type CalendarArchive, type CalendarImportPreview, type Id } from '@cuccut/protocol';
import { RcPublishing as RP } from '@cuccut/protocol/messages/runtime-core';
import { buildCalendarArchive, calendarArchiveFileName, inspectCalendarImport, type CalendarImportPlan } from '@cuccut/protocol/schemas';
import { writeJsonAtomic } from '@cuccut/runtime-storage';
import type { PublishingActor, PublishingService } from './publishing-service.ts';

/**
 * Calendar transfer (design `docs/cuccut/m2-publishing.md` §4.1, `cuccut-calendar` v1): export the whole publishing calendar to a file, preview a
 * file, and import it. Import is append-only (publications already here are skipped), new accounts must be connected again, deliveries that were in
 * progress become `unknown` (a transferred queue never starts a delivery), and the store is backed up to `publishing/backups/` first. The checks are the
 * pure `inspectCalendarImport`; this module supplies what this computer has and writes the result.
 *
 * Who may transfer (design §4.2): the owner in the desktop app and the command line; not agents and not the browser.
 */

export interface PublishingTransferOptions {
  service: PublishingService;
  /** The publishing directory (`RuntimeHome.publishingDir`); backups go to its `backups/`. */
  dir: string;
  log: Logger;
  now?: () => Date;
}

export class PublishingTransfer {
  readonly #service: PublishingService;
  readonly #dir: string;
  readonly #log: Logger;
  readonly #now: () => Date;

  constructor(options: PublishingTransferOptions) {
    this.#service = options.service;
    this.#dir = options.dir;
    this.#log = options.log;
    this.#now = options.now ?? (() => new Date());
  }

  #assert(actor: PublishingActor): void {
    if (actor.kind !== 'human' && actor.kind !== 'cli') throw new RpcError('forbidden', RP.transferNotAllowed(), { code: 'TRANSFER_NOT_ALLOWED' });
  }

  /** The calendar file of every project (archived publications included). */
  export(actor: PublishingActor): { archive: CalendarArchive; fileName: string } {
    this.#assert(actor);
    const store = this.#service.store;
    const now = this.#now();
    return {
      archive: buildCalendarArchive({
        timezone: store.settings().timezone,
        publications: store.publications(),
        accounts: store.accounts(),
        connections: store.connections(),
        now,
      }),
      fileName: calendarArchiveFileName(now),
    };
  }

  #plan(raw: unknown): CalendarImportPlan {
    const store = this.#service.store;
    return inspectCalendarImport(raw, {
      timezone: store.settings().timezone,
      publicationIds: new Set(store.read((doc) => doc.publications.map((p) => p.id))),
      accounts: store.accounts(),
      connections: store.connections(),
      videoAvailable: (videoId) => this.#service.videos.available(videoId),
    });
  }

  preview(raw: unknown, actor: PublishingActor): CalendarImportPreview {
    this.#assert(actor);
    return this.#plan(raw).preview;
  }

  /** Imports a calendar file: backup first, then one change that appends the new connections, accounts and publications. */
  async apply(raw: unknown, actor: PublishingActor): Promise<{ added: Id[]; preview: CalendarImportPreview }> {
    this.#assert(actor);
    const first = this.#plan(raw);
    if (!first.publications.length && !first.accounts.length && !first.connections.length) return { added: [], preview: first.preview };
    const at = this.#now();
    const backup = path.join('backups', `${at.toISOString().replace(/[:.]/g, '-')}.json`);
    try {
      await writeJsonAtomic(path.join(this.#dir, backup), this.#service.store.snapshot(), { mode: 0o600, durable: true });
    } catch (error) {
      this.#log.warn('Writing the publishing backup failed', { error: String(error) });
      throw new RpcError('internal', RP.backupFailed(), { code: 'BACKUP_FAILED' });
    }
    return this.#service.store.transact((tx) => {
      // Checked again in the same turn as the write: the store may have changed while the backup was written.
      const plan = this.#plan(raw);
      tx.connections().push(...plan.connections);
      tx.accounts().push(...plan.accounts);
      for (const p of plan.publications) tx.insertPublication(p);
      const added = plan.publications.map((p) => p.id);
      tx.addImport({ id: newId('pimport'), at: tx.now.toISOString(), added, backup });
      return { added, preview: plan.preview };
    });
  }
}
