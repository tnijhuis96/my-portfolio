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

function normalizeSpanText(text = "") {
  return decodeHtmlEntities(text).replace(/\s+\n/g, "\n");
}

function appendSpan(nextKey, children, text, marks = []) {
  const normalizedText = normalizeSpanText(text);

  if (!normalizedText) {
    return;
  }

  const normalizedMarks = [...new Set(marks)];
  const previousChild = children.at(-1);

  if (
    previousChild &&
    previousChild._type === "span" &&
    JSON.stringify(previousChild.marks) === JSON.stringify(normalizedMarks)
  ) {
    previousChild.text += normalizedText;
    return;
  }

  children.push({
    _type: "span",
    _key: nextKey("span"),
    marks: normalizedMarks,
    text: normalizedText
  });
}

function trimChildren(children = []) {
  const normalizedChildren = children
    .map((child) => ({ ...child }))
    .filter((child) => typeof child.text === "string" && child.text.length > 0);

  if (normalizedChildren.length === 0) {
    return [];
  }

  if (!normalizedChildren[0].marks?.includes("code")) {
    normalizedChildren[0].text = normalizedChildren[0].text.replace(/^\s+/, "");
  }

  const lastChild = normalizedChildren[normalizedChildren.length - 1];
  if (!lastChild.marks?.includes("code")) {
    lastChild.text = lastChild.text.replace(/\s+$/, "");
  }

  return normalizedChildren.filter((child) => child.text.length > 0);
}

function tokensToChildren(nextKey, tokens = [], activeMarks = []) {
  const children = [];

  for (const token of tokens) {
    if (token.type === "br") {
      appendSpan(nextKey, children, "\n", activeMarks);
      continue;
    }

    if (token.type === "codespan") {
      appendSpan(nextKey, children, token.text ?? "", [...activeMarks, "code"]);
      continue;
    }

    if (token.type === "strong") {
      children.push(...tokensToChildren(nextKey, token.tokens ?? [], [...activeMarks, "strong"]));
      continue;
    }

    if (token.type === "em") {
      children.push(...tokensToChildren(nextKey, token.tokens ?? [], [...activeMarks, "em"]));
      continue;
    }

    if (token.type === "del") {
      children.push(...tokensToChildren(nextKey, token.tokens ?? [], [...activeMarks, "strike-through"]));
      continue;
    }

    if (Array.isArray(token.tokens) && token.tokens.length > 0) {
      children.push(...tokensToChildren(nextKey, token.tokens, activeMarks));
      continue;
    }

    appendSpan(nextKey, children, token.text ?? "", activeMarks);
  }

  return children;
}

function createBlock(nextKey, content, overrides = {}) {
  const children = trimChildren(
    Array.isArray(content)
      ? content
      : [
          {
            _type: "span",
            _key: nextKey("span"),
            marks: [],
            text: normalizeSpanText(content)
          }
        ]
  );

  if (children.length === 0) {
    return null;
  }

  return {
    _type: "block",
    _key: nextKey("block"),
    style: "normal",
    markDefs: [],
    children,
    ...overrides
  };
}

function readListItemChildren(nextKey, item) {
  if (!Array.isArray(item.tokens) || item.tokens.length === 0) {
    return tokensToChildren(nextKey, [{ text: item.text ?? "" }]);
  }

  return trimChildren(
    item.tokens
    .map((token) => {
      if (token.type === "text" && Array.isArray(token.tokens)) {
        return tokensToChildren(nextKey, token.tokens);
      }

      if (Array.isArray(token.tokens) && token.tokens.length > 0) {
        return tokensToChildren(nextKey, token.tokens);
      }

      return tokensToChildren(nextKey, [{ text: token.text ?? "" }]);
    })
    .flatMap((segment, index) => {
      if (index === 0) {
        return segment;
      }

      return [
        {
          _type: "span",
          _key: nextKey("span"),
          marks: [],
          text: "\n"
        },
        ...segment
      ];
    })
  );
}

function markdownToPortableText(markdown = "") {
  const nextKey = createKeyFactory();
  const blocks = [];

  for (const token of marked.lexer(markdown)) {
    switch (token.type) {
      case "space":
        break;
      case "heading": {
        const block = createBlock(nextKey, tokensToChildren(nextKey, token.tokens), {
          style: token.depth >= 1 && token.depth <= 4 ? "h" + token.depth : "normal"
        });
        if (block) {
          blocks.push(block);
        }
        break;
      }
      case "paragraph": {
        const block = createBlock(nextKey, tokensToChildren(nextKey, token.tokens));
        if (block) {
          blocks.push(block);
        }
        break;
      }
      case "list":
        for (const item of token.items) {
          const block = createBlock(nextKey, readListItemChildren(nextKey, item), {
            listItem: token.ordered ? "number" : "bullet",
            level: 1
          });
          if (block) {
            blocks.push(block);
          }
        }
        break;
      case "blockquote": {
        const blockquoteChildren = (token.tokens ?? [])
          .map((child) => {
            if (child.type === "paragraph") {
              return tokensToChildren(nextKey, child.tokens);
            }

            if (Array.isArray(child.tokens) && child.tokens.length > 0) {
              return tokensToChildren(nextKey, child.tokens);
            }

            return tokensToChildren(nextKey, [{ text: child.text ?? "" }]);
          })
          .flatMap((segment, index) => {
            if (index === 0) {
              return segment;
            }

            return [
              {
                _type: "span",
                _key: nextKey("span"),
                marks: [],
                text: "\n\n"
              },
              ...segment
            ];
          });
        const block = createBlock(nextKey, blockquoteChildren, { style: "blockquote" });
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
