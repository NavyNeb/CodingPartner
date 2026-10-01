import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

/** Open (and migrate) the database. Pass ':memory:' in tests. */
export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version < 1) {
    db.exec(`
      CREATE TABLE profiles (
        id            TEXT PRIMARY KEY,
        recovery_hash TEXT NOT NULL UNIQUE,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        version       INTEGER NOT NULL DEFAULT 0,
        state         TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE tokens (
        hash        TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at  INTEGER NOT NULL,
        last_used   INTEGER NOT NULL
      );
      CREATE INDEX tokens_profile ON tokens(profile_id);
      CREATE TABLE shares (
        id          TEXT PRIMARY KEY,
        profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL,
        created_at  INTEGER NOT NULL,
        payload     TEXT NOT NULL
      );
      CREATE INDEX shares_profile ON shares(profile_id);
      PRAGMA user_version = 1;
    `);
  }
  return db;
}
