import crypto from "node:crypto";
import { marked } from "marked";
import { normalizePostRecord } from "./db.js";

const SAFE_LINK_SCHEMES = new Set(["http", "https", "mailto"]);
const NAMED_HTML_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["tab", "\t"],
  ["newline", "\n"],
  ["colon", ":"],
]);

function escapeHtml(value) {
  return String(value ?? "")
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

function decodeHtmlEntities(value) {
  return String(value ?? "").replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (entity, token) => {
    if (token[0] === "#") {
      const isHex = token[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return NAMED_HTML_ENTITIES.get(token.toLowerCase()) ?? entity;
  });
}

function sanitizeLinkHref(href) {
  const value = String(href ?? "").trim();
  if (!value) {
    return null;
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/[\u0000-\u001F\u007F\s]+/g, "")
    .toLowerCase();

  if (
    normalized.startsWith("#")
    || normalized.startsWith("?")
    || normalized.startsWith("./")
    || normalized.startsWith("../")
    || (normalized.startsWith("/") && !normalized.startsWith("//"))
  ) {
    return value;
  }

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  if (schemeMatch) {
    return SAFE_LINK_SCHEMES.has(schemeMatch[1]) ? value : null;
  }

  if (normalized.startsWith("//")) {
    return null;
  }

  return value;
}

export function isDuplicateSlugConstraint(error) {
  return /unique constraint failed:\s*cms_posts\.slug/i.test(String(error?.message ?? error ?? ""));
}

class PostValidationError extends Error {
  constructor(fields) {
    super("required_field");
    this.name = "PostValidationError";
    this.code = "required_field";
    this.status = 422;
    this.fields = fields;
  }
}

export function isPostValidationError(error) {
  return error?.code === "required_field" && error?.status === 422;
}

export function renderPostHtml(markdown) {
  const renderer = new marked.Renderer();
  const baseRenderer = new marked.Renderer();
  renderer.link = (href, title, text) => {
    const safeHref = sanitizeLinkHref(href);
    if (!safeHref) {
      return text;
    }

    return baseRenderer.link.call(renderer, safeHref, title, text);
  };
  renderer.html = (html) => escapeHtml(typeof html === "string" ? html : html.text);

  return marked.parse(String(markdown ?? ""), { renderer });
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

export function validatePostInput(input) {
  const fields = [];
  if (!input.slug) {
    fields.push("slug");
  }
  if (!input.title) {
    fields.push("title");
  }

  if (fields.length > 0) {
    throw new PostValidationError(fields);
  }

  return input;
}

export async function createPost(env, input) {
  const post = validatePostInput(normalizePostInput(input));
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sanitizedHtml = renderPostHtml(post.bodyMarkdown);
  const record = {
    id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    body_markdown: post.bodyMarkdown,
    sanitized_html: sanitizedHtml,
    status: post.status,
    published_at: null,
    deleted_at: null,
    updated_at: now,
  };

  await env.CMS_DB.prepare(
    "INSERT INTO cms_posts (id, slug, title, summary, body_markdown, sanitized_html, status, published_at, deleted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      record.id,
      record.slug,
      record.title,
      record.summary,
      record.body_markdown,
      record.sanitized_html,
      record.status,
      record.published_at,
      record.deleted_at,
      record.updated_at,
    )
    .run();

  try {
    await writePostRevision(env, record, now);
  } catch {}

  return normalizePostRecord(record);
}

export async function writePostRevision(env, post, createdAt = new Date().toISOString()) {
  const record = {
    id: crypto.randomUUID(),
    post_id: post.id,
    title: post.title,
    summary: post.summary,
    body_markdown: post.body_markdown ?? post.bodyMarkdown ?? "",
    sanitized_html: post.sanitized_html ?? renderPostHtml(post.body_markdown ?? post.bodyMarkdown ?? ""),
    status: post.status,
    created_at: createdAt,
  };

  await env.CMS_DB.prepare(
    "INSERT INTO cms_post_revisions (id, post_id, title, summary, body_markdown, sanitized_html, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      record.id,
      record.post_id,
      record.title,
      record.summary,
      record.body_markdown,
      record.sanitized_html,
      record.status,
      record.created_at,
    )
    .run();

  return record;
}
