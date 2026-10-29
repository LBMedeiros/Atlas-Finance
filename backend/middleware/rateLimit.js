// Limite simples de tentativas por IP, em memória (suficiente para um servidor só).
// Protege login e cadastro contra tentativa e erro de senha.
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  // Limpa contadores vencidos de tempos em tempos para não crescer para sempre
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      res.set("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}
