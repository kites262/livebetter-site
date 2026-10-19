// Validate imported content without modifying the source repository or generated files.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = resolve(ROOT, 'src/content/docs');
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'src/data/catalog.json'), 'utf8'));
const BASE = `/${(process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/?$/, '/');
const routeHref = route => `${BASE}${route.replace(/^\//, '')}`;
const errors = [];
function assert(condition, message) { if (!condition) errors.push(message); }
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]); }
const pages = new Map();
for (const path of files(DOCS).filter(p => p.endsWith('.md'))) {
  const slug = relative(DOCS, path).replace(/\.md$/, '').replace(/(?:^|\/)index$/, '');
  const route = routeHref(`/${slug}${slug ? '/' : ''}`);
  const md = readFileSync(path, 'utf8');
  assert(!pages.has(route), `Duplicate route ${route}`);
  assert(/^---\ntitle: .+\ndescription: .+\nsidebar:/m.test(md), `Missing page metadata: ${path}`);
  assert(md.includes(`${catalog.source.url}/blob/${catalog.source.commit}/`), `Missing source revision: ${path}`);
  assert(md.includes('https://creativecommons.org/licenses/by/4.0/'), `Missing content license: ${path}`);
  if (slug.startsWith('verification/') || slug === 'verification' || slug === 'about/references') {
    assert(md.includes('  hidden: true\npagefind: false\n'), `Historical page must be hidden and excluded from search: ${path}`);
  }
  pages.set(route, { path, md, anchors: new Set([...md.matchAll(/id="(entry-\d+)"/g)].map(m => m[1])) });
}
const knownRoutes = new Set([...pages.keys(), routeHref('/'), routeHref('/explore/')]);
let links = 0;
for (const { path, md } of pages.values()) {
  // Ignore external links and code examples; only imported website destinations are in scope.
  let inCode = false;
  for (const line of md.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    for (const match of line.matchAll(/\]\((\/[^\s)]+)\)/g)) {
      const [route, anchor] = match[1].split('#');
      links++;
      assert(knownRoutes.has(route), `Unknown local destination ${match[1]} in ${path}`);
      if (anchor?.startsWith('entry-')) assert(pages.get(route)?.anchors.has(anchor), `Missing entry target ${match[1]} in ${path}`);
    }
  }
}
assert(catalog.stats.chapters === catalog.sections.length, 'Chapter statistic does not match the catalog.');
assert(catalog.stats.entries === catalog.entries.length, 'Entry statistic does not match the catalog.');
assert(catalog.stats.articles === catalog.articles.length, 'Essay statistic does not match the catalog.');
const sectionIds = new Set(catalog.sections.map(s => s.number));
const grouped = catalog.groups.flatMap(g => g.sections);
assert(grouped.length === sectionIds.size && new Set(grouped).size === sectionIds.size && grouped.every(n => sectionIds.has(n)), 'Every chapter must belong to exactly one navigation group.');
const entryIds = new Set();
const validTags = { money: ['0', '少', '多'], time: ['少', '中', '多'], willpower: ['否', '些', '是'], benefit: ['大', '中', '小'], resource: ['死亡率', '金钱', '时间', '自由'] };
for (const entry of catalog.entries) {
  assert(!entryIds.has(entry.id), `Duplicate entry ID: ${entry.id}`);
  entryIds.add(entry.id);
  assert(entry.id === `${entry.section}-${entry.number}`, `Malformed entry ID: ${entry.id}`);
  assert(sectionIds.has(entry.section), `Unknown parent chapter: ${entry.id}`);
  assert(['A', 'B', 'C'].includes(entry.evidence), `Invalid evidence grade: ${entry.id}`);
  assert(entry.title && entry.plain && entry.cost, `Missing entry text: ${entry.id}`);
  for (const [key, values] of Object.entries(validTags)) assert(values.includes(entry.tags[key]), `Invalid ${key} tag for ${entry.id}: ${entry.tags[key]}`);
  const [route, anchor] = entry.href.split('#');
  assert(pages.get(route)?.anchors.has(anchor), `Catalog points to a missing entry: ${entry.href}`);
}
for (const section of catalog.sections) {
  const count = catalog.entries.filter(entry => entry.section === section.number).length;
  assert(count === section.count, `Wrong entry count for chapter ${section.number}`);
  assert(pages.get(section.href)?.anchors.size === count, `Wrong generated anchor count for chapter ${section.number}`);
}
for (const level of ['A', 'B', 'C']) assert(catalog.stats.evidence[level] === catalog.entries.filter(entry => entry.evidence === level).length, `Wrong evidence statistic: ${level}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Content OK: ${pages.size} pages, ${catalog.entries.length} entries, ${links} local links, all navigation groups and source attributions valid.`);
