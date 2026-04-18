import { json } from "../../_lib/json.js";
import { clearSessionCookie, readSessionCookie } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const sessionId = readSessionCookie(context.request);
  if (sessionId) {
    await context.env.CMS_DB.prepare("DELETE FROM cms_sessions WHERE id = ?").bind(sessionId).run();
  }

  return json({ ok: true }, {
    headers: {
      "cache-control": "no-store",
      "set-cookie": clearSessionCookie(),
    },
  });
}
