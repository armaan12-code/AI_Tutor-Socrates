import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'socrates.db');

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT    REFERENCES projects(id) ON DELETE SET NULL,
    title      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT    PRIMARY KEY,
    session_id TEXT    NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL,
    content    TEXT    NOT NULL,
    image      TEXT,
    timestamp  INTEGER NOT NULL
  );
`);

// ─── User helpers ─────────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: number;
}

export const userQueries = {
  findByEmail: db.prepare<string, UserRow>(
    'SELECT * FROM users WHERE email = ?'
  ),
  findById: db.prepare<number, UserRow>(
    'SELECT * FROM users WHERE id = ?'
  ),
  insert: db.prepare<[string, string, string], { lastInsertRowid: number }>(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ),
};

// ─── Project helpers ──────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  user_id: number;
  name: string;
  created_at: number;
}

export const projectQueries = {
  listByUser: db.prepare<number, ProjectRow>(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
  ),
  findById: db.prepare<string, ProjectRow>(
    'SELECT * FROM projects WHERE id = ?'
  ),
  insert: db.prepare<[string, number, string, number], void>(
    'INSERT INTO projects (id, user_id, name, created_at) VALUES (?, ?, ?, ?)'
  ),
  update: db.prepare<[string, string], void>(
    'UPDATE projects SET name = ? WHERE id = ?'
  ),
  delete: db.prepare<string, void>(
    'DELETE FROM projects WHERE id = ?'
  ),
};

// ─── Session helpers ──────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: number;
  project_id: string | null;
  title: string;
  updated_at: number;
}

export const sessionQueries = {
  listByUser: db.prepare<number, SessionRow>(
    'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC'
  ),
  findById: db.prepare<string, SessionRow>(
    'SELECT * FROM chat_sessions WHERE id = ?'
  ),
  insert: db.prepare<[string, number, string | null, string, number], void>(
    'INSERT INTO chat_sessions (id, user_id, project_id, title, updated_at) VALUES (?, ?, ?, ?, ?)'
  ),
  update: db.prepare<[string, string | null, number, string], void>(
    'UPDATE chat_sessions SET title = ?, project_id = ?, updated_at = ? WHERE id = ?'
  ),
  delete: db.prepare<string, void>(
    'DELETE FROM chat_sessions WHERE id = ?'
  ),
};

// ─── Message helpers ──────────────────────────────────────────────────────────

export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  image: string | null;
  timestamp: number;
}

export const messageQueries = {
  listBySession: db.prepare<string, MessageRow>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC'
  ),
  insert: db.prepare<[string, string, string, string, string | null, number], void>(
    'INSERT INTO messages (id, session_id, role, content, image, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  deleteBySession: db.prepare<string, void>(
    'DELETE FROM messages WHERE session_id = ?'
  ),
};
