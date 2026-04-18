import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { assertCsrf } from "./csrf.js";
import { json } from "./json.js";

const SESSION_COOKIE_NAME = "cms_session";

export function createSessionCookie(sessionId, expiresAt) {
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function verifyPassword(passwordHash, password) {
  if (!passwordHash || !password) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

export function readSessionCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));

  return match ? match[1] : null;
}

export async function readSession(env, request) {
  const sessionId = request ? readSessionCookie(request) : null;
  if (!sessionId) {
    return null;
  }

  const session = await env.CMS_DB.prepare(
    "SELECT id, user_id, csrf_token, expires_at FROM cms_sessions WHERE id = ?",
  ).bind(sessionId).first();

  return session && Date.parse(session.expires_at) > Date.now()
    ? session
    : null;
}

export async function requireSession(context, options = {}) {
  const session = await readSession(context.env, context.request);
  if (!session) {
    return {
      ok: false,
      response: json({ ok: false, error: "unauthenticated" }, { status: 401 }),
    };
  }

  if (options.csrf) {
    try {
      assertCsrf(context.request, session);
    } catch {
      return {
        ok: false,
        response: json({ ok: false, error: "invalid_csrf" }, { status: 403 }),
      };
    }
  }

  return { ok: true, session };
}

export async function createSession(env, userId) {
  const id = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();

  await env.CMS_DB.prepare(
    "INSERT INTO cms_sessions (id, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, userId, csrfToken, createdAt, expiresAt).run();

  return { id, userId, csrfToken, expiresAt };
}

export function newToken() {
  return crypto.randomBytes(32).toString("hex");
}
