import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

if (existsSync(new URL('./.env', import.meta.url))) loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));

// npm lifecycle 先导入原文，再读取同一次构建的目录。
const catalog = JSON.parse(readFileSync(new URL('./src/data/catalog.json', import.meta.url), 'utf8'));
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  ...(process.env.SITE_URL ? { site: process.env.SITE_URL } : {}),
  base,
  trailingSlash: 'always',
  output: 'static',
  integrations: [
    starlight({
      title: '生活有方 · 人生指南',
      description: '健康、钱、时间与自由。一部随手查阅的生活指南。',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      defaultLocale: 'root',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      social: [{ icon: 'github', label: '原文仓库', href: catalog.source.url }],
      sidebar: [
        { label: '回到首页', link: '/' },
        { label: '条目与全文检索', link: '/explore/' },
        ...catalog.groups.map((group) => ({
          label: group.title,
          collapsed: true,
          items: catalog.sections.filter((section) => section.group === group.id)
            .map((section) => ({ slug: section.slug, label: `${section.number}. ${section.title}` })),
        })),
        { label: '场景专题', collapsed: true, items: catalog.articles.map((article) => ({ slug: article.slug })) },
        { label: '阅读与依据', collapsed: true, items: [
          'about/reading', 'about/evidence', 'about/glossary', 'about/credits', 'about/references',
        ] },
      ],
      pagination: false,
      credits: false,
      disable404Route: true,
      components: {
        SiteTitle: './src/components/DocsSiteTitle.astro',
        Footer: './src/components/DocsFooter.astro',
      },
    }),
  ],
});
