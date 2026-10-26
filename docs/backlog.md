# 待办与已调研方向

这里记录已经调研、尚未排期的方向，后续会话直接沿用其中的结论，不重复调研。每条只写结论、约束、待定问题和第一步，不记录进度或完成率。开工后把结论转入设计稿或正式文档，并删除对应条目，历史通过 Git 追溯。

外部事实注明核实方式：“官方”表示已打开官方页面核对，“摘要”表示只来自搜索摘要或第三方文章。标为会变的价格、额度、版本和项目状态，动工前复核。

## 静态部署（EdgeOne / Cloudflare）与 Git 内容仓库

状态：已调研，未排期。记录于 2026-10-27，外部事实于同日查询。

### 背景

当前只有自有服务器一种部署方式：PostgreSQL、API、Nuxt 与 Caddy 由 Docker Compose 编排，见[部署与版本切换](deployment.md)。希望增加无服务器托管：访问侧部署到 EdgeOne、Cloudflare 等边缘平台，不依赖常驻服务器和数据库；写作侧可以直接使用 Git 仓库里的 Markdown 文件。

### 结论

- 新增“静态发布”部署形态，不另做一个 Markdown 版博客。沿用同一套 Nuxt 前端与三主题，构建时读取公开数据，由 `nuxt generate` 输出纯静态站。
- 内容格式只保留一套。Git 内容仓库定义为内容包 v14 的文件化表达：文章、闪念、朋友圈使用 Markdown 与 frontmatter，项目、友链、图库、图片提示词、平台订阅费和站点资料使用 YAML，校验复用[内容包格式](../src/backend/server-main/src/modules/backup/content-package.ts)。
- 支持两种用法。后台为准：后台可以只在本机运行（`install.sh --local`），一条命令导出仓库、构建并上传。仓库为准：直接在仓库中写 Markdown，推送后由 CI 构建；回到服务器部署时从仓库迁入。同一站点只认一个事实源，不做双向同步。
- 构建快照是真实的公开数据，作为显式部署形态，不违背 API 失败不回退 Mock 的约定。快照导出或构建失败时整次发布失败，不生成空列表或零统计的页面。
- 部署目标：域名已备案时用 EdgeOne 覆盖国内；未备案时用 Cloudflare Workers 静态资源。同一份构建产物可以同时部署到两边，再按 DNS 线路分流。
- 写作工具：VS Code 或 Obsidian 即可；需要网页编辑时，优先选 Sveltia CMS、Decap CMS 这类不绑定框架的 Git CMS。

### 不采用的方案

- 单独做 Markdown 版博客：等于维护第二个产品，并丢掉后台、内容关联与版本、审核互动、媒体引用保护和备份恢复。
- 把 NestJS 与 PostgreSQL 搬上 Workers 或 EdgeOne 函数：四十多个实体、事务、持久任务、本地媒体和备份，放进免费版单次 10ms CPU、128MB 内存、无持久文件系统的运行环境等于重写。Cloudflare Containers 和 EdgeOne 云函数可以运行 Node，但需要外接 PostgreSQL、付费，并有冷启动，比一台小 VPS 更贵也更复杂。
- 只把 Nuxt SSR 放到边缘、API 留在服务器：服务器仍然存在，收益只剩 CDN。仅需国内加速时，在现有服务器前接入 EdgeOne 或阿里云 ESA 的 CDN，并按[可信代理配置](deployment.md#可信代理读取配额与媒体缓存)重新核对。
- Nuxt Content 与 Nuxt Studio：Studio 面向 Nuxt Content 站点，引入后会多出一套 Markdown 渲染管线，与现有 markdown-it、shiki 的输出难以保持一致。

### 现有代码的改造点

- 公开读取：已集中在基于 [usePublicReadData](../src/frontend/web-blog/app/composables/usePublicReadData.ts) 的组合函数，闪念、朋友圈和留言另有仓储接口，注入见 [repositories.ts](../src/frontend/web-blog/app/plugins/repositories.ts)。需要统一为可替换的数据源，分别对接 HTTP 和构建快照。
- 客户端切页：[nuxt.config.ts](../src/frontend/web-blog/nuxt.config.ts) 为避免预取压垮后端，关闭了 `experimental.payloadExtraction`。本机验证中打开它之后，文章详情（普通 `useAsyncData`）切页可直接读取预渲染 payload；但 `usePublicReadData` 的 `getCachedData` 只在 SSR 与首次水合时读取 payload，客户端切到归档等列表页仍会请求 `/api/v1`。静态形态需要让它在切页时也读取 payload 或快照。
- 查询参数：分页 `page`、`/gallery?photo=`、`/projects?project=`、订阅页 `currency` 和搜索页 `q/type/page`。静态托管同一路径只有一份 HTML，需要改为在客户端从快照中筛选和分页。
- 主题与语言：SSR 按 `blog-layout-theme`、`blog-locale` cookie 输出不同 HTML，SSR 缓存也按 cookie 分键。本机验证结果：主题运行时（[useThemeRuntime.ts](../src/frontend/web-blog/app/composables/useThemeRuntime.ts)）只在服务端读 cookie、水合时信任 payload，静态站每次整页加载都回到默认主题，访客选择无法保留；语言 cookie 会在水合后切换，产生水合不一致警告，并先显示一帧默认语言。
- 地址稳定：闪念和朋友圈详情使用数据库编号（`/flash/[id]`、`/moments/[id]`），文章支持数字编号和[自定义地址](../src/backend/server-main/src/entities/post-address.entity.ts)（含历史地址）。内容包迁入会重新分配编号，因此仓库格式必须携带稳定地址，否则切换部署形态会断链、丢失收录。历史地址在 EdgeOne 上受 `edgeone.json` 最多 100 条重定向的限制，超出时改为生成跳转页。
- 构建期产物：媒体目前经 `/api/v1/media/<UUID>.webp` 网关读取并按需生成宽度变体，需要改为导出时生成并改写地址，图库较大时放到 R2、COS 或 EdgeOne Blob。搜索改为构建期索引，配合已依赖的 fuse.js。sitemap 在预渲染时已能从 API 生成完整地址；RSS、Atom、JSON Feed 不在爬取范围内，需显式加入预渲染。CSP 等安全头从 Nitro `routeRules` 转写到 `_headers` 或 `edgeone.json`。动态图标若未打进客户端包（验证中 `lucide:code-xml`、`lucide:layout-template` 构建时超时），静态站没有 `/api/_nuxt_icon` 可回退，需要列入 `icon.clientBundle.icons`。
- 访客互动：文章、闪念与朋友圈的评论，以及留言、点赞和浏览量，在静态形态下关闭，或改接 Twikoo、Waline、Artalk。这些服务没有现有的审核策略、站内通知和内容关联语义，降级范围需要写入正式文档。本机验证中文章页会请求 `posts/<id>/interaction`、`posts/<id>/view`、`auth/session`、`setup/status`，失败后显示“点赞与浏览加载失败”错误卡片，静态形态需要按部署形态直接隐藏这些入口，而不是展示错误。

### 待定问题

- 主题和语言的首屏策略：固定一个主题和语言，或者为每种组合预渲染一份并用路径区分（会改变 URL 约定），或者改为客户端读取 cookie 并接受首屏闪烁。
- 仓库格式如何表达稳定地址与编号，迁入时如何保留。
- 访客互动直接关闭，还是接 Twikoo（Cloudflare Workers 与 D1）等现成服务。
- 媒体随站点部署，还是放在对象存储。
- 静态形态覆盖哪些页面，`/admin`、`/setup`、`/posts/preview` 等动态入口如何处理。

### 第一步与验收

用本机开发库导出公开快照，以 `nuxt generate` 构建首页、文章详情和归档，部署到 EdgeOne 预览域名。本机部分已于 2026-10-27 完成，结论已并入上面的改造点；EdgeOne 预览部署未做。本机三页构建共 904 个文件、11MB，其中 `_nuxt` 占 855 个、9.8MB，每个页面另有 HTML 与 payload 及其 br/gz 副本共 6 个文件；按 sitemap 的 192 个地址估算全站约 2000 个文件，在 EdgeOne 单项目 2 万个文件的限制内。验收标准：

- 主题与语言的首屏表现可以接受。
- 媒体地址全部可访问。
- 客户端切页不再请求 `/api/v1`。
- 构建产物的文件数和体积在平台限制以内。

### 外部事实

| 事实                                                                                                                                                                                                                                             | 核实 | 会变 | 来源                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EdgeOne Pages 文档现归在 EdgeOne Makers 名下。免费版每月 500 次构建、Edge Functions 300 万次、云函数（Node.js 等）100 万次；KV 与 Blob 各 1GB；单项目最多 2 万个文件，单文件最大 25MB，总存储 5GB；`edgeone.json` 最多 100 条重定向、30 条响应头 | 官方 | 是   | [配额与限制](https://pages.edgeone.ai/document/limits-and-quotas)                                                                                                      |
| Nitro 内置 EdgeOne 预设 `edgeone_pages`                                                                                                                                                                                                          | 官方 | 否   | [Nitro](https://nitro.build/deploy/providers/edgeone)                                                                                                                  |
| EdgeOne 加速区域包含中国大陆时，域名需要 ICP 备案                                                                                                                                                                                                | 摘要 | 是   | [EO 接入文档](https://cloud.tencent.com/document/product/1552/87601)                                                                                                   |
| 阿里云 ESA 提供 Pages 与边缘函数，有免费版                                                                                                                                                                                                       | 摘要 | 是   | [ESA 免费版](https://help.aliyun.com/zh/edge-security-acceleration/esa/product-overview/free-package-activities)                                                       |
| Cloudflare Pages 文档建议新项目从 Workers 起步，Pages 仍可使用                                                                                                                                                                                   | 官方 | 是   | [Pages 文档](https://developers.cloudflare.com/pages/)                                                                                                                 |
| Workers 免费版每天 10 万次请求、单次 10ms CPU、128MB 内存；D1 免费 5GB；R2 免费 10GB，出站流量不计费                                                                                                                                             | 摘要 | 是   | [Workers 套餐](https://workers.cloudflare.com/plans)、[D1](https://developers.cloudflare.com/d1/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/pricing) |
| Cloudflare Containers 已正式发布，需要付费计划                                                                                                                                                                                                   | 摘要 | 是   | [Containers 更新日志](https://developers.cloudflare.com/changelog/product/containers/)                                                                                 |
| Nuxt Content 在 Cloudflare 上做 SSR 需要 D1；纯静态部署会把内容数据库下发到浏览器                                                                                                                                                                | 官方 | 是   | [Workers 部署](https://content.nuxt.com/docs/deploy/cloudflare-workers)、[静态部署](https://content.nuxt.com/docs/deploy/static)                                       |
| Nuxt Studio 于 2026-01-05 开源为自托管模块，编辑结果提交到 GitHub 或 GitLab                                                                                                                                                                      | 官方 | 否   | [开源公告](https://content.nuxt.com/blog/studio-oss)                                                                                                                   |
| Sveltia CMS 兼容 Decap CMS 配置，不支持 Git Gateway，需要自备 OAuth                                                                                                                                                                              | 摘要 | 是   | [Sveltia CMS](https://sveltiacms.app/en/)                                                                                                                              |
| Twikoo 2.0 支持部署到 Cloudflare Workers 与 D1                                                                                                                                                                                                   | 摘要 | 是   | [Twikoo 部署文档](https://twikoo.js.org/backend)                                                                                                                       |
| LeanCloud 将于 2027-01-12 停服，依赖它的 Valine、Waline 需要迁移                                                                                                                                                                                 | 摘要 | 否   | [V2EX 讨论](https://www.v2ex.com/t/1248047)                                                                                                                            |
| Pagefind 的中文子串匹配仍有未解决的 issue                                                                                                                                                                                                        | 摘要 | 是   | [issue #987](https://github.com/Pagefind/pagefind/issues/987)                                                                                                          |
| Vercel Hobby 仅限非商业用途；Netlify 免费版改为每月 300 积分                                                                                                                                                                                     | 摘要 | 是   | [Vercel](https://deploywise.dev/blog/vercel-free-tier-limits-2026)、[Netlify](https://netli.fyi/blog/netlify-free-plan-limits-2026)                                    |
