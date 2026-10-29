// Cria o backend/.env com um JWT_SECRET aleatório (só se ainda não existir)
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (existsSync(envPath)) {
  console.log("backend/.env já existe, nada a fazer.");
} else {
  const template = readFileSync(join(root, ".env.example"), "utf-8");
  const secret = randomBytes(48).toString("hex");
  writeFileSync(envPath, template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  console.log("backend/.env criado com um JWT_SECRET aleatório.");
}
