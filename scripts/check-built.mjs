// Validate the actual emitted website, including URL fragments used by the 665 entries.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(project, process.env.DIST_DIR || 'dist');
const catalog = JSON.parse(readFileSync(resolve(project, 'src/data/catalog.json'), 'utf8'));
const base = `/${(process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/?$/, '/');
const files = directory => readdirSync(directory).flatMap(name => {
  const path = resolve(directory, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});
const htmlFiles = files(dist).filter(path => path.endsWith('.html'));
const html = new Map(htmlFiles.map(path => [path, readFileSync(path, 'utf8')]));
const ids = new Map(htmlFiles.map(path => [path, new Set([...html.get(path).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))]));
const problems = [];
let links = 0;
function check(url, from) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return;
  const pagePath = base + relative(dist, from).replace(/index\.html$/, '');
  const target = new URL(url.replaceAll('&amp;', '&'), `http://local.test${pagePath}`);
  if (target.origin !== 'http://local.test') return;
  links++;
  let pathname;
  try { pathname = decodeURIComponent(target.pathname); } catch { problems.push(`${pagePath}: invalid URL ${url}`); return; }
  if (!pathname.startsWith(base)) { problems.push(`${pagePath}: URL escapes base ${url}`); return; }
  let path = resolve(dist, pathname.slice(base.length));
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  if (!existsSync(path)) { problems.push(`${pagePath}: missing target ${url}`); return; }
  if (target.hash && ids.has(path) && !ids.get(path).has(decodeURIComponent(target.hash.slice(1)))) {
    problems.push(`${pagePath}: missing fragment ${url}`);
  }
}
for (const [path, content] of html) {
  // Escaped source examples in <code> can contain src="..." without loading a resource.
  for (const [tag] of content.matchAll(/<(?:a|link|script|img|source|iframe|video|audio|use)\b[^>]*>/gi)) {
    for (const [, url] of tag.matchAll(/\b(?:href|src)="([^"]+)"/g)) check(url, path);
  }
}
for (const entry of catalog.entries) check(entry.href, resolve(dist, 'explore/index.html'));
for (const section of [...catalog.sections, ...catalog.articles]) {
  const page = html.get(resolve(dist, section.slug, 'index.html'));
  assert.ok(page, `Missing built reading page: ${section.slug}`);
  assert.ok(page.includes('creativecommons.org/licenses/by/4.0/'), `Missing license: ${section.slug}`);
  assert.ok(page.includes(`/blob/${catalog.source.commit}/`), `Missing source revision: ${section.slug}`);
}
assert.equal(problems.length, 0, `Broken built URLs (${problems.length}):\n${problems.slice(0, 30).join('\n')}`);
console.log(`Built website: ${htmlFiles.length} pages, ${links} local links and assets, ${catalog.entries.length} entry targets validated.`);
