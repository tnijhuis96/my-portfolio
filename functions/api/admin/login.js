import { json } from "../../_lib/json.js";
import { assertRateLimitAllowed } from "../../_lib/rate-limit.js";
import { writeAuditEvent } from "../../_lib/audit.js";

export async function onRequestPost(context) {
  await writeAuditEvent(context.env, {
    action: "login_attempt",
    target_type: "admin_session",
    target_id: null,
    metadata: { stage: "attempted" },
  });

  const rateLimitResponse = await assertRateLimitAllowed(context.env, "login", "single-admin");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return json({ ok: true, stage: "replace-with-real-login" });
}
