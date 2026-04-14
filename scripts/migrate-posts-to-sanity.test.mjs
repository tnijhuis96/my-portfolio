import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'scripts/migration/article-export.json');
const outputPath = path.join(repoRoot, 'scripts/migration/article-import-dry-run.json');

function runMigration() {
  const stdout = execFileSync('node', ['scripts/migrate-posts-to-sanity.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  return JSON.parse(stdout);
}

function readAllBodyText(document) {
  return document.body
    .flatMap((block) => block.children ?? [])
    .map((child) => child.text ?? '')
    .join('\n');
}

async function withTemporaryInput(entries, callback) {
  const originalInput = await fs.readFile(inputPath, 'utf8');

  try {
    await fs.writeFile(inputPath, JSON.stringify(entries, null, 2) + '\n');
    return await callback();
  } finally {
    await fs.writeFile(inputPath, originalInput);
    runMigration();
    const restoredOutput = await fs.readFile(outputPath, 'utf8');
    assert.ok(restoredOutput.includes('Delivered MVP 2!'));
  }
}

test('migration decodes HTML entities in portable text output', async () => {
  await withTemporaryInput([
    {
      title: 'Entity test',
      slug: 'entity-test',
      summary: 'summary',
      publishedAt: '2026-03-10T00:00:00.000Z',
      status: 'draft',
      tags: ['legacy'],
      bodyMarkdown: 'Encoded &quot;text&quot; &gt; &#62; &#x3E;'
    }
  ], async () => {
    const [document] = runMigration();
    const bodyText = readAllBodyText(document);

    assert.ok(bodyText.includes('Encoded "text" > > >'));
    assert.equal(bodyText.includes('&quot;'), false);
    assert.equal(bodyText.includes('&gt;'), false);
    assert.equal(bodyText.includes('&#62;'), false);
    assert.equal(bodyText.includes('&#x3E;'), false);
  });
});

test('migration preserves inline code spans in portable text output', () => {
  const documents = runMigration();
  const mvp3 = documents.find((document) => document.slug?.current === 'delivered-mvp-3');

  assert.ok(mvp3, 'expected MVP3 document in dry run output');

  const codeSpans = mvp3.body
    .flatMap((block) => block.children ?? [])
    .filter((child) => Array.isArray(child.marks) && child.marks.includes('code'))
    .map((child) => child.text);

  assert.deepEqual(codeSpans, ['master', 'adminServer.js', 'master', 'www', 'www', 'www -> apex']);
});

test('migration preserves boundary whitespace inside inline code spans', async () => {
  await withTemporaryInput([
    {
      title: 'Code whitespace',
      slug: 'code-whitespace',
      summary: 'summary',
      publishedAt: '2026-03-10T00:00:00.000Z',
      status: 'draft',
      tags: ['legacy'],
      bodyMarkdown: '`  code  `'
    }
  ], async () => {
    const [document] = runMigration();
    assert.equal(document.body[0].children[0].text, ' code ');
    assert.deepEqual(document.body[0].children[0].marks, ['code']);
  });
});

test('migration omits legacy tags from Sanity article documents', async () => {
  const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  assert.ok(input.every((entry) => Array.isArray(entry.tags)), 'expected legacy tags preserved in export JSON');

  const documents = runMigration();
  assert.ok(documents.every((document) => !Object.hasOwn(document, 'tags')));
});

test('migration keeps blockquote blocks as blockquote style', async () => {
  await withTemporaryInput([
    {
      title: 'Quoted post',
      slug: 'quoted-post',
      summary: 'summary',
      publishedAt: '2026-03-10T00:00:00.000Z',
      status: 'draft',
      tags: ['legacy'],
      bodyMarkdown: '> Quoted line'
    }
  ], async () => {
    const [document] = runMigration();
    assert.equal(document.body[0].style, 'blockquote');
    assert.equal(document.body[0].children[0].text, 'Quoted line');
  });
});
