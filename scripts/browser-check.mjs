import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(resolve(project, 'src/data/catalog.json'), 'utf8'));
const start = new URL(process.env.BROWSER_URL || 'http://100.64.1.102:4321/');
if (!start.pathname.endsWith('/')) start.pathname += '/';
const local = path => new URL(path.replace(/^\//, ''), start).href;
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true });
const failures = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => failures.push(`Page error: ${error.message}`));
page.on('requestfailed', request => {
  if (request.url().startsWith(start.origin) && request.failure()?.errorText !== 'net::ERR_ABORTED') {
    failures.push(`Failed local resource: ${request.url()} (${request.failure()?.errorText})`);
  }
});
page.on('response', response => {
  if (response.url().startsWith(start.origin) && response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
});
const visit = async path => {
  const response = await page.goto(local(path), { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, `HTTP response ${path}`);
};
const noOverflow = async label => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${label}: horizontal overflow`);
};
const countIs = async count => {
  await page.waitForFunction(expected => {
    const text = document.querySelector('#result-count')?.textContent || '';
    return Number(text.replace(/,/g, '').match(/\d+/)?.[0]) === expected;
  }, count);
};
const screenshotDirectory = resolve(project, 'artifacts');
mkdirSync(screenshotDirectory, { recursive: true });

try {
  await visit('');
  assert.ok(await page.locator('h1').innerText());
  await noOverflow('desktop home');
  assert.ok(await page.locator('a[href]').count() > 15, 'Homepage exposes reading and topic links');
  await page.evaluate(async () => {
    for (let position = 0; position < document.body.scrollHeight; position += 500) {
      window.scrollTo(0, position);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(650);
  await page.screenshot({ path: resolve(screenshotDirectory, 'home-desktop.png'), fullPage: true });

  await visit('explore/');
  await countIs(catalog.entries.length);
  await page.screenshot({ path: resolve(screenshotDirectory, 'explore.png'), fullPage: false });
  await page.locator('#entry-search').fill('蘑菇');
  await page.waitForFunction(() => document.querySelector('#results')?.textContent?.includes('蘑菇'));
  assert.ok(await page.locator('#results a[href*="guide/01/"]').count() > 0, 'Chinese entry keyword search returns chapter 1');
  await page.locator('#reset-filters').click();
  await page.locator('#entry-search').fill('');
  await countIs(catalog.entries.length);

  await page.locator('#evidence-filter').selectOption('A');
  await countIs(catalog.stats.evidence.A);
  await page.locator('#group-filter').selectOption('health');
  const health = new Set(catalog.groups.find(group => group.id === 'health').sections);
  await countIs(catalog.entries.filter(entry => health.has(entry.section) && entry.evidence === 'A').length);
  await page.locator('#reset-filters').click();
  await page.locator('#money-filter').selectOption('0');
  await countIs(catalog.entries.filter(entry => entry.tags.money === '0').length);
  await page.locator('#resource-filter').selectOption('金钱');
  await countIs(catalog.entries.filter(entry => entry.tags.money === '0' && entry.tags.resource === '金钱').length);
  await page.locator('#reset-filters').click();
  await countIs(catalog.entries.length);
  await page.locator('#cheap-only').click();
  await countIs(catalog.entries.filter(entry => entry.tags.money === '0' && entry.tags.time === '少' && entry.tags.willpower === '否').length);
  await page.locator('#reset-filters').click();
  if (await page.locator('#disputed-only').count()) {
    await page.locator('#disputed-only').click();
    await countIs(catalog.entries.filter(entry => entry.disputed).length);
    await page.locator('#reset-filters').click();
  }
  const before = await page.locator('#results a[href]').count();
  if (await page.locator('#load-more').isVisible()) {
    await page.locator('#load-more').click();
    assert.ok(await page.locator('#results a[href]').count() > before, 'Load more adds real entry cards');
  }
  await page.locator('#mode-all').click();
  await page.locator('#entry-search').fill('催吐');
  await page.waitForFunction(() => document.querySelector('#results')?.textContent?.includes('催吐'), null, { timeout: 20000 });
  assert.ok(await page.locator('#results a[href*="guide/"]').count() > 0, 'Pagefind searches actual Chinese article body');
  const historicalResults = await page.evaluate(async base => {
    const search = await import(`${base}pagefind/pagefind.js`);
    await search.options({ baseUrl: base });
    const matches = await search.search('核实记录');
    const data = await Promise.all(matches.results.map(result => result.data()));
    return data.filter(result => result.url.includes('/verification/')).map(result => result.url);
  }, start.pathname);
  assert.deepEqual(historicalResults, [], 'Historical verification records stay outside the current advice search');

  await visit('guide/01/');
  await page.screenshot({ path: resolve(screenshotDirectory, 'reading.png'), fullPage: false });
  assert.ok(await page.locator('#entry-5').count() === 1);
  assert.ok(await page.locator('.sidebar a[href*="guide/"]').count() > 10, 'Grouped chapter sidebar exists');
  assert.ok(await page.locator('a[href="#entry-5"], a[href*="#5-"]').count() > 0, 'Article exposes TOC or entry navigation');
  await page.locator('button[data-open-modal]').click();
  const searchDialog = page.locator('site-search dialog');
  await searchDialog.locator('.pagefind-ui__search-input').fill('蘑菇');
  await searchDialog.locator('a.pagefind-ui__result-link[href*="guide/01/"]').first().waitFor({ timeout: 20000 });
  await page.keyboard.press('Escape');
  assert.equal(await searchDialog.evaluate(dialog => dialog.open), false, 'Escape closes native reading search');
  const crosslink = page.locator('main a[href$="guide/17/#entry-9"]').first();
  await crosslink.click();
  await page.waitForURL('**/guide/17/#entry-9');
  assert.equal(await page.locator('#entry-9').count(), 1, 'Cross chapter citation reaches its actual entry');
  assert.ok(await page.locator('.source-note').innerText().then(text => text.includes('CC BY 4.0')));

  await page.setViewportSize({ width: 390, height: 844 });
  await visit('');
  await noOverflow('mobile home');
  const menu = page.locator('.life-menu-toggle');
  await menu.focus();
  await page.keyboard.press('Enter');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('#life-navigation').isVisible(), 'Keyboard opens mobile navigation');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  const moving = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && Number(animation.effect?.getTiming().duration) > 1).length);
  assert.equal(moving, 0, 'Reduced motion disables long or continuous animation');
  await page.screenshot({ path: resolve(screenshotDirectory, 'home-mobile.png'), fullPage: true });
  await visit('explore/');
  await noOverflow('mobile explore');
  await page.locator('#entry-search').fill('蘑菇');
  await page.waitForFunction(() => document.querySelector('#results')?.textContent?.includes('蘑菇'));
  await visit('guide/01/');
  await noOverflow('mobile reading');
  const readingMenu = page.getByRole('button', { name: /菜单|Menu/i }).first();
  await readingMenu.click();
  assert.ok(await page.locator('#starlight__sidebar').evaluate(sidebar => sidebar.matches(':popover-open')), 'Mobile reading sidebar opens');
  assert.deepEqual(failures, [], 'No client errors or failed local resources');
  console.log('Browser smoke passed: Chinese entry and body search, combined filters, citations, desktop/mobile navigation, reduced motion and screenshots.');
} finally {
  await browser.close();
}
