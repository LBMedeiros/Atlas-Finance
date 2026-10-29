import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { currentMonth, formatMoney, monthName, shiftMonth } from "../format";
import Icon from "../components/Icon";
import MonthNav from "../components/MonthNav";
import TransactionForm from "../components/TransactionForm";
import TransactionList from "../components/TransactionList";
import "./dashboard.css";

// Texto de comparação com o mês anterior (a seta e a palavra dizem a direção, não só a cor)
function compare(current, previous, month) {
  const prevName = monthName(shiftMonth(month, -1));
  if (!previous) return current ? `Nada em ${prevName} para comparar` : "Sem movimentação";

  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `Igual a ${prevName}`;
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs. ${prevName}`;
}

function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(null);

  const load = useCallback(() => {
    api
      .summary(month)
      .then((summary) => {
        setData(summary);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <p className="page-error">{error}</p>;
  if (!data) return <div className="page-loading" aria-label="Carregando" />;

  const { current, previous, byCategory, goals } = data;
  const result = current.income - current.expense;
  const savingsRate = current.income ? Math.round((result / current.income) * 100) : null;
  const maxCategory = byCategory[0]?.amount ?? 0;
  const isEmpty = data.transactionCount === 0;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1>Dashboard</h1>
        </div>
        <MonthNav month={month} onChange={setMonth} />
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">Saldo disponível</p>
          <p className={`hero-figure ${data.balance < 0 ? "negative" : ""}`}>
            {formatMoney(data.balance)}
          </p>
          <p className="hero-text">
            {isEmpty
              ? "Registre sua primeira receita para o Atlas começar a mapear seu dinheiro."
              : `${formatMoney(data.savedInGoals)} guardados em metas · patrimônio de ${formatMoney(
                  data.balance + data.savedInGoals,
                )}`}
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={() => setAdding("income")}>
              <Icon name="plus" size={16} /> Receita
            </button>
            <button type="button" className="btn secondary" onClick={() => setAdding("expense")}>
              <Icon name="minus" size={16} /> Despesa
            </button>
          </div>
        </div>

        <div className="hero-orb" aria-hidden="true">
          <div className="hero-orb-core">A</div>
          <span className="hero-line hero-line-1"></span>
          <span className="hero-line hero-line-2"></span>
          <span className="hero-line hero-line-3"></span>
        </div>
      </section>

      <div className="kpis">
        <div className="kpi">
          <p>Receitas</p>
          <strong>{formatMoney(current.income)}</strong>
          <span>{compare(current.income, previous.income, month)}</span>
        </div>
        <div className="kpi">
          <p>Despesas</p>
          <strong>{formatMoney(current.expense)}</strong>
          <span>{compare(current.expense, previous.expense, month)}</span>
        </div>
        <div className="kpi">
          <p>Sobra do mês</p>
          <strong className={result < 0 ? "negative" : ""}>{formatMoney(result)}</strong>
          <span>
            {savingsRate === null
              ? "Sem receitas no mês"
              : result < 0
                ? "Gastou mais do que ganhou"
                : `${savingsRate}% da renda ficou com você`}
          </span>
        </div>
      </div>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Gastos por categoria</h2>
            <span className="panel-meta">{formatMoney(current.expense)}</span>
          </div>

          {byCategory.length === 0 ? (
            <p className="empty">Nenhuma despesa em {monthName(month)}.</p>
          ) : (
            <ul className="bars" aria-label="Gastos por categoria">
              {byCategory.map(({ category, amount }) => {
                const share = Math.round((amount / current.expense) * 100);
                return (
                  <li key={category} title={`${category}: ${formatMoney(amount)} (${share}% das despesas)`}>
                    <div className="bar-label">
                      <span>{category}</span>
                      <span>
                        {formatMoney(amount)} <em>{share}%</em>
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(amount / maxCategory) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Metas</h2>
            <Link to="/metas" className="panel-link">
              Ver todas
            </Link>
          </div>

          {goals.length === 0 ? (
            <p className="empty">
              Nenhuma meta ainda. <Link to="/metas">Criar a primeira</Link>
            </p>
          ) : (
            <ul className="goal-mini-list">
              {goals.slice(0, 3).map((goal) => {
                const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
                return (
                  <li key={goal.id} className={pct === 100 ? "done" : ""}>
                    <div className="bar-label">
                      <span>{goal.name}</span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className="meter"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={goal.name}
                    >
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <small>
                      {formatMoney(goal.saved)} de {formatMoney(goal.target)}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Últimas transações</h2>
          <Link to="/transacoes" className="panel-link">
            Ver todas
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="empty">Nenhuma transação ainda. Use os botões acima para começar.</p>
        ) : (
          <TransactionList items={data.recent} />
        )}
      </section>

      {adding && (
        <TransactionForm
          initialType={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      )}
    </>
  );
}

export default Dashboard;
