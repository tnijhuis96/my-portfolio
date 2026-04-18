import { json } from "../../../../_lib/json.js";
import { renderPostHtml } from "../../../../_lib/content.js";
import { runOne } from "../../../../_lib/db.js";

export async function onRequestPost(context) {
  const revision = await runOne(
    context.env,
    "SELECT * FROM cms_post_revisions WHERE id = ?",
    context.params.id,
  );

  if (!revision) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ?",
  )
    .bind(
      revision.title,
      revision.summary,
      revision.body_markdown,
      renderPostHtml(revision.body_markdown),
      revision.status,
      new Date().toISOString(),
      revision.post_id,
    )
    .run();

  return json({ ok: true, restored: true });
}
