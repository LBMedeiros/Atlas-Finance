import { formatDay, formatMoney } from "../format";
import Icon from "./Icon";

// Lista de transações; com onDelete mostra o botão de excluir
function TransactionList({ items, onDelete, showDate = true }) {
  return (
    <ul className="tx-list">
      {items.map((tx) => (
        <li key={tx.id} className="tx-row">
          <span className={`tx-icon ${tx.type}`}>
            <Icon name={tx.type === "income" ? "arrowUp" : "arrowDown"} size={16} />
          </span>
          <div className="tx-info">
            <strong>{tx.description}</strong>
            <span>
              {tx.category}
              {showDate && ` · ${formatDay(tx.date)}`}
            </span>
          </div>
          <span className={`tx-amount ${tx.type}`}>
            {tx.type === "income" ? "+ " : "− "}
            {formatMoney(tx.amount)}
          </span>
          {onDelete &&
            (tx.category === "Metas" ? (
              <span className="tx-delete-placeholder" title="Movimentação de meta: desfaça pela página Metas" />
            ) : (
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`Excluir ${tx.description}`}
                onClick={() => onDelete(tx)}
              >
                <Icon name="trash" size={16} />
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}

export default TransactionList;
