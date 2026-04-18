import { requireSession } from "../../../_lib/auth.js";
import { json } from "../../../_lib/json.js";
import { runAll, runOne } from "../../../_lib/db.js";
import {
  captureRevisionSnapshot,
  isDuplicateSlugConstraint,
  isPostValidationError,
  normalizePostInput,
  renderPostHtml,
  validatePostInput,
  withRevisionWarning,
} from "../../../_lib/content.js";

export async function onRequestGet(context) {
  const auth = await requireSession(context);
  if (!auth.ok) {
    return auth.response;
  }

  const post = await runOne(
    context.env,
    "SELECT * FROM cms_posts WHERE id = ? AND deleted_at IS NULL",
    context.params.id,
  );
  if (!post) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const revisions = await runAll(
    context.env,
    "SELECT id, status, created_at, title, summary, slug_source FROM cms_post_revisions WHERE post_id = ? ORDER BY created_at DESC",
    context.params.id,
  );

  return json({
    post: {
      ...post,
      revisions,
    },
  });
}

export async function onRequestPut(context) {
  const auth = await requireSession(context, { csrf: true });
  if (!auth.ok) {
    return auth.response;
  }

  let requestBody;
  try {
    requestBody = await context.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const body = normalizePostInput(requestBody);
  try {
    validatePostInput(body);
  } catch (error) {
    if (isPostValidationError(error)) {
      return json({ ok: false, error: error.code, fields: error.fields }, { status: error.status });
    }

    throw error;
  }

  const now = new Date().toISOString();
  const sanitizedHtml = renderPostHtml(body.bodyMarkdown);

  let result;
  try {
    result = await context.env.CMS_DB.prepare(
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
  } catch (error) {
    if (isDuplicateSlugConstraint(error)) {
      return json({ ok: false, error: "duplicate_slug" }, { status: 409 });
    }

    throw error;
  }

  if (result.meta.changes === 0) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const revisionWarning = await captureRevisionSnapshot(context.env, {
    id: context.params.id,
    slug: body.slug,
    title: body.title,
    summary: body.summary,
    body_markdown: body.bodyMarkdown,
    sanitized_html: sanitizedHtml,
    status: body.status,
  }, now, { operation: "update" });

  return json(withRevisionWarning({ ok: true }, revisionWarning));
}

export async function onRequestDelete(context) {
  const auth = await requireSession(context, { csrf: true });
  if (!auth.ok) {
    return auth.response;
  }

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
