import Database from 'better-sqlite3';

export function createDatabase(filename = ':memory:') {
  const database = new Database(filename);
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS industries (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      market TEXT NOT NULL CHECK (market IN ('CN', 'HK')),
      industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS holdings (
      stock_id INTEGER PRIMARY KEY REFERENCES stocks(id) ON DELETE CASCADE,
      shares INTEGER NOT NULL CHECK (shares >= 0)
    );
    CREATE TABLE IF NOT EXISTS notes (
      stock_id INTEGER PRIMARY KEY REFERENCES stocks(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}
