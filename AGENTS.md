# livebetter-site

- 独立静态网站项目。原文源为 `../hangar/HowToLiveBetter`，禁止在此项目任务中修改原文仓库。
- 使用 Astro + Starlight + Pagefind。首页与检索页使用自定义主题；正文走 Starlight 阅读布局。
- `src/content/docs/`、`src/data/catalog.json` 是生成产物，修改导入脚本，禁止直接维护副本。
- 每次构建或开发启动前自动导入内容。`CONTENT_REPO` 指定其他原文检出目录；不自动联网拉取。
- 保留原文数字、来源和证据等级。视觉与导航修改不得改写原文事实。
- Markdown 内链与跨条目引用必须在构建后可跳转；保留每页原文归属与 CC BY 4.0 信息。
- 完成后运行 `npm run check`、`npm run build` 和针对变动的测试。
- 动画必须尊重 `prefers-reduced-motion`，移动端目录和检索必须可用。
- 本地预览优先监听 `100.64.1.102:4321`。不得提交 `dist/`、截图、依赖或日志。
