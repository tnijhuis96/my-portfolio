import { json } from "../../../_lib/json.js";
import { runOne } from "../../../_lib/db.js";
import { normalizePostInput, renderPostHtml } from "../../../_lib/content.js";

export async function onRequestGet(context) {
  const post = await runOne(
    context.env,
    "SELECT * FROM cms_posts WHERE id = ? AND deleted_at IS NULL",
    context.params.id,
  );
  return post
    ? json({ post })
    : json({ ok: false, error: "not_found" }, { status: 404 });
}

export async function onRequestPut(context) {
  const body = normalizePostInput(await context.request.json());
  const now = new Date().toISOString();
  const sanitizedHtml = renderPostHtml(body.bodyMarkdown);

  const result = await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET slug = ?, title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(
      body.slug,
      body.title,
      body.summary,
      body.bodyMarkdown,
      sanitizedHtml,
      body.status,
      now,
      context.params.id,
    )
    .run();

  if (result.meta.changes === 0) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const now = new Date().toISOString();
  const result = await context.env.CMS_DB.prepare(
    "UPDATE cms_posts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(now, now, context.params.id)
    .run();

  if (result.meta.changes === 0) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return json({ ok: true, deleted: true });
}
