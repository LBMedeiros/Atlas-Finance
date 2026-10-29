import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { verifyToken, JWT_SECRET } from "../middleware/auth.js";
import { db } from "../db.js";

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const findUserByEmail = db.prepare("SELECT id, email, password FROM users WHERE email = ?");
const insertUser = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");

// Cadastro
router.post("/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Informe um email válido" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "A senha precisa ter pelo menos 6 caracteres" });
  }

  if (findUserByEmail.get(email)) {
    return res.status(409).json({ error: "Este email já está cadastrado" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    insertUser.run(email, hashedPassword);
  } catch (err) {
    // Dois cadastros simultâneos com o mesmo email: o UNIQUE do banco barra o segundo
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Este email já está cadastrado" });
    }
    throw err;
  }

  res.status(201).json({ message: "Usuário criado" });
});

// Login
router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  const user = findUserByEmail.get(email);
  const valid = user && (await bcrypt.compare(password, user.password));

  // Mesma mensagem para os dois casos, para não revelar quais emails existem
  if (!valid) return res.status(401).json({ error: "Email ou senha inválidos" });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

  res.json({ token });
});

router.get("/dashboard", verifyToken, (req, res) => {
  res.json({ email: req.user.email, message: `Bem-vindo, ${req.user.email}` });
});

export default router;
