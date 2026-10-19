import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(project, process.env.CONTENT_REPO || '../hangar/HowToLiveBetter');
let temporary, catalog, originalChapters, originalEntries, originalEvidence;
const read = path => readFileSync(path, 'utf8');
const generated = slug => read(resolve(temporary, 'src/content/docs', `${slug}.md`));
const visibleNumbers = markdown => markdown
  .replace(/\[([^\]]*)\]\([^\n]*?\)/g, '$1')
  .replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>\n]*>|<https?:[^>\n]*>/g, '')
  .match(/\d+(?:[.,–-]\d+)*%?/g) || [];

before(() => {
  originalChapters = readdirSync(resolve(source, 'book')).filter(file => /^\d\d-.+\.md$/.test(file));
  const chapters = originalChapters.map(file => read(resolve(source, 'book', file)));
  originalEntries = chapters.flatMap(markdown => [...markdown.matchAll(/^###\s+\d+\.\s+/gm)]).length;
  originalEvidence = Object.fromEntries(['A', 'B', 'C'].map(grade => [grade,
    chapters.flatMap(markdown => [...markdown.matchAll(new RegExp(`^- 证据等级：${grade}`, 'gm'))]).length,
  ]));
  temporary = mkdtempSync(resolve(tmpdir(), 'livebetter-import-test-'));
  mkdirSync(resolve(temporary, 'scripts'));
  cpSync(resolve(project, 'scripts/import-content.mjs'), resolve(temporary, 'scripts/import-content.mjs'));
  execFileSync(process.execPath, [resolve(temporary, 'scripts/import-content.mjs')], {
    env: { ...process.env, CONTENT_REPO: source, SITE_BASE: '/preview/' }, encoding: 'utf8',
  });
  catalog = JSON.parse(read(resolve(temporary, 'src/data/catalog.json')));
});
after(() => rmSync(temporary, { recursive: true, force: true }));

test('imports all chapters and entries with unique durable targets under a deployment base', () => {
  assert.equal(catalog.sections.length, originalChapters.length);
  assert.equal(catalog.entries.length, originalEntries);
  assert.equal(new Set(catalog.entries.map(entry => entry.id)).size, originalEntries);
  assert.deepEqual(catalog.stats.evidence, originalEvidence);
  assert.equal(catalog.groups.flatMap(group => group.sections).length, originalChapters.length);
  assert.equal(new Set(catalog.groups.flatMap(group => group.sections)).size, originalChapters.length);
  for (const entry of catalog.entries) {
    const section = catalog.sections.find(section => section.number === entry.section);
    assert.equal(entry.href, `/preview/${section.slug}/#entry-${entry.number}`);
    assert.ok(generated(section.slug).includes(`id="entry-${entry.number}"`), entry.href);
  }
});

test('retains every numeric statement in all original chapters in its original order', () => {
  for (const section of catalog.sections) {
    const original = read(resolve(source, section.sourcePath))
      .replace(/^\[← 回总目录\]\([^)]*\)\s*\n/, '').replace(/^#\s+.+\n/, '').trim();
    const imported = generated(section.slug).replace(/^---\n[\s\S]*?\n---\n/, '')
      .split('<div class="source-note"')[0];
    assert.deepEqual(visibleNumbers(imported), visibleNumbers(original), section.sourcePath);
  }
});

test('preserves source attribution and converts Markdown links and Chinese cross references', () => {
  const chapter = generated('guide/01');
  assert.match(chapter, /\[第 17 节第 9 条\]\(\/preview\/guide\/17\/#entry-9\)/);
  assert.match(chapter, /\[本节第 39 条\]\(\/preview\/guide\/01\/#entry-39\)/);
  assert.match(chapter, /\[docs\/家庭应急装备清单\.md\]\(\/preview\/topics\/emergency-kit\/\)/);
  for (const section of [...catalog.sections, ...catalog.articles]) {
    const content = generated(section.slug);
    assert.ok(content.includes(`github.com/eternity4719/HowToLiveBetter/blob/${catalog.source.commit}/${section.sourcePath}`));
    assert.ok(content.includes('https://creativecommons.org/licenses/by/4.0/'));
    for (const [, destination] of content.matchAll(/\[[^\]\n]+\]\(([^\n)]+)\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('#')) continue;
      assert.ok(destination.startsWith('/preview/'), `${section.slug}: ${destination}`);
      assert.ok(!/\.md(?:#|$)/.test(destination), `${section.slug}: ${destination}`);
    }
  }
});
