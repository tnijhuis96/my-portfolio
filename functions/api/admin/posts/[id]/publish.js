import { json } from "../../../../_lib/json.js";
import { writeAuditEvent } from "../../../../_lib/audit.js";
import { runOne } from "../../../../_lib/db.js";
import { triggerDeploy } from "../../../../_lib/deploy.js";

export async function onRequestPost(context, runtime = globalThis) {
  const accessEmail = context.request?.headers.get("cf-access-authenticated-user-email");
  const writePostDecisionAudit = async (metadata) => {
    try {
      await writeAuditEvent(context.env, {
        action: "publish",
        actor_user_id: accessEmail,
        target_type: "post",
        target_id: context.params.id,
        metadata,
      });
    } catch {
      // Once the deploy outcome is known, audit writes stay fail-open.
    }
  };
  const post = await runOne(
    context.env,
    "SELECT * FROM cms_posts WHERE id = ? AND deleted_at IS NULL",
    context.params.id,
  );
  if (!post) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  // Re-publishing an already-published post is intentional so editors can force a redeploy after edits.
  const publishResult = await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind("published", now, now, context.params.id)
    .run();

  if (publishResult.meta.changes === 0) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const deploy = await triggerDeploy(context.env, runtime);

  if (!deploy.ok) {
    let rollbackFailed = false;
    let rollbackErrorMessage = null;

    try {
      const rollbackResult = await context.env.CMS_DB.prepare(
        "UPDATE cms_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
      )
        .bind(post.status, post.published_at, post.updated_at, context.params.id)
        .run();

      if (rollbackResult.meta.changes === 0) {
        rollbackFailed = true;
        rollbackErrorMessage = "rollback update affected 0 rows";
      }
    } catch (error) {
      rollbackFailed = true;
      rollbackErrorMessage = error instanceof Error ? error.message : String(error);
    }

    await writePostDecisionAudit({
      outcome: "deploy_failed",
      deployStatus: deploy.status,
      ...(rollbackFailed
        ? {
            rollbackStatus: "failed",
            rollbackError: rollbackErrorMessage,
          }
        : {}),
    });

    return json(
      {
        ok: false,
        publishState: "deploy_failed",
        ...(rollbackFailed ? { rollbackState: "failed" } : {}),
      },
      { status: 502 },
    );
  }

  await writePostDecisionAudit({
    outcome: "deploy_triggered",
    deployStatus: deploy.status,
  });

  return json(
    {
      ok: true,
      publishState: "pending_deploy",
    },
    { status: 200 },
  );
}
