import { formatMonth, shiftMonth } from "../format";
import Icon from "./Icon";

function MonthNav({ month, onChange }) {
  return (
    <div className="month-nav">
      <button
        type="button"
        className="icon-btn"
        aria-label="Mês anterior"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <Icon name="chevronLeft" />
      </button>
      <span className="month-label">{formatMonth(month)}</span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Próximo mês"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  );
}

export default MonthNav;
