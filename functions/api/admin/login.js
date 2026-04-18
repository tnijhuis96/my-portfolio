import { json } from "../../_lib/json.js";
import { assertRateLimitAllowed } from "../../_lib/rate-limit.js";
import { writeAuditEvent } from "../../_lib/audit.js";

export async function onRequestPost(context) {
  await assertRateLimitAllowed(context.env, "login", "single-admin");
  await writeAuditEvent(context.env, {
    action: "login_attempt",
    target_type: "admin_session",
    target_id: null,
    metadata: { ok: true },
  });

  return json({ ok: true, stage: "replace-with-real-login" });
}
