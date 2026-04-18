import { requireSession } from "../../../../_lib/auth.js";
import { json } from "../../../../_lib/json.js";
import { renderPostHtml, writePostRevision } from "../../../../_lib/content.js";
import { runOne } from "../../../../_lib/db.js";

export async function onRequestPost(context) {
  const auth = await requireSession(context, { csrf: true });
  if (!auth.ok) {
    return auth.response;
  }

  const revision = await runOne(
    context.env,
    "SELECT * FROM cms_post_revisions WHERE id = ?",
    context.params.id,
  );

  if (!revision) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  const publishedAt = revision.status === "published" ? updatedAt : null;
  const result = await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(
      revision.title,
      revision.summary,
      revision.body_markdown,
      renderPostHtml(revision.body_markdown),
      revision.status,
      publishedAt,
      updatedAt,
      revision.post_id,
    )
    .run();

  if ((result?.meta?.changes ?? 0) < 1) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  try {
    await writePostRevision(context.env, {
      id: revision.post_id,
      title: revision.title,
      summary: revision.summary,
      body_markdown: revision.body_markdown,
      sanitized_html: renderPostHtml(revision.body_markdown),
      status: revision.status,
      published_at: publishedAt,
      updated_at: updatedAt,
    }, updatedAt);
  } catch {}

  return json({ ok: true, restored: true });
}
