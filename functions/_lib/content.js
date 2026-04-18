export function sanitizePostBody(markdown) {
  return markdown.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export function normalizePostInput(input) {
  return {
    slug: String(input.slug || "").trim(),
    title: String(input.title || "").trim(),
    summary: String(input.summary || "").trim(),
    bodyMarkdown: String(input.bodyMarkdown || ""),
    status: String(input.status || "draft"),
  };
}
