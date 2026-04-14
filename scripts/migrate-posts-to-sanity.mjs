import fs from "node:fs/promises";
import { marked } from "marked";

const inputPath = new URL("./migration/article-export.json", import.meta.url);
const outputPath = new URL("./migration/article-import-dry-run.json", import.meta.url);
const input = JSON.parse(await fs.readFile(inputPath, "utf8"));

if (!Array.isArray(input)) {
  throw new Error("Migration input must be a JSON array.");
}

function createKeyFactory() {
  let counter = 0;
  return function nextKey(prefix) {
    return prefix + String(counter++).padStart(4, "0");
  };
}

const namedHtmlEntities = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"'
};

function decodeHtmlEntities(text = "") {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return namedHtmlEntities[entity.toLowerCase()] ?? match;
  });
}

function readInlineText(tokens = []) {
  return tokens
    .map((token) => {
      if (token.type === "br") {
        return "\n";
      }

      if (Array.isArray(token.tokens) && token.tokens.length > 0) {
        return readInlineText(token.tokens);
      }

      return token.text ?? "";
    })
    .join("");
}

function createBlock(nextKey, text, overrides = {}) {
  const normalizedText = decodeHtmlEntities(text).replace(/\s+\n/g, "\n").trim();

  if (!normalizedText) {
    return null;
  }

  return {
    _type: "block",
    _key: nextKey("block"),
    style: "normal",
    markDefs: [],
    children: [
      {
        _type: "span",
        _key: nextKey("span"),
        marks: [],
        text: normalizedText
      }
    ],
    ...overrides
  };
}

function readListItemText(item) {
  if (!Array.isArray(item.tokens) || item.tokens.length === 0) {
    return item.text ?? "";
  }

  return item.tokens
    .map((token) => {
      if (token.type === "text" && Array.isArray(token.tokens)) {
        return readInlineText(token.tokens);
      }

      if (Array.isArray(token.tokens) && token.tokens.length > 0) {
        return readInlineText(token.tokens);
      }

      return token.text ?? "";
    })
    .join("\n");
}

function markdownToPortableText(markdown = "") {
  const nextKey = createKeyFactory();
  const blocks = [];

  for (const token of marked.lexer(markdown)) {
    switch (token.type) {
      case "space":
        break;
      case "heading": {
        const block = createBlock(nextKey, readInlineText(token.tokens), {
          style: token.depth >= 1 && token.depth <= 4 ? "h" + token.depth : "normal"
        });
        if (block) {
          blocks.push(block);
        }
        break;
      }
      case "paragraph": {
        const block = createBlock(nextKey, readInlineText(token.tokens));
        if (block) {
          blocks.push(block);
        }
        break;
      }
      case "list":
        for (const item of token.items) {
          const block = createBlock(nextKey, readListItemText(item), {
            listItem: token.ordered ? "number" : "bullet",
            level: 1
          });
          if (block) {
            blocks.push(block);
          }
        }
        break;
      case "blockquote": {
        const blockquoteText = (token.tokens ?? [])
          .map((child) => {
            if (child.type === "paragraph") {
              return readInlineText(child.tokens);
            }

            if (Array.isArray(child.tokens) && child.tokens.length > 0) {
              return readInlineText(child.tokens);
            }

            return child.text ?? "";
          })
          .join("\n\n");
        const block = createBlock(nextKey, blockquoteText, { style: "blockquote" });
        if (block) {
          blocks.push(block);
        }
        break;
      }
      case "code": {
        const block = createBlock(nextKey, token.text);
        if (block) {
          blocks.push(block);
        }
        break;
      }
      default:
        if (typeof token.text === "string") {
          const block = createBlock(nextKey, token.text);
          if (block) {
            blocks.push(block);
          }
        }
    }
  }

  return blocks;
}

const seenSlugs = new Set();

const documents = input.map((entry) => {
  if (
    !entry.title ||
    !entry.slug ||
    !entry.summary ||
    !entry.publishedAt ||
    !entry.status ||
    !Array.isArray(entry.tags) ||
    typeof entry.bodyMarkdown !== "string"
  ) {
    throw new Error("Each migration entry must include title, slug, summary, publishedAt, status, tags, and bodyMarkdown.");
  }

  if (seenSlugs.has(entry.slug)) {
    throw new Error('Duplicate slug in migration input: "' + entry.slug + '".');
  }

  seenSlugs.add(entry.slug);

  return {
    _id: "article." + entry.slug,
    _type: "article",
    title: entry.title,
    slug: { _type: "slug", current: entry.slug },
    summary: entry.summary,
    publishedAt: entry.publishedAt,
    status: entry.status,
    // Legacy tags stay in the export JSON for future mapping, but the current article schema has no tags field.
    body: markdownToPortableText(entry.bodyMarkdown)
  };
});

const output = JSON.stringify(documents, null, 2);
await fs.writeFile(outputPath, output + "\n");
console.log(output);
