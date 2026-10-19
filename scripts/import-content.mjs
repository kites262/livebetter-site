// Import the upstream Markdown as a build input; never edit or fetch the source repository.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, process.env.CONTENT_REPO || '../hangar/HowToLiveBetter');
const OUT = resolve(ROOT, 'src/content/docs');
const REPO = 'https://github.com/eternity4719/HowToLiveBetter';
const BASE = `/${(process.env.SITE_BASE || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/?$/, '/');
const href = route => `${BASE}${route.replace(/^\//, '')}`;
const read = path => readFileSync(resolve(SOURCE, path), 'utf8').replace(/\r\n/g, '\n');
const git = (...args) => execFileSync('git', args, { cwd: SOURCE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const commit = git('rev-parse', 'HEAD');
const updatedAt = git('show', '-s', '--format=%cI', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('The content repository has tracked changes. Commit or stash them before importing a reproducible source revision.');

const groups = [
  { id: 'health', title: '健康与安全', description: '日常防护、就医用药与应急。', icon: 'heart', sections: [1, 2, 13, 16, 24, 28, 33, 34] },
  { id: 'focus', title: '时间与精力', description: '睡眠、专注与情绪。', icon: 'sun', sections: [3, 4, 22, 29] },
  { id: 'money', title: '金钱与保障', description: '消费、储蓄与生活保障。', icon: 'wallet', sections: [5, 6, 7, 15] },
  { id: 'rights', title: '工作与法律', description: '劳动权益、财产与法律边界。', icon: 'shield', sections: [8, 9, 19] },
  { id: 'family', title: '家庭与人生', description: '婚恋、育儿、养老与身后事。', icon: 'home', sections: [10, 17, 18, 20, 25, 27, 30] },
  { id: 'growth', title: '学习与远行', description: '求学、技能与出国。', icon: 'compass', sections: [21, 23, 31, 32] },
  { id: 'tech', title: '技术与创业', description: '接单、账号与创业合规。', icon: 'code', sections: [11, 12, 14, 26] },
];
const articleSlugs = {
  '结婚划不划算.md': 'marriage',
  '家庭应急装备清单.md': 'emergency-kit',
  '遇到陌生人出事该不该停.md': 'helping-strangers',
  '做平台要办哪些证.md': 'platform-licenses',
  '生物钟和夜班.md': 'body-clock',
  '被裁了之后先做什么.md': 'after-layoff',
  '孩子出生前后要办的事.md': 'newborn-checklist',
  '刚确诊慢性病之后.md': 'chronic-diagnosis',
};
const plain = value => value.replace(/\[([^\]]+)\]\([^\n]+?\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
const intro = md => plain(md.replace(/^\[← 回总目录\].*\n/m, '').replace(/^# .*\n/m, '').split(/\n\s*\n/).find(p => p.trim() && !p.trim().startsWith('#')) || '').slice(0, 130);
const titleOf = (md, fallback) => md.match(/^#\s+(.+)$/m)?.[1].trim() || fallback;
const cleanTop = md => md.replace(/^\[← 回总目录\]\([^)]*\)\s*\n/, '').replace(/^#\s+.+\n/, '').trim();
const sections = [];
const entries = [];
const articles = [];
const pages = [];
const routes = new Map([['README.md', '/about/reading/']]);
const entryMap = new Map();
const bookFiles = readdirSync(resolve(SOURCE, 'book')).filter(f => /^\d\d-.+\.md$/.test(f)).sort();

for (const file of bookFiles) {
  const sourcePath = `book/${file}`;
  const md = read(sourcePath);
  const number = Number(file.slice(0, 2));
  const slug = `guide/${String(number).padStart(2, '0')}`;
  const group = groups.find(g => g.sections.includes(number));
  if (!group) throw new Error(`Chapter ${number} needs a navigation group.`);
  const chapterEntries = [...md.matchAll(/^###\s+(\d+)\.\s+(.+)\n([\s\S]*?)(?=^###\s+\d+\.|$(?![\s\S]))/gm)];
  const section = { number, title: titleOf(md, file).replace(/^\d+\.\s*/, ''), slug, href: href(`/${slug}/`), group: group.id, count: chapterEntries.length, description: intro(md), sourcePath };
  sections.push(section);
  routes.set(sourcePath, `/${slug}/`);
  for (const match of chapterEntries) {
    const [, rawNumber, title, body] = match;
    const entryNumber = Number(rawNumber);
    const field = name => plain(body.match(new RegExp(`^- ${name}：[ \\t]*(.*)$`, 'm'))?.[1] || '');
    const tags = Object.fromEntries([...body.matchAll(/(钱|时间|毅力|收益|口径)=([^\s>]+)/g)].map(m => [m[1], m[2]]));
    const entry = { id: `${number}-${entryNumber}`, section: number, number: entryNumber, title: plain(title), href: `${section.href}#entry-${entryNumber}`, plain: field('说人话'), cost: field('成本'), evidence: field('证据等级').match(/^[ABC]/)?.[0] || '', tags: { money: tags['钱'], time: tags['时间'], willpower: tags['毅力'], benefit: tags['收益'], resource: tags['口径'] }, disputed: /^- 备注：\s*争议/m.test(body) };
    if (entryMap.has(entry.id)) throw new Error(`Duplicate entry: ${entry.id}`);
    entryMap.set(entry.id, entry);
    entries.push(entry);
  }
  pages.push({ ...section, content: cleanTop(md), chapter: number, order: number });
}

for (const file of readdirSync(resolve(SOURCE, 'docs')).filter(f => f.endsWith('.md') && f !== '引用对照.md').sort()) {
  const sourcePath = `docs/${file}`;
  const md = read(sourcePath);
  const stableSlug = articleSlugs[file] || `essay-${createHash('sha256').update(file).digest('hex').slice(0, 12)}`;
  const slug = `topics/${stableSlug}`;
  const article = { title: titleOf(md, file), slug, href: href(`/${slug}/`), description: intro(md), sourcePath };
  articles.push(article);
  routes.set(sourcePath, `/${slug}/`);
  pages.push({ ...article, content: cleanTop(md), order: articles.length });
}

// The logs describe earlier revisions; their historical entry numbers must stay as written.
const verificationFiles = readdirSync(resolve(SOURCE, 'docs/核实记录')).filter(f => f.endsWith('.md')).sort();
for (const [index, file] of verificationFiles.entries()) {
  const sourcePath = `docs/核实记录/${file}`;
  const md = read(sourcePath);
  const slug = `verification/record-${createHash('sha256').update(file).digest('hex').slice(0, 12)}`;
  routes.set(sourcePath, `/${slug}/`);
  pages.push({ title: titleOf(md, file.replace(/\.md$/, '')), slug, description: '原文仓库的核实记录，记录当时的查证过程和修改依据。', sourcePath, content: cleanTop(md), hidden: true, historical: true, order: index + 1 });
}
const verificationIndex = { title: '来源核实记录', slug: 'verification/index', description: '按原始文件名查阅上游的查证和修改记录。', sourcePath: 'README.md', hidden: true, historical: true, order: 0, content: '这些记录保留当时的条号和核实状态，查阅当前建议请以生活指南正文为准。\n\n' + verificationFiles.map(file => `- [${file.replace(/\.md$/, '')}](${href(routes.get(`docs/核实记录/${file}`))})`).join('\n') };
pages.push(verificationIndex);
routes.set('docs/核实记录/', '/verification/');

const readme = read('README.md');
function readmeSection(heading) {
  const lines = readme.split('\n');
  const start = lines.findIndex(line => line === `## ${heading}`);
  if (start === -1) throw new Error(`README section missing: ${heading}`);
  const next = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start, next === -1 ? undefined : next).join('\n').trim();
}
const about = [
  { title: '从这里开始', slug: 'about/reading', description: '了解指南的适用范围、阅读方式和四种资源。', content: `本网站整理自《高性价比人生指南》。你可以从主题侧栏按章阅读，也可以通过顶部搜索查找原文；[条目检索](${href('/explore/')})支持按证据和成本筛选。以下保留作者的阅读说明，其中关于原在线检索页、下载和 AI skill 的描述指上游项目。\n\n${readmeSection('怎么读')}\n\n${readmeSection('四种资源')}\n\n${readmeSection('这本书想回答的问题')}` },
  { title: '证据与性价比', slug: 'about/evidence', description: 'A / B / C 是什么，如何理解收益、成本与性价比。', content: `${readmeSection('证据分级')}\n\n${readmeSection('性价比档')}` },
  { title: '读懂数字', slug: 'about/glossary', description: '查阅研究、统计、生活和法律中的常用术语。', content: readmeSection('读懂数字（术语表）').replace(/<details>\n<summary>[^]*?<\/summary>\n/, '').replace(/<\/details>/g, '') },
  { title: '原文与许可', slug: 'about/credits', description: '内容来源、同步版本及转载许可。', content: `网站内容来自 [eternity4719 / HowToLiveBetter](${REPO}) 的《高性价比人生指南》。\n\n当前引用版本：[${commit.slice(0, 7)}](${REPO}/tree/${commit})；源版本更新时间：${updatedAt}。\n\n本站重新组织导航、增加元数据与条目锚点、转换内部链接，保留原文观点、数字和来源。核实记录保留历史条号。\n\n- [交叉引用对照表](${href('/about/references/')})\n- [来源核实记录](${href('/verification/')})\n\n${readmeSection('许可')}` },
];
for (const [index, page] of about.entries()) pages.push({ ...page, sourcePath: 'README.md', order: index + 1 });
pages.push({ title: '交叉引用对照表', slug: 'about/references', description: '上游自动生成的条目引用与指向标题对照。', sourcePath: 'docs/引用对照.md', content: cleanTop(read('docs/引用对照.md')), hidden: true, historical: true, order: 5 });
routes.set('docs/引用对照.md', '/about/references/');

const readmeAnchors = { '目录': '/', '怎么读': '/about/reading/', '四种资源': '/about/reading/#四种资源', '证据分级': '/about/evidence/#证据分级', '性价比档': '/about/evidence/#性价比档', '读懂数字术语表': '/about/glossary/', '许可': '/about/credits/#许可' };
function rewriteLinks(md, sourcePath) {
  return md.replace(/\[([^\]\n]+)\]\(([^\n)]+)\)/g, (whole, label, destination) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) return whole;
    if (destination.startsWith(BASE) && (destination.startsWith(href('/verification/')) || destination.startsWith(href('/explore/')) || destination.startsWith(href('/about/')))) return whole;
    const [path, fragment = ''] = destination.split('#');
    const target = posix.normalize(posix.join(posix.dirname(sourcePath), decodeURI(path || sourcePath)));
    if (destination.startsWith('#')) {
      if (sourcePath === 'README.md' && readmeAnchors[fragment]) return `[${label}](${href(readmeAnchors[fragment])})`;
      return whole;
    }
    let route = routes.get(target);
    if (target === 'README.md' && readmeAnchors[fragment]) route = readmeAnchors[fragment];
    if (route) {
      const chapter = target.match(/^book\/(\d\d)-/);
      const explicit = label.match(/第\s*(\d+)\s*节第\s*(\d+)\s*条/);
      if (chapter && explicit && Number(chapter[1]) === Number(explicit[1]) && entryMap.has(`${Number(chapter[1])}-${Number(explicit[2])}`)) return `[${label}](${href(route)}#entry-${Number(explicit[2])})`;
      return `[${label}](${href(route)}${fragment && !route.includes('#') ? `#${fragment}` : ''})`;
    }
    // Files outside the website's reading content (license, skills, tools) remain upstream links.
    return `[${label}](${REPO}/blob/${commit}/${target}${fragment ? `#${fragment}` : ''})`;
  });
}

const SPEC = '[\\d、,\\s]+?(?:(?:到|至|–|-)\\s*第?\\s*\\d+)?';
const lawCitation = /(《[^》]*》|〔[^〕]*〕|\d+\s*号|该(?:解释|意见|办法|规定|条例|通知|法)|[^\s，。；：、（）「」]{0,8}(?:法|条例|办法|规定|准则|细则|公约))$/;
let crosslinks = 0;
function referenceLink(label, section, spec) {
  const numbers = spec.match(/\d+/g)?.map(Number) || [];
  const isRange = /到|至|–|-/.test(spec);
  const targets = isRange ? Array.from({ length: numbers[1] - numbers[0] + 1 }, (_, i) => numbers[0] + i) : numbers;
  if (!targets.length || targets.length > 60 || targets.some(n => !entryMap.has(`${section}-${n}`))) throw new Error(`Invalid content reference: chapter ${section}, ${label}`);
  crosslinks += targets.length;
  if (targets.length === 1 || isRange) return `[${label}](${entryMap.get(`${section}-${targets[0]}`).href})`;
  // Each list member is independently navigable, with the original display text preserved.
  return label.replace(/\d+/g, (n, offset) => offset === label.indexOf(String(section)) && label.includes('节') ? n : `[${n}](${entryMap.get(`${section}-${Number(n)}`).href})`);
}
function rewriteReferences(md, chapter) {
  let fenced = false;
  let currentEntry = false;
  return md.split('\n').map(line => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    if (/^###\s+\d+\./.test(line)) { currentEntry = true; return line; }
    if (/^\s*<!--/.test(line)) return line;
    const protectedParts = [];
    const protect = value => { protectedParts.push(value); return `\u0000${protectedParts.length - 1}\u0000`; };
    let result = line.replace(/`[^`]*`|\[[^\]\n]*\]\([^\n]*?\)|<[^>]+>/g, protect);
    result = result.replace(new RegExp(`第\\s*(\\d+)\\s*节\\s*第\\s*(${SPEC})\\s*条`, 'g'), (label, section, spec) => protect(referenceLink(label, Number(section), spec)));
    result = result.replace(/第\s*(\d+)\s*节/g, (label, section) => {
      const target = sections.find(s => s.number === Number(section));
      return target ? protect(`[${label}](${target.href})`) : label;
    });
    if (chapter && (!currentEntry || /^- (?:成本|说人话|收益|备注)：/.test(line))) {
      result = result.replace(new RegExp(`(?:本节)?第\\s*(${SPEC})\\s*条`, 'g'), (label, spec, offset) => {
        if (lawCitation.test(result.slice(0, offset).trimEnd())) return label;
        return referenceLink(label, chapter, spec);
      });
    }
    return result.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedParts[Number(i)]);
  }).join('\n');
}

for (const dir of ['guide', 'topics', 'verification', 'about']) rmSync(resolve(OUT, dir), { recursive: true, force: true });
for (const page of pages) {
  let content = rewriteLinks(page.content, page.sourcePath);
  if (!page.historical) content = rewriteReferences(content, page.chapter);
  if (page.chapter) content = content.replace(/^###\s+(\d+)\./gm, '<span id="entry-$1" class="entry-anchor"></span>\n\n### $1.');
  const metadata = `---\ntitle: ${JSON.stringify(page.title)}\ndescription: ${JSON.stringify(page.description)}\nsidebar:\n  order: ${page.order}\n${page.hidden ? '  hidden: true\npagefind: false\n' : ''}---\n\n`;
  const attribution = `\n\n---\n\n<div class="source-note" data-pagefind-ignore>\n\n原文：[《高性价比人生指南》· ${page.sourcePath}](${REPO}/blob/${commit}/${page.sourcePath})，作者 eternity4719。内容采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，按许可原样提供、不作保证。本站调整导航、链接及排版，${page.historical ? '保留历史条号。' : '保留原文观点、数字和来源。'} 引用版本：\`${commit.slice(0, 7)}\`。\n\n</div>\n`;
  const destination = resolve(OUT, `${page.slug}.md`);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, metadata + content + attribution);
}

const evidence = Object.fromEntries(['A', 'B', 'C'].map(level => [level, entries.filter(e => e.evidence === level).length]));
const catalog = { source: { repo: 'eternity4719/HowToLiveBetter', url: REPO, commit, updatedAt }, stats: { chapters: sections.length, entries: entries.length, articles: articles.length, evidence }, groups, sections, articles, entries };
mkdirSync(resolve(ROOT, 'src/data'), { recursive: true });
writeFileSync(resolve(ROOT, 'src/data/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`Imported ${sections.length} chapters, ${entries.length} entries, ${articles.length} essays and ${verificationFiles.length} verification records from ${commit.slice(0, 7)} (${crosslinks} entry links).`);
