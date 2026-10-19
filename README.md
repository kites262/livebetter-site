# 生活有方 · Live Better

基于 Astro + Starlight 的中文生活指南静态网站。构建时读取 `../hangar/HowToLiveBetter` 的 Markdown 原文，按主题整理导航、转换交叉引用，并生成条目筛选与全文索引。

网站：[r8.ink](https://r8.ink) · 源码：[kites262/livebetter-site](https://github.com/kites262/livebetter-site)

## 从公开仓库构建

原文版本锁定在 `content-source.json`。克隆后可以独立下载原文并构建，无需已有的工作区目录：

```bash
git clone https://github.com/kites262/livebetter-site.git
cd livebetter-site
npm ci
npm run content:fetch
CONTENT_REPO=.cache/content SITE_URL=https://r8.ink npm run build
npm run preview -- --host 127.0.0.1
```

`content:fetch` 只维护忽略目录 `.cache/content`。修改已有原文前先处理本地变更，脚本不会覆盖未提交内容。GitHub Actions 使用相同版本构建并运行检查。

## 界面与功能

界面文案采用简短、自然的编辑语气：标题留白，按钮直接说明动作，提示只保留必要信息。章节正文和专题原文保持原样；主题卡片摘要由导入脚本单独维护。

- 自定义深色首页：动态轨道、柔光、主题卡片、场景专题、滚动入场和悬停动画。
- 阅读页：分组侧边目录、章内条目目录、日夜主题、可点击的跨章引用。
- 建议速查：关键词、主题、证据等级、金钱成本、收益类型及争议筛选，可复制 URL 分享当前筛选。
- 全文检索：Pagefind 中文分词，检索收益、备注、来源以及专题长文。
- 独立入口：阅读说明、证据标准、统计术语、原文许可和核实记录。
- 手机导航、键盘操作与减少动态效果偏好支持；无远程字体或图片依赖。
- 全站页脚信息行内展示 `陕ICP备2024049785号`，沿用原有字号与配色，链接至工信部备案查询；统一在 `src/components/IcpRecord.astro` 维护。

## 本地运行

需要 Node.js 22.12 或以上（以依赖的 engines 要求为准）、npm 和 Git。原文仓库已在本工作区的 `hangar` 中，默认无需再次克隆。

```bash
cd livebetter-site
npm ci
npm run dev
```

默认开发地址：`http://100.64.1.102:4321/`（本项目工作区的 Tailscale 地址）。在其他机器上使用 `npm run dev -- --host 127.0.0.1`；通过公开仓库下载原文时，还需设置 `CONTENT_REPO=.cache/content`。条目速查可在开发模式使用；Pagefind 全文索引在生产构建后生成，完整验证用下面的预览方式：

```bash
npm run check
npm test
npm run build
npm run preview
```

`npm run preview` 也监听 `100.64.1.102:4321`。需要更换绑定地址或端口时，可以通过参数覆盖，例如 `npm run preview -- --host 127.0.0.1 --port 4322`。

## 原文与同步

内容来自 [eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)。导入脚本只读原文，不会修改、拉取或提交原文仓库。网站正文保留数字、证据等级、来源与观点，增加网页元数据、章节导航、条目锚点、链接转换和署名。

每次 `dev`、`check`、`build` 都先重新导入。上游更新后，在确认原文工作区干净的情况下手动快进，再构建：

```bash
git -C ../hangar/HowToLiveBetter pull --ff-only
npm run build
```

导入使用 Git 提交标识追踪引用版本，原文有已跟踪的未提交改动时会停止导入。生成目录不提交到本项目。

在新的环境中，先准备内容源：

```bash
git clone https://github.com/eternity4719/HowToLiveBetter.git ../HowToLiveBetter
CONTENT_REPO=../HowToLiveBetter npm run build
```

也可以复制 `.env.example` 为 `.env`：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `CONTENT_REPO` | `../hangar/HowToLiveBetter` | 原文 Git 检出目录，相对于项目根目录 |
| `SITE_BASE` | `/` | 网站部署路径，例如 `/livebetter/` |
| `SITE_URL` | 不指定 | 正式网站 origin，例如 `https://example.com` |

`.env` 由内容命令与 Astro 配置读取；显式设置的环境变量优先。

## 内容组织

| 网站路径 | 内容 |
| --- | --- |
| `/` | 首页与主题入口 |
| `/explore/` | 建议筛选、全书与专题搜索 |
| `/guide/01/` 至 `/guide/34/` | 按七个主题分组的原文章节 |
| `/topics/*/` | 独立场景专题 |
| `/about/*/` | 阅读、证据、术语、引用对照、来源许可 |
| `/verification/` | 核实记录索引与历史记录 |

条目使用 `#entry-N` 锚点。核实记录保留历史条号，隐藏在主导航之外并排除全文搜索，避免历史信息混入当前建议。章节的数字编号沿用上游：上游增删导致条号改变时，网站在下一次构建随原文更新。

主要文件：

```text
astro.config.mjs           导航、站点配置与 Starlight 集成
scripts/import-content.mjs 原文导入与链接转换
scripts/check-content.mjs  生成 Markdown 的结构与引用检查
scripts/check-built.mjs    全部 HTML 的链接、资源与锚点检查
src/pages/index.astro      首页
src/pages/explore.astro    条目与全文检索
src/styles/theme.css      首页视觉与正文阅读主题
src/content/docs/         自动生成，勿手动编辑
src/data/catalog.json     自动生成，勿手动编辑
```

## 验证

- `npm run check`：Astro 类型检查、导航覆盖、正文内链、条目锚点和来源署名。
- `npm test`：隔离导入，核对全部章节数字保留与子路径下的链接转换。
- `npm run build`：生成静态文件和 Pagefind 索引；随后自动检查构建页面的内链、资源和片段。
- `npm run test:browser`：预览服务启动后检查中文搜索、组合筛选、引用跳转、手机导航、减少动画及截图。首次在新机器运行可执行 `npx playwright install chromium`；也可用 `CHROMIUM_PATH` 指定已有 Chromium。

浏览器测试默认访问 `http://100.64.1.102:4321/`，可通过 `BROWSER_URL` 覆盖。截图输出到忽略目录 `artifacts/`。

## 部署与许可

部署 `dist/` 即可，支持静态服务器、对象存储和 GitHub Pages，不需要后端或数据库。设置 `SITE_BASE` 后必须重新构建。不要只复制原文 Markdown 或 `src/` 目录。

生产环境使用 Caddy，站点配置见 `deploy/Caddyfile`。构建时设置 `SITE_URL=https://r8.ink`，生成正式域名的 canonical 和 sitemap。将每次构建上传到 `/srv/livebetter-site/releases/<版本>/`，再原子切换 `/srv/livebetter-site/current` 符号链接，可保留旧版本用于回滚。Caddy 只需首次添加站点时验证配置并 reload，后续静态版本切换无需重启。

```bash
CONTENT_REPO=.cache/content SITE_URL=https://r8.ink npm run build
# 将 dist/ 的内容上传到新的 releases/<版本>/ 目录，再切换 current。
# 将 deploy/Caddyfile 中的站点块加入现有配置，保留其他站点。
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

原文作者为 eternity4719，采用 **CC BY 4.0**；转载保留署名、许可链接与修改说明。网站界面与本站构建代码采用 **MIT**（见 `LICENSE`），不改变原文许可。每篇阅读页都标注原文地址、引用提交和排版调整说明。
