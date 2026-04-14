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
const backupPath = path.join(repoRoot, 'scripts/migration/article-export.test-backup.json');

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

test('migration decodes HTML entities in portable text output', () => {
  const documents = runMigration();
  const mvp3 = documents.find((document) => document.slug?.current === 'delivered-mvp-3');

  assert.ok(mvp3, 'expected MVP3 document in dry run output');

  const bodyText = readAllBodyText(mvp3);
  assert.ok(bodyText.includes('"ship it to the internet"'));
  assert.ok(bodyText.includes('www -> apex permanent redirect'));
  assert.equal(bodyText.includes('&quot;'), false);
  assert.equal(bodyText.includes('&gt;'), false);
});

test('migration omits legacy tags from Sanity article documents', async () => {
  const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  assert.ok(input.every((entry) => Array.isArray(entry.tags)), 'expected legacy tags preserved in export JSON');

  const documents = runMigration();
  assert.ok(documents.every((document) => !Object.hasOwn(document, 'tags')));
});

test('migration keeps blockquote blocks as blockquote style', async () => {
  const originalInput = await fs.readFile(inputPath, 'utf8');

  try {
    await fs.writeFile(backupPath, originalInput);
    await fs.writeFile(
      inputPath,
      JSON.stringify([
        {
          title: 'Quoted post',
          slug: 'quoted-post',
          summary: 'summary',
          publishedAt: '2026-03-10T00:00:00.000Z',
          status: 'draft',
          tags: ['legacy'],
          bodyMarkdown: '> Quoted line'
        }
      ], null, 2) + '\n'
    );

    const [document] = runMigration();
    assert.equal(document.body[0].style, 'blockquote');
    assert.equal(document.body[0].children[0].text, 'Quoted line');
  } finally {
    await fs.writeFile(inputPath, originalInput);
    await fs.rm(backupPath, { force: true });
    runMigration();
    const restoredOutput = await fs.readFile(outputPath, 'utf8');
    assert.ok(restoredOutput.includes('Delivered MVP 2!'));
  }
});
