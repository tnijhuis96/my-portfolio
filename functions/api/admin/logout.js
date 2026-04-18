import { json } from "../../_lib/json.js";
import { writeAuditEvent } from "../../_lib/audit.js";
import { clearSessionCookie, readSessionCookie } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const sessionId = readSessionCookie(context.request);
  if (sessionId) {
    const session = await context.env.CMS_DB.prepare(
      "SELECT id, user_id, csrf_token, expires_at FROM cms_sessions WHERE id = ?",
    ).bind(sessionId).first();

    await context.env.CMS_DB.prepare("DELETE FROM cms_sessions WHERE id = ?").bind(sessionId).run();

    try {
      await writeAuditEvent(context.env, {
        action: "logout",
        actor_user_id: session?.user_id ?? null,
        target_type: "admin_session",
        target_id: sessionId,
        metadata: { sessionId },
      });
    } catch {
      // Always clear the session cookie even when audit logging fails.
    }
  }

  return json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": clearSessionCookie(),
    },
  });
}
