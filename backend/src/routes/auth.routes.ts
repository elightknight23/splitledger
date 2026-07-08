import { Router } from "express";
import type { CookieOptions } from "express";
import {
  EmailInUseError,
  InvalidCredentialsError,
  generateAccessToken,
  generateRefreshToken,
  registerUser,
  validateCredentials,
  verifyRefreshToken,
} from "../services/auth.service";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Cross-site in prod (frontend/backend on different domains) needs "none";
  // same-site localhost dev works with the more restrictive "lax".
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  // Scoped so the cookie is never sent on unrelated requests. The browser
  // matches Path against the URL it requested — behind the Vercel proxy that's
  // /api/auth/refresh, not /auth/refresh — so prod overrides it via env.
  path: process.env.REFRESH_COOKIE_PATH ?? "/auth/refresh",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches REFRESH_TOKEN_TTL in auth.service.ts
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const user = await registerUser({ name, email, password });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
    });
  } catch (err) {
    if (err instanceof EmailInUseError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const user = await validateCredentials({ email, password });
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
    });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!isNonEmptyString(token)) {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// Not in SPLITLEDGER_SPEC.md's endpoint draft, but kept as a real endpoint
// (promoted from a temporary test route) since it doubles as the frontend's
// future "who's logged in" check and proves the auth middleware works.
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// The refresh token lives in an httpOnly cookie, so client-side JS can never
// clear it directly — without this endpoint, "logout" could only wipe the
// in-memory access token, and the next page load would silently re-authenticate
// the user via POST /auth/refresh anyway. clearCookie needs the same path
// (and sameSite/secure) the cookie was set with, or the browser won't match it.
router.post("/logout", (_req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
  res.status(204).send();
});

export default router;
