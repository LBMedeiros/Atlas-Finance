import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { currentMonth, formatDay, formatMoney, monthName } from "../format";
import Icon from "../components/Icon";
import MonthNav from "../components/MonthNav";
import TransactionForm from "../components/TransactionForm";
import TransactionList from "../components/TransactionList";

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "income", label: "Receitas" },
  { value: "expense", label: "Despesas" },
];

function Transactions() {
  const [month, setMonth] = useState(currentMonth);
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .transactions(month)
      .then((list) => {
        setItems(list);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (tx) => {
    if (!window.confirm(`Excluir "${tx.description}" (${formatMoney(tx.amount)})?`)) return;
    try {
      await api.deleteTransaction(tx.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Movimentações de metas não são ganho nem gasto: dinheiro guardado fica à parte (igual ao dashboard)
  const sum = (pred) => items?.filter(pred).reduce((s, t) => s + t.amount, 0) ?? 0;
  const isGoal = (t) => t.category === "Metas";
  const income = sum((t) => t.type === "income" && !isGoal(t));
  const expense = sum((t) => t.type === "expense" && !isGoal(t));
  const saved = sum((t) => isGoal(t) && t.type === "expense") - sum((t) => isGoal(t) && t.type === "income");
  const visible = items?.filter((t) => filter === "all" || t.type === filter) ?? [];

  // Agrupa por dia, mantendo a ordem (mais recente primeiro)
  const groups = [];
  for (const tx of visible) {
    const last = groups[groups.length - 1];
    if (last?.date === tx.date) last.items.push(tx);
    else groups.push({ date: tx.date, items: [tx] });
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Movimentações</p>
          <h1>Transações</h1>
        </div>
        <div className="page-header-actions">
          <MonthNav month={month} onChange={setMonth} />
          <button type="button" className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Nova transação
          </button>
        </div>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="summary-strip">
        <div>
          <span>Entradas</span>
          <strong className="income">+ {formatMoney(income)}</strong>
        </div>
        <div>
          <span>Saídas</span>
          <strong className="expense">− {formatMoney(expense)}</strong>
        </div>
        <div>
          <span>Guardado em metas</span>
          <strong className={saved < 0 ? "negative" : ""}>{formatMoney(saved)}</strong>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div className="segmented small" role="group" aria-label="Filtrar">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={filter === f.value ? "active" : ""}
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="panel-meta">
            {visible.length} {visible.length === 1 ? "transação" : "transações"}
          </span>
        </div>

        {items === null ? (
          <div className="page-loading" aria-label="Carregando" />
        ) : groups.length === 0 ? (
          <p className="empty">Nenhuma transação em {monthName(month)}.</p>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="tx-group">
              <h3>{formatDay(group.date)}</h3>
              <TransactionList items={group.items} onDelete={handleDelete} showDate={false} />
            </div>
          ))
        )}
      </section>

      {adding && (
        <TransactionForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </>
  );
}

export default Transactions;
