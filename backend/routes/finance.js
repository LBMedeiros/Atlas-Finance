import express from "express";
import { db, newId, nowISO } from "../db.js";

const router = express.Router();

// Valores sempre em centavos (inteiros), para não ter erro de arredondamento
export const CATEGORIES = {
  expense: [
    "Alimentação",
    "Moradia",
    "Transporte",
    "Contas",
    "Saúde",
    "Educação",
    "Lazer",
    "Compras",
    "Outros",
  ],
  income: ["Salário", "Freelance", "Investimentos", "Presente", "Outros"],
};

// Categoria usada pelos depósitos/resgates das metas
const GOAL_CATEGORY = "Metas";

const MAX_CENTS = 100_000_000_00; // R$ 100 milhões
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);

const isValidDate = (value) =>
  DATE_REGEX.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

const isValidAmount = (value) =>
  Number.isInteger(value) && value > 0 && value <= MAX_CENTS;

const cleanText = (value, max) => String(value ?? "").trim().slice(0, max);

// ---------- Consultas ----------

const TX_COLUMNS = `id, type, amount, description, category, date,
  goal_id AS goalId, created_at AS createdAt`;
const GOAL_COLUMNS = `id, name, target, saved, deadline, created_at AS createdAt`;

const sql = {
  userByEmail: db.prepare("SELECT id FROM users WHERE email = ?"),

  listTx: db.prepare(`
    SELECT ${TX_COLUMNS} FROM transactions
    WHERE user_id = ? ORDER BY date DESC, created_at DESC`),
  listTxByMonth: db.prepare(`
    SELECT ${TX_COLUMNS} FROM transactions
    WHERE user_id = ? AND substr(date, 1, 7) = ? ORDER BY date DESC, created_at DESC`),
  recentTx: db.prepare(`
    SELECT ${TX_COLUMNS} FROM transactions
    WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 6`),
  getTx: db.prepare(`SELECT ${TX_COLUMNS} FROM transactions WHERE id = ? AND user_id = ?`),
  insertTx: db.prepare(`
    INSERT INTO transactions (id, user_id, type, amount, description, category, date, goal_id, created_at)
    VALUES (@id, @userId, @type, @amount, @description, @category, @date, @goalId, @createdAt)`),
  deleteTx: db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?"),

  balance: db.prepare(`
    SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount ELSE -amount END), 0) AS value
    FROM transactions WHERE user_id = ?`),
  txCount: db.prepare("SELECT COUNT(*) AS value FROM transactions WHERE user_id = ?"),
  monthTotals: db.prepare(`
    SELECT type, category = '${GOAL_CATEGORY}' AS isGoal, SUM(amount) AS total
    FROM transactions WHERE user_id = ? AND substr(date, 1, 7) = ?
    GROUP BY type, isGoal`),
  byCategory: db.prepare(`
    SELECT category, SUM(amount) AS amount FROM transactions
    WHERE user_id = ? AND type = 'expense' AND category <> '${GOAL_CATEGORY}'
      AND substr(date, 1, 7) = ?
    GROUP BY category ORDER BY amount DESC`),

  listGoals: db.prepare(`SELECT ${GOAL_COLUMNS} FROM goals WHERE user_id = ? ORDER BY created_at`),
  getGoal: db.prepare(`SELECT ${GOAL_COLUMNS} FROM goals WHERE id = ? AND user_id = ?`),
  insertGoal: db.prepare(`
    INSERT INTO goals (id, user_id, name, target, saved, deadline, created_at)
    VALUES (@id, @userId, @name, @target, 0, @deadline, @createdAt)`),
  updateGoalSaved: db.prepare("UPDATE goals SET saved = ? WHERE id = ?"),
  deleteGoal: db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?"),
  savedInGoals: db.prepare("SELECT COALESCE(SUM(saved), 0) AS value FROM goals WHERE user_id = ?"),
};

function addTransaction(userId, fields) {
  const tx = { id: newId(), userId, goalId: null, createdAt: nowISO(), ...fields };
  sql.insertTx.run(tx);
  return sql.getTx.get(tx.id, userId);
}

// O token guarda o email; aqui ele vira o id do usuário (e barra contas que não existem mais)
router.use((req, res, next) => {
  const user = sql.userByEmail.get(req.user.email);
  if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
  req.userId = user.id;
  next();
});

function validateTransaction(body) {
  const type = body?.type;
  const amount = body?.amount;
  const description = cleanText(body?.description, 80);
  const category = body?.category;
  const date = body?.date || today();

  if (!["income", "expense"].includes(type)) return { error: "Tipo inválido" };
  if (!isValidAmount(amount)) return { error: "Informe um valor maior que zero" };
  if (!description) return { error: "Informe uma descrição" };
  if (!CATEGORIES[type].includes(category)) return { error: "Categoria inválida" };
  if (!isValidDate(date)) return { error: "Data inválida" };

  return { value: { type, amount, description, category, date } };
}

router.get("/categories", (req, res) => {
  res.json(CATEGORIES);
});

// ---------- Transações ----------

router.get("/transactions", (req, res) => {
  const { month } = req.query;

  if (month && !MONTH_REGEX.test(month)) {
    return res.status(400).json({ error: "Mês inválido" });
  }

  res.json(month ? sql.listTxByMonth.all(req.userId, month) : sql.listTx.all(req.userId));
});

router.post("/transactions", (req, res) => {
  const { value, error } = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });

  res.status(201).json(addTransaction(req.userId, value));
});

router.delete("/transactions/:id", (req, res) => {
  const tx = sql.getTx.get(req.params.id, req.userId);
  if (!tx) return res.status(404).json({ error: "Transação não encontrada" });

  if (tx.category === GOAL_CATEGORY) {
    return res
      .status(400)
      .json({ error: "Movimentações de metas são desfeitas pela página de Metas" });
  }

  sql.deleteTx.run(tx.id, req.userId);
  res.status(204).end();
});

// ---------- Metas ----------

router.get("/goals", (req, res) => {
  res.json(sql.listGoals.all(req.userId));
});

router.post("/goals", (req, res) => {
  const name = cleanText(req.body?.name, 40);
  const target = req.body?.target;
  const deadline = req.body?.deadline || null;

  if (!name) return res.status(400).json({ error: "Dê um nome para a meta" });
  if (!isValidAmount(target)) return res.status(400).json({ error: "Informe um valor alvo maior que zero" });
  if (deadline && !isValidDate(deadline)) return res.status(400).json({ error: "Prazo inválido" });

  const id = newId();
  sql.insertGoal.run({ id, userId: req.userId, name, target, deadline, createdAt: nowISO() });

  res.status(201).json(sql.getGoal.get(id, req.userId));
});

// Depositar tira do saldo (despesa "Metas"); resgatar devolve (receita "Metas").
// Tudo numa transação do banco: ou atualiza a meta E registra a movimentação, ou nada.
const moveGoal = db.transaction((userId, goal, kind, amount) => {
  const deposit = kind === "deposit";
  sql.updateGoalSaved.run(goal.saved + (deposit ? amount : -amount), goal.id);
  addTransaction(userId, {
    type: deposit ? "expense" : "income",
    amount,
    description: `${deposit ? "Depósito" : "Resgate"}: ${goal.name}`,
    category: GOAL_CATEGORY,
    date: today(),
    goalId: goal.id,
  });
  return sql.getGoal.get(goal.id, userId);
});

router.post("/goals/:id/move", (req, res) => {
  const goal = sql.getGoal.get(req.params.id, req.userId);
  if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

  const { kind, amount } = req.body ?? {};
  if (!["deposit", "withdraw"].includes(kind)) return res.status(400).json({ error: "Operação inválida" });
  if (!isValidAmount(amount)) return res.status(400).json({ error: "Informe um valor maior que zero" });
  if (kind === "withdraw" && amount > goal.saved) {
    return res.status(400).json({ error: "Valor maior do que o guardado na meta" });
  }
  if (kind === "deposit" && amount > sql.balance.get(req.userId).value) {
    return res.status(400).json({ error: "Saldo insuficiente para esse depósito" });
  }

  res.json(moveGoal(req.userId, goal, kind, amount));
});

// O que estava guardado volta para o saldo antes de apagar a meta
const deleteGoal = db.transaction((userId, goal) => {
  if (goal.saved > 0) {
    addTransaction(userId, {
      type: "income",
      amount: goal.saved,
      description: `Resgate: ${goal.name} (meta excluída)`,
      category: GOAL_CATEGORY,
      date: today(),
    });
  }
  sql.deleteGoal.run(goal.id, userId);
});

router.delete("/goals/:id", (req, res) => {
  const goal = sql.getGoal.get(req.params.id, req.userId);
  if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

  deleteGoal(req.userId, goal);
  res.status(204).end();
});

// ---------- Resumo do dashboard ----------

const previousMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
};

function monthTotals(userId, month) {
  const totals = { income: 0, expense: 0, saved: 0 };
  for (const { type, isGoal, total } of sql.monthTotals.all(userId, month)) {
    if (isGoal) totals.saved += type === "expense" ? total : -total;
    else totals[type] += total;
  }
  return totals;
}

router.get("/summary", (req, res) => {
  const month = req.query.month || today().slice(0, 7);
  if (!MONTH_REGEX.test(month)) return res.status(400).json({ error: "Mês inválido" });

  const { userId } = req;

  res.json({
    month,
    balance: sql.balance.get(userId).value,
    savedInGoals: sql.savedInGoals.get(userId).value,
    current: monthTotals(userId, month),
    previous: monthTotals(userId, previousMonth(month)),
    byCategory: sql.byCategory.all(userId, month),
    recent: sql.recentTx.all(userId),
    goals: sql.listGoals.all(userId),
    transactionCount: sql.txCount.get(userId).value,
  });
});

export default router;
