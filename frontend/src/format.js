const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Valores chegam do backend em centavos
export const formatMoney = (cents) => currency.format(cents / 100);

// Aceita "1.234,56", "1234,56", "1234.56" ou "1234" e devolve centavos (ou null se inválido)
export function parseMoney(text) {
  let clean = String(text).trim().replace(/[R$\s]/g, "");
  if (!clean) return null;

  if (clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    clean = clean.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  }

  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const currentMonth = () => todayISO().slice(0, 7);

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const monthName = (month) => formatMonth(month).split(" ")[0].toLowerCase();

export function formatDay(iso) {
  const today = todayISO();
  if (iso === today) return "Hoje";

  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  if (iso === yesterday) return "Ontem";

  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function daysUntil(iso) {
  const ms = new Date(`${iso}T00:00:00Z`) - new Date(`${todayISO()}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
