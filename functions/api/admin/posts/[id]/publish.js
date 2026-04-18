import { json } from "../../../../_lib/json.js";
import { writeAuditEvent } from "../../../../_lib/audit.js";
import { triggerDeploy } from "../../../../_lib/deploy.js";

export async function onRequestPost(context) {
  const now = new Date().toISOString();
  await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind("published", now, now, context.params.id)
    .run();

  await writeAuditEvent(context.env, {
    action: "publish",
    target_type: "post",
    target_id: context.params.id,
    metadata: { stage: "attempted" },
  });

  const deploy = await triggerDeploy(context.env);

  return json(
    {
      ok: deploy.ok,
      publishState: deploy.ok ? "pending_deploy" : "deploy_failed",
    },
    { status: deploy.ok ? 200 : 502 },
  );
}
