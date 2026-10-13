import type { Id } from '@cuccut/protocol';
import { JsonStoreFile, isPlainObject, type StoreOptions } from './store-file.ts';

/** User marks on Space entries (`user.*` in architecture design §5.7). Index rebuilds do not lose them. */
export interface SpaceMark {
  favorite: boolean;
  displayName: string | null;
  trashedAt: string | null;
  /** The user cleared this failed placeholder (`space.purge`). It has no bytes, so clearing only stops showing it. Old files do not have this entry. */
  dismissedAt?: string | null;
}

/**
 * Project files registered through `space.import` (architecture design §5.7, "project files that are not videos"). The bytes' authority is the file itself in the project directory.
 * This records only which project the file belongs to, its relative path within the project, and the registration time. If the file is moved or deleted outside the app, the entry shows as `missing`.
 */
export interface SpaceImport {
  projectId: Id;
  /** Relative to the project directory, separated by `/`. */
  relPath: string;
  importedAt: string;
  /** When copied in from outside the project, the original file name (the original path is not recorded). */
  copiedFrom: string | null;
}

/**
 * A deleted video (`videos.delete`, architecture design §5.5 and §5.7): the whole video directory is moved into the trash in the source directory, at `.ccut-trash/<trashId>/<directory name>`.
 * The key is its entry id in the trash (the digest of the source key and `trashRelPath`). The original location may later receive another video, so the two cannot share an id.
 * Write this record first, then move the directory. On restore, move the directory back first, then delete the record. If it crashes midway, startup reconciles the record against where the directory actually is.
 * All paths are relative to the source directory, so they are still found after the project directory is moved.
 */
export interface TrashedVideo {
  /** The entry id from before deletion. Undo and restore can use it to find this record. */
  formerEntryId: Id;
  /** Source key: `project:<id>` or `conv:<id>`. */
  sourceKey: string;
  projectId: Id | null;
  conversationId: Id | null;
  /** Original relative path, separated by `/`. */
  relPath: string;
  /** Relative path in the trash: `.ccut-trash/<trashId>/<directory name>`. */
  trashRelPath: string;
  videoId: Id | null;
  name: string;
  size: number;
  trashedAt: string;
}

interface SpaceFile {
  schemaVersion: 1;
  marks: Record<Id, SpaceMark>;
  /** Added later: old files do not have it. */
  imports?: Record<Id, SpaceImport>;
  /** Added later: old files do not have it. */
  trashedVideos?: Record<Id, TrashedVideo>;
}

export const EMPTY_MARK: SpaceMark = { favorite: false, displayName: null, trashedAt: null };

/** Entries whose marks are all empty are not written to disk. The file records only meaningful things. */
function isEmpty(mark: SpaceMark): boolean {
  return !mark.favorite && mark.displayName === null && mark.trashedAt === null && !mark.dismissedAt;
}

/** If the file is corrupt, it is renamed and kept, and the store starts empty. Files written by a newer version are not rewritten (`store-file.ts`). */
export class SpaceMarkStore {
  readonly #file: JsonStoreFile;
  #marks = new Map<Id, SpaceMark>();
  #imports = new Map<Id, SpaceImport>();
  #trashedVideos = new Map<Id, TrashedVideo>();
  #saving: Promise<void> = Promise.resolve();

  constructor(file: string, options: StoreOptions = {}) {
    this.#file = new JsonStoreFile(file, options.log);
  }

  async load(): Promise<void> {
    const { value: data } = await this.#file.read<SpaceFile>({
      recognize: (raw) =>
        isPlainObject(raw.marks) &&
        (raw.imports === undefined || isPlainObject(raw.imports)) &&
        (raw.trashedVideos === undefined || isPlainObject(raw.trashedVideos))
          ? (raw as unknown as SpaceFile)
          : null,
    });
    this.#marks = new Map(Object.entries(data?.marks ?? {}));
    this.#imports = new Map(Object.entries(data?.imports ?? {}));
    this.#trashedVideos = new Map(Object.entries(data?.trashedVideos ?? {}));
  }

  get(id: Id): SpaceMark {
    return this.#marks.get(id) ?? EMPTY_MARK;
  }

  put(id: Id, mark: SpaceMark): Promise<void> {
    if (isEmpty(mark)) this.#marks.delete(id);
    else this.#marks.set(id, mark);
    return this.#save();
  }

  /** After physical deletion, the marks, the registration, and the record of the deleted video are removed together. */
  remove(id: Id): Promise<void> {
    this.#marks.delete(id);
    this.#imports.delete(id);
    this.#trashedVideos.delete(id);
    return this.#save();
  }

  trashedVideos(): ReadonlyMap<Id, TrashedVideo> {
    return this.#trashedVideos;
  }

  /** Records a deleted video. The user's marks move from the original entry, and the trash mark is written (one disk write). */
  putTrashedVideo(id: Id, record: TrashedVideo): Promise<void> {
    this.#trashedVideos.set(id, record);
    this.#marks.set(id, { ...this.get(record.formerEntryId), trashedAt: record.trashedAt });
    this.#marks.delete(record.formerEntryId);
    return this.#save();
  }

  /** The video returns to the source directory (restore, or at startup when the move never happened). The record is removed. The user's marks have the trash mark removed, then move to `to`. */
  dropTrashedVideo(id: Id, to: Id): Promise<void> {
    this.#trashedVideos.delete(id);
    const mark = { ...this.get(id), trashedAt: null };
    this.#marks.delete(id);
    if (!isEmpty(mark)) this.#marks.set(to, mark);
    return this.#save();
  }

  imports(): ReadonlyMap<Id, SpaceImport> {
    return this.#imports;
  }

  putImport(id: Id, record: SpaceImport): Promise<void> {
    this.#imports.set(id, record);
    return this.#save();
  }

  flush(): Promise<void> {
    return this.#saving;
  }

  #save(): Promise<void> {
    const snapshot: SpaceFile = {
      schemaVersion: 1,
      marks: Object.fromEntries(this.#marks),
      ...(this.#imports.size > 0 ? { imports: Object.fromEntries(this.#imports) } : {}),
      ...(this.#trashedVideos.size > 0 ? { trashedVideos: Object.fromEntries(this.#trashedVideos) } : {}),
    };
    this.#saving = this.#saving.catch(() => {}).then(() => this.#file.write(snapshot));
    return this.#saving;
  }
}
