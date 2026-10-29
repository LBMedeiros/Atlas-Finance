import { useEffect, useState } from "react";
import { api } from "../api";
import { parseMoney, todayISO } from "../format";
import Modal from "./Modal";

// As categorias quase nunca mudam: busca uma vez e reaproveita
let categoriesPromise;
const loadCategories = () => {
  categoriesPromise ??= api.categories().catch((err) => {
    categoriesPromise = undefined;
    throw err;
  });
  return categoriesPromise;
};

function TransactionForm({ initialType = "expense", onClose, onSaved }) {
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO);
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories()
      .then(setCategories)
      .catch((err) => setError(err.message));
  }, []);

  const changeType = (next) => {
    setType(next);
    setCategory("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cents = parseMoney(amount);
    if (!cents) return setError("Informe um valor válido, ex: 150,90");
    if (!category) return setError("Escolha uma categoria");

    setSaving(true);
    try {
      await api.addTransaction({ type, amount: cents, description, category, date });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Nova transação" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="segmented" role="group" aria-label="Tipo">
          <button
            type="button"
            className={type === "expense" ? "active expense" : ""}
            aria-pressed={type === "expense"}
            onClick={() => changeType("expense")}
          >
            Despesa
          </button>
          <button
            type="button"
            className={type === "income" ? "active income" : ""}
            aria-pressed={type === "income"}
            onClick={() => changeType("income")}
          >
            Receita
          </button>
        </div>

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

        <label className="field">
          <span>Descrição</span>
          <input
            placeholder={type === "expense" ? "Ex: Mercado do mês" : "Ex: Salário de outubro"}
            maxLength={80}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend>Categoria</legend>
          <div className="chips">
            {categories?.[type].map((name) => (
              <button
                type="button"
                key={name}
                className={`chip ${category === name ? "active" : ""}`}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Data</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={saving || !amount || !description.trim()}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default TransactionForm;
