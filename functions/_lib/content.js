import crypto from "node:crypto";
import { marked } from "marked";
import { normalizePostRecord } from "./db.js";

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

function sanitizeLinkHref(href) {
  const value = String(href ?? "").trim();
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
  if (/^(javascript|data|vbscript):/.test(normalized)) {
    return null;
  }

  return value;
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

export async function createPost(env, input) {
  const post = normalizePostInput(input);
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

  return normalizePostRecord(record);
}
