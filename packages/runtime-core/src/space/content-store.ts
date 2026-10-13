import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type { Id, SpaceSearchDocumentKind } from '@cuccut/protocol';
import type { ContentSegment, VideoFacts } from './content-extract.ts';
import { normalizeText } from './content-search.ts';

/**
 * Storage for the content index (architecture design §5.11): `<cache>/content-index/index.db`, one SQLite database (Node's built-in `node:sqlite`).
 * A derived cache: the whole file can be deleted and rebuilt. The format version is recorded in `user_version`; on a mismatch the database is deleted and rebuilt, not migrated.
 *
 * - `videos`: one row per video (keyed by the real path of the directory), recording the version, modification time and video facts (JSON) at indexing time.
 * - `segment_rows`: searchable segments (original text, normalized body and time, kind, speaker), indexed by directory, so replacing one video's segments does not scan the whole table.
 * - `segments`: an FTS5 external-content table (trigram tokenizer) over `segment_rows.body`, kept in sync by triggers. Words of three or more characters use MATCH. Shorter words (such as common two-character Chinese words) cannot use the trigram index and fall back to `instr` substring filtering. Candidate segments are always re-checked by `matchTerms` at the end.
 *
 * `DatabaseSync` is synchronous: inside a transaction only database writes happen; reading videos and extracting segments happens outside the transaction.
 */

/** Format version of the database (`PRAGMA user_version`). 2: video facts gained the derived source (`origin`). */
export const STORE_VERSION = 2;

export const STORE_FILE = 'index.db';

export interface StoredVideo {
  dir: string;
  videoId: Id;
  name: string;
  revision: string;
  mtimeMs: number;
  indexedAt: string;
  facts: VideoFacts;
  problems: { documentId: Id; detail: string }[];
}

export interface SegmentRow extends ContentSegment {
  /** Write order: segments in the same video with the same time and kind are sorted by this. */
  id: number;
  dir: string;
}

export interface CandidateFilter {
  terms: readonly string[];
  kinds: readonly SpaceSearchDocumentKind[] | null;
  /** Normalized speaker segments. */
  speaker: string | null;
}

/** How long to wait while another Runtime (the dev-mode app and the CLI share one home directory) is writing. */
const BUSY_TIMEOUT_MS = 2_000;

/** trigram MATCH requires each word to have at least three characters (counted by code points). */
const TRIGRAM_MIN = 3;

const SCHEMA = `
  CREATE TABLE videos (
    dir TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    name TEXT NOT NULL,
    revision TEXT NOT NULL,
    mtime_ms REAL NOT NULL,
    indexed_at TEXT NOT NULL,
    facts TEXT NOT NULL,
    problems TEXT NOT NULL
  );
  CREATE TABLE segment_rows (
    id INTEGER PRIMARY KEY,
    dir TEXT NOT NULL,
    kind TEXT NOT NULL,
    document_id TEXT,
    language TEXT,
    clock TEXT NOT NULL,
    start REAL NOT NULL,
    "end" REAL NOT NULL,
    text TEXT NOT NULL,
    body TEXT NOT NULL,
    speaker TEXT,
    speaker_key TEXT
  );
  CREATE INDEX segment_rows_dir ON segment_rows(dir);
  CREATE VIRTUAL TABLE segments USING fts5(body, content='segment_rows', content_rowid='id', tokenize='trigram');
  CREATE TRIGGER segment_rows_ai AFTER INSERT ON segment_rows BEGIN
    INSERT INTO segments(rowid, body) VALUES (new.id, new.body);
  END;
  CREATE TRIGGER segment_rows_ad AFTER DELETE ON segment_rows BEGIN
    INSERT INTO segments(segments, rowid, body) VALUES ('delete', old.id, old.body);
  END;
`;

/**
 * Turns words into SQL conditions: words of three or more code points are combined into one MATCH expression (each word a quoted phrase, joined with AND); shorter ones each use an `instr`.
 * Both the text and the words are already normalized (NFKC, lowercase), so `instr` is an exact substring match.
 */
export function termClauses(terms: readonly string[]): { match: string | null; short: string[] } {
  const long: string[] = [];
  const short: string[] = [];
  for (const term of terms) {
    if ([...term].length >= TRIGRAM_MIN) long.push(`"${term.replaceAll('"', '""')}"`);
    else short.push(term);
  }
  return { match: long.length > 0 ? long.join(' AND ') : null, short };
}

export class ContentStore {
  readonly #file: string;
  #db: DatabaseSync;
  #statements = new Map<string, StatementSync>();

  /** Opens (creating it if needed) `<dir>/index.db`; a corrupt or wrong-version database is deleted and rebuilt. */
  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.#file = path.join(dir, STORE_FILE);
    this.#db = this.#open();
  }

  #open(): DatabaseSync {
    try {
      const db = new DatabaseSync(this.#file, { timeout: BUSY_TIMEOUT_MS });
      try {
        const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
        const empty = (db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }).n === 0;
        if (version === STORE_VERSION || empty) {
          db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
          if (empty) db.exec(`BEGIN; ${SCHEMA} PRAGMA user_version = ${STORE_VERSION}; COMMIT;`);
          return db;
        }
      } catch {
        // Not a SQLite database, or the database is corrupt: delete and rebuild.
      }
      db.close();
    } catch {
      // Cannot open: delete and rebuild.
    }
    removeStore(this.#file);
    const db = new DatabaseSync(this.#file, { timeout: BUSY_TIMEOUT_MS });
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    db.exec(`BEGIN; ${SCHEMA} PRAGMA user_version = ${STORE_VERSION}; COMMIT;`);
    return db;
  }

  #prepare(sql: string): StatementSync {
    let statement = this.#statements.get(sql);
    if (!statement) {
      statement = this.#db.prepare(sql);
      this.#statements.set(sql, statement);
    }
    return statement;
  }

  /** Records for all videos. Rows whose facts or problems JSON cannot be read back are treated as absent (and are overwritten by a re-read). */
  videos(): StoredVideo[] {
    const rows = this.#prepare('SELECT * FROM videos').all() as {
      dir: string;
      video_id: string;
      name: string;
      revision: string;
      mtime_ms: number;
      indexed_at: string;
      facts: string;
      problems: string;
    }[];
    const videos: StoredVideo[] = [];
    for (const row of rows) {
      try {
        videos.push({
          dir: row.dir,
          videoId: row.video_id,
          name: row.name,
          revision: row.revision,
          mtimeMs: row.mtime_ms,
          indexedAt: row.indexed_at,
          facts: JSON.parse(row.facts) as VideoFacts,
          problems: JSON.parse(row.problems) as StoredVideo['problems'],
        });
      } catch {
        // Wrong format: overwrite on re-read.
      }
    }
    return videos;
  }

  /** Replaces one video's record and all its segments (one transaction). */
  replace(video: StoredVideo, segments: readonly ContentSegment[]): void {
    const rows = segments.map((segment) => ({
      segment,
      body: normalizeText(segment.text),
      speakerKey: segment.speaker === null ? null : normalizeText(segment.speaker),
    }));
    const insert = this.#prepare(
      `INSERT INTO segment_rows (dir, kind, document_id, language, clock, start, "end", text, body, speaker, speaker_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.#transaction(() => {
      this.#prepare('DELETE FROM segment_rows WHERE dir = ?').run(video.dir);
      for (const { segment, body, speakerKey } of rows) {
        insert.run(
          video.dir,
          segment.kind,
          segment.documentId,
          segment.language,
          segment.clock,
          segment.start,
          segment.end,
          segment.text,
          body,
          segment.speaker,
          speakerKey,
        );
      }
      this.#prepare(
        `INSERT OR REPLACE INTO videos (dir, video_id, name, revision, mtime_ms, indexed_at, facts, problems)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        video.dir,
        video.videoId,
        video.name,
        video.revision,
        video.mtimeMs,
        video.indexedAt,
        JSON.stringify(video.facts),
        JSON.stringify(video.problems),
      );
    });
  }

  /** Version unchanged: only records the new modification time and name. */
  touch(dir: string, mtimeMs: number, name: string): void {
    this.#prepare('UPDATE videos SET mtime_ms = ?, name = ? WHERE dir = ?').run(mtimeMs, name, dir);
  }

  /** Deletes the records and segments of these videos (one transaction). */
  remove(dirs: readonly string[]): void {
    if (dirs.length === 0) return;
    this.#transaction(() => {
      for (const dir of dirs) {
        this.#prepare('DELETE FROM segment_rows WHERE dir = ?').run(dir);
        this.#prepare('DELETE FROM videos WHERE dir = ?').run(dir);
      }
    });
  }

  /**
   * Possibly matching segments: words are filtered via FTS (three or more characters) or `instr` (shorter ones), then filtered by kind and speaker. The caller must still check the results with `matchTerms`, because trigram case folding is not exactly the same as JS lowercasing; here we only narrow the set.
   */
  candidates(filter: CandidateFilter): SegmentRow[] {
    const { match, short } = termClauses(filter.terms);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (match !== null) {
      where.push('r.id IN (SELECT rowid FROM segments WHERE segments MATCH ?)');
      params.push(match);
    }
    for (const term of short) {
      where.push('instr(r.body, ?) > 0');
      params.push(term);
    }
    if (filter.kinds) {
      where.push(`r.kind IN (${filter.kinds.map(() => '?').join(', ')})`);
      params.push(...filter.kinds);
    }
    if (filter.speaker !== null) {
      where.push('r.speaker_key IS NOT NULL AND instr(r.speaker_key, ?) > 0');
      params.push(filter.speaker);
    }
    const sql = `SELECT r.id, r.dir, r.kind, r.document_id, r.language, r.clock, r.start, r."end", r.text, r.speaker
      FROM segment_rows r ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}`;
    // The conditions vary with the query, so they are not kept in the statement cache.
    const rows = this.#db.prepare(sql).all(...params) as {
      id: number;
      dir: string;
      kind: SpaceSearchDocumentKind;
      document_id: string | null;
      language: string | null;
      clock: 'sequence' | 'source';
      start: number;
      end: number;
      text: string;
      speaker: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      dir: row.dir,
      kind: row.kind,
      documentId: row.document_id,
      language: row.language,
      clock: row.clock,
      start: row.start,
      end: row.end,
      text: row.text,
      speaker: row.speaker,
    }));
  }

  close(): void {
    this.#statements.clear();
    if (this.#db.isOpen) this.#db.close();
  }

  #transaction(work: () => void): void {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      work();
      this.#db.exec('COMMIT');
    } catch (error) {
      if (this.#db.isTransaction) this.#db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Deletes the database file and its WAL side files (the connection must be closed first). */
export function removeStore(file: string): void {
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${file}${suffix}`, { force: true });
}
