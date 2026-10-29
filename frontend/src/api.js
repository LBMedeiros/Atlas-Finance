const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const getToken = () => localStorage.getItem("token");

export const clearToken = () => localStorage.removeItem("token");

// Faz a requisição e devolve o JSON; lança Error com a mensagem do backend em caso de falha
export async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor");
  }

  // Sessão expirou: limpa o token e volta para o login
  if (response.status === 401 && token) {
    clearToken();
    window.location.assign("/");
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || "Algo deu errado, tente novamente");
    error.status = response.status;
    throw error;
  }

  return data;
}

export const api = {
  summary: (month) => request(`/api/summary?month=${month}`),
  categories: () => request("/api/categories"),
  transactions: (month) => request(`/api/transactions?month=${month}`),
  addTransaction: (tx) => request("/api/transactions", { method: "POST", body: tx }),
  deleteTransaction: (id) => request(`/api/transactions/${id}`, { method: "DELETE" }),
  goals: () => request("/api/goals"),
  addGoal: (goal) => request("/api/goals", { method: "POST", body: goal }),
  moveGoal: (id, kind, amount) =>
    request(`/api/goals/${id}/move`, { method: "POST", body: { kind, amount } }),
  deleteGoal: (id) => request(`/api/goals/${id}`, { method: "DELETE" }),
};
