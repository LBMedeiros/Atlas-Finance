import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { currentMonth, daysUntil, formatMoney, parseMoney } from "../format";
import Icon from "../components/Icon";
import Modal from "../components/Modal";

function GoalForm({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cents = parseMoney(target);
    if (!cents) return setError("Informe um valor válido, ex: 5.000,00");

    setSaving(true);
    try {
      await api.addGoal({ name, target: cents, deadline: deadline || null });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Nova meta" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>Nome</span>
          <input
            placeholder="Ex: Viagem, Reserva de emergência"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Quanto você quer juntar</span>
          <div className="money-input">
            <em>R$</em>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </label>
        <label className="field">
          <span>Prazo (opcional)</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={saving || !name.trim() || !target}>
            {saving ? "Salvando..." : "Criar meta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MoveForm({ goal, kind, balance, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const deposit = kind === "deposit";
  const limit = deposit ? balance : goal.saved;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents) return setError("Informe um valor válido");

    setSaving(true);
    try {
      await api.moveGoal(goal.id, kind, cents);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`${deposit ? "Depositar em" : "Resgatar de"} ${goal.name}`} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>Valor</span>
          <div className="money-input">
            <em>R$</em>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </label>
        <p className="form-hint">
          {deposit
            ? `Sai do seu saldo disponível (${formatMoney(Math.max(limit, 0))}).`
            : `Volta para o seu saldo. Guardado na meta: ${formatMoney(limit)}.`}
        </p>
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={saving || !amount}>
            {saving ? "Salvando..." : deposit ? "Depositar" : "Resgatar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function deadlineInfo(goal) {
  const missing = goal.target - goal.saved;
  if (missing <= 0) return "Meta concluída";
  if (!goal.deadline) return `Faltam ${formatMoney(missing)}`;

  const days = daysUntil(goal.deadline);
  if (days < 0) return `Prazo passou · faltam ${formatMoney(missing)}`;

  const months = Math.max(1, Math.ceil(days / 30));
  return `Guarde ${formatMoney(Math.ceil(missing / months))}/mês para chegar no prazo`;
}

function Goals() {
  const [goals, setGoals] = useState(null);
  const [balance, setBalance] = useState(0);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    // O resumo já traz metas e saldo juntos
    api
      .summary(currentMonth())
      .then((summary) => {
        setGoals(summary.goals);
        setBalance(summary.balance);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (goal) => {
    const extra = goal.saved > 0 ? ` Os ${formatMoney(goal.saved)} guardados voltam para o saldo.` : "";
    if (!window.confirm(`Excluir a meta "${goal.name}"?${extra}`)) return;
    try {
      await api.deleteGoal(goal.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const afterSave = () => {
    setCreating(false);
    setMoving(null);
    load();
  };

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Objetivos</p>
          <h1>Metas</h1>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> Nova meta
        </button>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {goals === null ? (
        <div className="page-loading" aria-label="Carregando" />
      ) : goals.length === 0 ? (
        <section className="panel empty-state">
          <span className="empty-icon">
            <Icon name="goals" size={28} />
          </span>
          <h2>Para onde vai o seu dinheiro?</h2>
          <p>
            Crie metas como uma viagem, um carro ou uma reserva de emergência e acompanhe quanto
            falta para chegar lá.
          </p>
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> Criar primeira meta
          </button>
        </section>
      ) : (
        <div className="goal-grid">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
            const done = goal.saved >= goal.target;
            return (
              <article key={goal.id} className={`panel goal-card ${done ? "done" : ""}`}>
                <div className="goal-top">
                  <h2>{goal.name}</h2>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Excluir meta ${goal.name}`}
                    onClick={() => handleDelete(goal)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>

                <p className="goal-amount">
                  <strong>{formatMoney(goal.saved)}</strong>
                  <span> de {formatMoney(goal.target)}</span>
                </p>

                <div
                  className="meter large"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progresso de ${goal.name}`}
                >
                  <div style={{ width: `${pct}%` }} />
                </div>

                <div className="goal-meta">
                  <span className="goal-pct">{pct}%</span>
                  <span>{deadlineInfo(goal)}</span>
                </div>

                <div className="goal-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setMoving({ goal, kind: "deposit" })}
                  >
                    Depositar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={goal.saved === 0}
                    onClick={() => setMoving({ goal, kind: "withdraw" })}
                  >
                    Resgatar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creating && <GoalForm onClose={() => setCreating(false)} onSaved={afterSave} />}
      {moving && (
        <MoveForm
          goal={moving.goal}
          kind={moving.kind}
          balance={balance}
          onClose={() => setMoving(null)}
          onSaved={afterSave}
        />
      )}
    </>
  );
}

export default Goals;
