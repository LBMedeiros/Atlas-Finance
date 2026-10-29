// Precisa ser o primeiro import: carrega o .env antes dos outros módulos lerem process.env
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import financeRoutes from "./routes/finance.js";
import { verifyToken } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { db } from "./db.js";

const PORT = process.env.PORT || 3000;
// Só o frontend do Atlas pode chamar a API pelo navegador (separe vários com vírgula)
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((o) => o.trim());

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: "20kb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(
  ["/auth/login", "/auth/register"],
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Muitas tentativas. Espere alguns minutos e tente de novo.",
  }),
);
app.use("/auth", authRoutes);
app.use("/api", verifyToken, financeRoutes);

app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));

// Erros não tratados viram JSON (sem vazar detalhes internos para o navegador)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido" });
  }
  // Erros do próprio cliente (ex: corpo grande demais) mantêm o status original
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: "Requisição inválida" });
  }
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// Fecha o banco direito ao parar o servidor (Ctrl+C ou deploy)
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
