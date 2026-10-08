import type Database from 'better-sqlite3';
import type { Holding, Industry, Market, Note, Stock } from '../../shared/models';
import { createDatabase } from './connection';

type IndustryRow = { id: number; name: string; created_at: string };
type StockRow = { id: number; code: string; name: string; market: Market; industry_id: number; created_at: string };
type HoldingRow = { stock_id: number; shares: number };
type NoteRow = { stock_id: number; content: string; updated_at: string };

const now = () => new Date().toISOString();
const toIndustry = (row: IndustryRow): Industry => ({ id: row.id, name: row.name, createdAt: row.created_at });
const toStock = (row: StockRow): Stock => ({ id: row.id, code: row.code, name: row.name, market: row.market, industryId: row.industry_id, createdAt: row.created_at });

export interface Repository {
  createIndustry(input: { name: string }): Industry;
  createStock(input: { code: string; name: string; market: Market; industryId: number }): Stock;
  findStock(id: number): Stock | null;
  setHolding(stockId: number, shares: number): Holding;
  getHolding(stockId: number): Holding | null;
  saveNote(stockId: number, content: string): Note;
  getNote(stockId: number): Note | null;
  deleteIndustry(id: number): void;
  deleteStock(id: number): void;
  close(): void;
}

export function createRepository(database: Database.Database): Repository {
  return {
    createIndustry({ name }) {
      const createdAt = now();
      const result = database.prepare('INSERT INTO industries (name, created_at) VALUES (?, ?)').run(name.trim(), createdAt);
      return { id: Number(result.lastInsertRowid), name: name.trim(), createdAt };
    },
    createStock({ code, name, market, industryId }) {
      const createdAt = now();
      const result = database.prepare('INSERT INTO stocks (code, name, market, industry_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(code.trim(), name.trim(), market, industryId, createdAt);
      return { id: Number(result.lastInsertRowid), code: code.trim(), name: name.trim(), market, industryId, createdAt };
    },
    findStock(id) {
      const row = database.prepare('SELECT * FROM stocks WHERE id = ?').get(id) as StockRow | undefined;
      return row ? toStock(row) : null;
    },
    setHolding(stockId, shares) {
      if (!Number.isInteger(shares) || shares < 0) throw new Error('持有股数必须是非负整数');
      database.prepare(`INSERT INTO holdings (stock_id, shares) VALUES (?, ?)
        ON CONFLICT(stock_id) DO UPDATE SET shares = excluded.shares`).run(stockId, shares);
      return { stockId, shares };
    },
    getHolding(stockId) {
      const row = database.prepare('SELECT * FROM holdings WHERE stock_id = ?').get(stockId) as HoldingRow | undefined;
      return row ? { stockId: row.stock_id, shares: row.shares } : null;
    },
    saveNote(stockId, content) {
      const updatedAt = now();
      database.prepare(`INSERT INTO notes (stock_id, content, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(stock_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`).run(stockId, content, updatedAt);
      return { stockId, content, updatedAt };
    },
    getNote(stockId) {
      const row = database.prepare('SELECT * FROM notes WHERE stock_id = ?').get(stockId) as NoteRow | undefined;
      return row ? { stockId: row.stock_id, content: row.content, updatedAt: row.updated_at } : null;
    },
    deleteIndustry(id) { database.prepare('DELETE FROM industries WHERE id = ?').run(id); },
    deleteStock(id) { database.prepare('DELETE FROM stocks WHERE id = ?').run(id); },
    close() { database.close(); },
  };
}

export function createTestRepository(): Repository {
  return createRepository(createDatabase());
}
