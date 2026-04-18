import { json } from "../../_lib/json.js";
import { readSessionCookie } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const sessionId = readSessionCookie(context.request);
  const session = sessionId
    ? await context.env.CMS_DB.prepare(
      "SELECT id, user_id, csrf_token, expires_at FROM cms_sessions WHERE id = ?",
    ).bind(sessionId).first()
    : null;

  return json(
    session
      ? { authenticated: true, userId: session.user_id, csrfToken: session.csrf_token }
      : { authenticated: false },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
