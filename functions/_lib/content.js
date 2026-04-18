function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTrimmedString(value, fallback = "") {
  const normalized = String(value ?? fallback).trim();
  if (normalized) {
    return normalized;
  }

  return String(fallback).trim();
}

export function sanitizePostBody(markdown) {
  return escapeHtml(String(markdown ?? ""));
}

export function normalizePostInput(input = {}) {
  return {
    slug: normalizeTrimmedString(input.slug),
    title: normalizeTrimmedString(input.title),
    summary: normalizeTrimmedString(input.summary),
    bodyMarkdown: String(input.bodyMarkdown ?? ""),
    status: normalizeTrimmedString(input.status, "draft"),
  };
}
