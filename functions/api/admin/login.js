import { json } from "../../_lib/json.js";
import { assertRateLimitAllowed } from "../../_lib/rate-limit.js";
import { writeAuditEvent } from "../../_lib/audit.js";
import {
  createSession,
  createSessionCookie,
  verifyPassword,
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const body = await context.request.json();

  await writeAuditEvent(context.env, {
    action: "login_attempt",
    target_type: "admin_session",
    target_id: null,
    metadata: { stage: "attempted" },
  });

  const blocked = await assertRateLimitAllowed(context.env, "login", "single-admin");
  if (blocked) {
    return blocked;
  }

  const accessEmail = context.request.headers.get("cf-access-authenticated-user-email");
  const passwordOk = await verifyPassword(context.env.CMS_PASSWORD_HASH, body.password);

  if (!passwordOk || !accessEmail) {
    return json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const session = await createSession(context.env, accessEmail);

  return json(
    { ok: true, authenticated: true },
    {
      headers: {
        "set-cookie": createSessionCookie(session.id, new Date(session.expiresAt)),
      },
    },
  );
}
