// Banco SQLite (arquivo em backend/data/atlas.db)
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(process.env.DB_PATH || join(DATA_DIR, "atlas.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    target     INTEGER NOT NULL CHECK (target > 0),
    saved      INTEGER NOT NULL DEFAULT 0 CHECK (saved >= 0),
    deadline   TEXT,
    created_at TEXT    NOT NULL
  );

  -- Valores em centavos (inteiros)
  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    description TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    date        TEXT    NOT NULL,
    goal_id     TEXT    REFERENCES goals(id) ON DELETE SET NULL,
    created_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
`);

export const newId = () => randomUUID();

export const nowISO = () => new Date().toISOString();

// Importa o banco antigo em JSON (versão anterior do projeto) uma única vez
function migrateFromJson() {
  const jsonPath = join(DATA_DIR, "db.json");
  if (!existsSync(jsonPath)) return;

  const old = JSON.parse(readFileSync(jsonPath, "utf-8"));
  const userIds = new Map();

  db.transaction(() => {
    const insertUser = db.prepare(
      "INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)",
    );
    const findUser = db.prepare("SELECT id FROM users WHERE email = ?");
    for (const u of old.users ?? []) {
      insertUser.run(u.email, u.password);
      userIds.set(u.email, findUser.get(u.email).id);
    }

    const insertGoal = db.prepare(`
      INSERT OR IGNORE INTO goals (id, user_id, name, target, saved, deadline, created_at)
      VALUES (@id, @userId, @name, @target, @saved, @deadline, @createdAt)
    `);
    for (const g of old.goals ?? []) {
      if (userIds.has(g.owner)) insertGoal.run({ ...g, userId: userIds.get(g.owner) });
    }

    const goalExists = db.prepare("SELECT 1 FROM goals WHERE id = ?");
    const insertTx = db.prepare(`
      INSERT OR IGNORE INTO transactions
        (id, user_id, type, amount, description, category, date, goal_id, created_at)
      VALUES (@id, @userId, @type, @amount, @description, @category, @date, @goalId, @createdAt)
    `);
    for (const t of old.transactions ?? []) {
      if (!userIds.has(t.owner)) continue;
      const goalId = t.goalId && goalExists.get(t.goalId) ? t.goalId : null;
      insertTx.run({ ...t, userId: userIds.get(t.owner), goalId });
    }
  })();

  renameSync(jsonPath, `${jsonPath}.migrado`);
  console.log(`Banco JSON importado para o SQLite (${userIds.size} usuários)`);
}

migrateFromJson();
