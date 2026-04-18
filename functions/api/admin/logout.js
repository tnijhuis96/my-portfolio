import { json } from "../../_lib/json.js";
import { writeAuditEvent } from "../../_lib/audit.js";

export async function onRequestPost(context) {
  await writeAuditEvent(context.env, {
    action: "logout",
    target_type: "admin_session",
    target_id: null,
    metadata: { ok: true },
  });

  return json({ ok: true });
}
