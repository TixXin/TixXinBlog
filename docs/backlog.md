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
- 主题与语言（2026-10-27 维护者选定）：静态版在构建时由站长选定一个布局主题和一种界面语言，隐藏主题与语言切换入口，访客不能切换。不采用客户端按 cookie 切换（布局重排导致首屏闪烁和水合不一致）和用路径区分语言或主题（改变 URL 约定）。以后需要访客切换时，再用边缘函数按 cookie 返回预生成的对应版本，网址不变，与本方案兼容。

### 不采用的方案

- 单独做 Markdown 版博客：等于维护第二个产品，并丢掉后台、内容关联与版本、审核互动、媒体引用保护和备份恢复。
- 把 NestJS 与 PostgreSQL 搬上 Workers 或 EdgeOne 函数：四十多个实体、事务、持久任务、本地媒体和备份，放进免费版单次 10ms CPU、128MB 内存、无持久文件系统的运行环境等于重写。Cloudflare Containers 和 EdgeOne 云函数可以运行 Node，但需要外接 PostgreSQL、付费，并有冷启动，比一台小 VPS 更贵也更复杂。
- 只把 Nuxt SSR 放到边缘、API 留在服务器：服务器仍然存在，收益只剩 CDN。仅需国内加速时，在现有服务器前接入 EdgeOne 或阿里云 ESA 的 CDN，并按[可信代理配置](deployment.md#可信代理读取配额与媒体缓存)重新核对。
- Nuxt Content 与 Nuxt Studio：Studio 面向 Nuxt Content 站点，引入后会多出一套 Markdown 渲染管线，与现有 markdown-it、shiki 的输出难以保持一致。

### 现有代码的改造点

以下结论来自 2026-10-27 的本机验证：在验证分支 `codex/static-spike` 上以 `nuxt generate` 预渲染全站，用不提供 API 的静态服务器托管，再用 Playwright 逐类页面检查直接打开、站内切页和查询参数。

- 公开读取：已集中在基于 [usePublicReadData](../src/frontend/web-blog/app/composables/usePublicReadData.ts) 的组合函数，闪念、朋友圈和留言另有仓储接口，注入见 [repositories.ts](../src/frontend/web-blog/app/plugins/repositories.ts)。需要统一为可替换的数据源，分别对接 HTTP 和构建快照。
- 客户端切页：[nuxt.config.ts](../src/frontend/web-blog/nuxt.config.ts) 关闭了 `experimental.payloadExtraction`，`usePublicReadData` 的 `getCachedData` 也只在 SSR 与首次水合时读取 payload。验证分支打开 payload 提取，并让它在客户端非水合首读时使用 `static.data` 后，归档、项目、图库、友链、提示词、订阅、关于、标签页的直接打开与切页都不再请求数据接口；相关 20 个单测文件通过，服务器部署时 `static.data` 为空，行为不变。
- 自有仓储的列表与详情：朋友圈（[useMomentFeed](../src/frontend/web-blog/app/composables/useMomentFeed.ts)、[useMomentDetail](../src/frontend/web-blog/app/composables/useMomentDetail.ts)）、留言（[useGuestbookFeed](../src/frontend/web-blog/app/composables/useGuestbookFeed.ts)）和闪念（列表与 [overview](../src/frontend/web-blog/app/features/flash/useFlashOverviewState.ts)）不经 payload，挂载后重新请求接口。直接打开时，朋友圈列表和留言保留预渲染内容但叠加错误卡片；朋友圈详情会把已渲染的正文替换成“动态不存在”。站内切到这几页时正文为空。它们需要与 `usePublicReadData` 一样改为读取快照。
- 查询参数：首页与标签的 `page`、归档的 `year/month`、`/gallery?page=` 与 `?photo=`、`/projects?project=`、订阅页 `currency`、朋友圈与留言的 `page`、搜索页 `q/type/page`，在静态站上都会请求接口并显示错误卡片，内容停留在默认查询。分页与筛选要改为在客户端从完整快照中计算；图库与项目详情从快照中按编号取；订阅页按币种分别预生成数据。
- 中文标签、专栏与话题（现有缺陷，不限于静态形态）：`route.params` 在服务端保持百分号编码，[usePostTaxonomyRoute](../src/frontend/web-blog/app/composables/usePostTaxonomyRoute.ts) 用它与原始名称比较，中文标签与专栏返回 404（38 个标签中 27 个、6 个专栏中 5 个），朋友圈话题页标题显示为 `#%E7%94%9F…`。用当前 main 的服务器生产构建直接请求中文标签同样返回 404，客户端切页时正常。应先作为独立修复处理，静态形态依赖它才能预渲染这些页面。
- 主题与语言：已选方案 A（见结论）。验证中非默认主题 cookie 在静态站上不生效，语言 cookie 在水合后切换并产生水合不一致，因此静态版需要隐藏外观设置里的主题与语言切换。
- 地址稳定：文章使用数字编号，并支持[自定义地址](../src/backend/server-main/src/entities/post-address.entity.ts)（含历史地址）；闪念和朋友圈详情使用 UUID。内容包迁入会为文章重新分配编号，因此仓库格式必须携带文章的稳定地址，否则切换部署形态会断链、丢失收录。历史地址在 EdgeOne 上受 `edgeone.json` 最多 100 条重定向的限制，超出时改为生成跳转页。
- 构建期产物：全站引用的 64 个受管媒体（7.6MB）按原路径导出到 `api/v1/media/` 后全部可显示；HTML 中有 940 处 `?w=` 宽度变体引用，静态托管忽略查询串、返回原图，正式实现需导出变体并改写为独立文件名。订阅图标 `/api/v1/subscriptions/favicons/<哈希>.webp` 未导出，页面回退为通用图标。RSS、Atom、JSON Feed、`/flash.xml`、`/moments.xml` 显式加入预渲染后均能生成，`/api/moments.json` 尚未覆盖。CSP 等安全头从 Nitro `routeRules` 转写到 `_headers` 或 `edgeone.json`。动态图标 `lucide:github`、`lucide:code-xml`、`lucide:layout-template` 构建时加载超时，静态站没有 `/api/_nuxt_icon` 可回退，需要列入 `icon.clientBundle.icons`。
- 构建稳定性：同一构建目录上重复执行 `nuxt generate` 曾产出入口脚本缺失的页面；干净目录下首次构建又遇到一次 `@nuxt/fonts` 写入 `cache/fonts` 前目录不存在的失败，重试成功。正式流程要求每次干净构建，并在 CI 中对字体缓存失败重试或预建目录。
- 搜索：全站搜索的 6 个来源都请求接口，静态站显示“搜索加载失败”。改为构建期索引，配合已依赖的 fuse.js。
- 访客互动与身份：每个页面挂载后请求 `auth/session`，首页与后台请求 `setup/status`，文章页请求 `posts/<id>/interaction` 和 `posts/<id>/view` 并显示“文章互动状态加载失败”错误卡片；朋友圈、留言仍显示评论框与发送入口，留言输入区停在“正在确认登录状态”。友链申请表单在博主开启 `applicationsEnabled` 时渲染并提交 `/links/applications`（开发库未开启，按代码判断）。静态形态需要按部署形态直接隐藏这些入口与请求，而不是展示错误。
- 动态入口与 404：`/admin`、`/setup`、`/posts/preview` 在静态站上回退到 SPA 外壳，分别停在登录页、“暂时无法确认站点状态”和空白预览。不存在的地址回退到 `200.html` 后由客户端渲染“页面未找到”，HTTP 状态仍为 200。

### 全站验证清单

| 功能 / 页面                                                                                                  | 静态站现象                                                   | 分类                               | 建议做法                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------- |
| 首页、文章详情正文、归档、项目、图库列表、友链、提示词、关于、闪念详情、标签页（本机书签）、ASCII 标签与专栏 | 直接打开与切页内容完整，图片正常                             | 可直接静态化                       | 沿用验证分支的 payload 读取                    |
| RSS、Atom、JSON Feed、`/flash.xml`、`/moments.xml`、sitemap、robots                                          | 显式加入预渲染后生成                                         | 可直接静态化                       | 预渲染清单包含订阅地址；补 `/api/moments.json` |
| 平台订阅费                                                                                                   | 默认币种正常，`currency` 切换报错，订阅图标回退              | 需改造                             | 按币种预生成数据，导出订阅图标                 |
| 朋友圈列表、详情、话题                                                                                       | 列表叠加错误卡片，详情正文被替换为“动态不存在”，切页正文为空 | 需改造                             | 仓储改为读取快照                               |
| 留言板                                                                                                       | 内容带错误卡片，切页为空，翻页无效                           | 需改造（列表）/ 静态版隐藏（发送） | 列表读取快照，隐藏发送框与回应                 |
| 闪念列表                                                                                                     | 概览报错，切页为空                                           | 需改造                             | 列表与概览读取快照                             |
| 分页、归档年月、图库与项目详情参数                                                                           | 请求接口并报错，停在默认内容                                 | 需改造                             | 客户端基于完整快照分页筛选，详情按编号取       |
| 中文标签、专栏、朋友圈话题                                                                                   | 预渲染 404，话题标题乱码；服务器部署同样 404                 | 需改造（现有缺陷）                 | 先单独修复参数解码                             |
| 全站搜索                                                                                                     | 6 个来源全部失败                                             | 需改造                             | 构建期索引加 fuse.js                           |
| 受管媒体                                                                                                     | 原图可显示，宽度变体返回原图                                 | 需改造                             | 导出宽度变体并改写文件名                       |
| 文章点赞、浏览量，评论，朋友圈与闪念评论                                                                     | 错误卡片或可输入但无法提交                                   | 静态版隐藏                         | 按部署形态移除入口与请求                       |
| 登录状态、初始化状态请求                                                                                     | 每页 404                                                     | 静态版隐藏                         | 静态形态不发请求                               |
| 友链申请                                                                                                     | 开启时会渲染表单并提交接口                                   | 静态版隐藏                         | 静态形态强制不渲染                             |
| 主题、语言切换                                                                                               | cookie 不生效或水合不一致                                    | 静态版隐藏                         | 方案 A，构建时固定                             |
| `/admin`、`/setup`、`/posts/preview`                                                                         | 停在登录页、初始化报错或空白                                 | 放弃                               | 静态产物不包含这些路由，后台只在写作端运行     |
| 未知地址                                                                                                     | 回退 `200.html`，状态 200                                    | 需改造                             | 输出真实 404 页面并按平台配置 404              |

### 待定问题

以下为基于验证数据的建议，均待维护者确认。

- 稳定地址：闪念与朋友圈已用 UUID，可直接作为仓库中的地址；文章用自定义地址，没有时用当前数字编号写入仓库并在迁入时保留，历史地址一并导出。建议仓库格式以“地址”而非数据库编号为主键（待维护者确认）。
- 访客互动：建议第一版全部隐藏，不接第三方。需要隐藏的入口已列在清单中，涉及文章、闪念、朋友圈、留言四处；接 Twikoo 需重做审核与通知，可在第一版之后单独评估（待维护者确认）。
- 媒体位置：全站受管媒体 64 个、7.6MB，导出宽度变体后估计不超过数十 MB，单文件最大 584KB，建议第一版随站点部署，图库超过平台总存储的一定比例时再迁对象存储（待维护者确认）。
- 页面范围：建议静态产物包含清单中“可直接静态化”和“需改造”的全部公开页面，不包含 `/admin`、`/setup`、`/posts/preview`，并由平台返回真实 404（待维护者确认）。

### 第一步与验收

用本机开发库导出公开快照，以 `nuxt generate` 构建并部署到 EdgeOne 预览域名。本机部分已完成，结论已并入上面的改造点与清单；EdgeOne 预览部署未做。全站预渲染 201 个地址（含 7 个订阅与索引文件），产物共 1958 个文件、48MB（不计 br/gz 副本 774 个），其中 `_nuxt` 866 个、9.9MB，受管媒体 64 个、7.5MB，最大单文件 584KB，在 EdgeOne 单项目 2 万个文件、单文件 25MB 的限制内。验收标准：

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
