import jwt from "jsonwebtoken";

// Sem segredo padrão no código: quem lesse o repositório conseguiria forjar logins
export const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "JWT_SECRET ausente ou curto demais (mínimo 32 caracteres).\n" +
      "Rode `npm run setup` na raiz do projeto para gerar o backend/.env automaticamente.",
  );
  process.exit(1);
}

export function verifyToken(req, res, next) {
  // Aceita "Bearer <token>" ou só o token
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) return res.status(401).json({ error: "Sem token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}
