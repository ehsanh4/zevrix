/* ============================================================
   ZEVRIX — Auth middleware (JWT)
   ============================================================ */
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "ds_super_secret_change_me_2026";
export const TOKEN_TTL = "7d";

export function signToken(admin) {
  return jwt.sign({ id: admin.id, username: admin.username, name: admin.name }, JWT_SECRET, {
    expiresIn: TOKEN_TTL
  });
}

/* Bearer token → req.admin */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
