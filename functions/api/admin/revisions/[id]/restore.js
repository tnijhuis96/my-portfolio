import { requireSession } from "../../../../_lib/auth.js";
import { json } from "../../../../_lib/json.js";
import {
  captureRevisionSnapshot,
  getLegacyRevisionSlugWarning,
  isDuplicateSlugConstraint,
  revisionSlugIsCaptured,
  renderPostHtml,
  withRevisionWarnings,
} from "../../../../_lib/content.js";
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

  const post = await runOne(
    context.env,
    "SELECT * FROM cms_posts WHERE id = ? AND deleted_at IS NULL",
    revision.post_id,
  );
  if (!post) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  const legacySlugWarning = revisionSlugIsCaptured(revision)
    ? null
    : getLegacyRevisionSlugWarning(revision, post.slug);
  const restoredSlug = revisionSlugIsCaptured(revision) && revision.slug
    ? revision.slug
    : post.slug;
  const publishedAt = revision.status === "published" ? updatedAt : null;
  let result;
  try {
    result = await context.env.CMS_DB.prepare(
      "UPDATE cms_posts SET slug = ?, title = ?, summary = ?, body_markdown = ?, sanitized_html = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    )
      .bind(
        restoredSlug,
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
  } catch (error) {
    if (isDuplicateSlugConstraint(error)) {
      return json({ ok: false, error: "duplicate_slug" }, { status: 409 });
    }

    throw error;
  }

  if ((result?.meta?.changes ?? 0) < 1) {
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const revisionWarning = await captureRevisionSnapshot(context.env, {
    id: revision.post_id,
    slug: restoredSlug,
    title: revision.title,
    summary: revision.summary,
    body_markdown: revision.body_markdown,
    sanitized_html: renderPostHtml(revision.body_markdown),
    status: revision.status,
    published_at: publishedAt,
    updated_at: updatedAt,
  }, updatedAt, { operation: "restore" });

  return json(withRevisionWarnings(
    { ok: true, restored: true },
    [legacySlugWarning, revisionWarning],
  ));
}
