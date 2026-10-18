# API 契约

业务 API 的统一前缀为 `/api/v1`。浏览器通过 Nuxt 同源网关访问；后端连通性使用 `/health` 与 `/ready`，其中就绪检查包含数据库连接状态。以下路径省略业务前缀。

本文列出后端控制器声明的全部路由；精确字段、默认值和限制以[当前控制器与 DTO](../src/backend/server-main/src/modules/)为准。前端类型位于 `src/frontend/web-blog/app/features/<domain>/`，不从旧设计或示例响应推导新字段。

路由以行内代码 `方法 /路径` 列出，允许 `GET/POST` 等方法合写；参数名与控制器一致，查询参数另行说明，不用领域占位符省略接口。后端 `src/api-documentation.spec.ts` 递归读取控制器装饰器元数据，双向检查文档遗漏和已不存在的路由；随 `corepack pnpm --filter server-main test` 运行，无需启动应用或连接数据库。此检查仅覆盖声明的 HTTP 方法与路径，不校验 DTO、权限、响应字段或框架隐式提供的 HEAD/OPTIONS。

## 健康与开发探针

| 方法与路径          | 作用                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /health`       | 存活探针，无 `/api/v1` 前缀                                                                                        |
| `GET /ready`        | 就绪探针，无 `/api/v1` 前缀；数据库不可用或服务正在关闭时返回 503                                                  |
| `GET /dev/identity` | 实际地址为 `/api/v1/dev/identity`，仅 development 环境且来自 loopback 地址时提供开发实例归属信息，其余情况返回 404 |

## 响应、身份与错误

普通 JSON 成功响应：

```json
{ "code": 0, "message": "ok", "data": {}, "traceId": "request-trace" }
```

错误使用对应 HTTP 状态，响应为 `{ code, message, data: null, traceId }`，完整码表见[附录 A](#附录-a统一响应错误码)。图片、内容包下载和订阅使用各自的文件格式，不套 JSON envelope。不要只看 HTTP 是否完成或 `data` 是否为空来推断成功；保留 `traceId` 便于定位，日志不应包含令牌或正文。

| HTTP 状态 | 客户端处理                                                 |
| --------- | ---------------------------------------------------------- |
| 400       | 参数、长度、来源或业务约束不满足；保留输入并提示具体问题   |
| 401 / 403 | 登录失效或权限不足；恢复身份后重新读取当前状态             |
| 404       | 不存在或当前身份不可见，不泄露私有记录状态                 |
| 409       | 内容版本、提交标识、票据或内容代次冲突；核查原结果后合并   |
| 428       | 缺少恢复后要求的内容上下文；重新读取上下文                 |
| 429       | 请求限流；按反馈稍后重试，不切换访客标识规避限制           |
| 5xx       | 保留已知数据和未保存输入，提供重试，不以 Mock 或假零值替代 |

管理接口使用 `Authorization: Bearer <accessToken>`。访问令牌由前端内存持有，刷新令牌使用 HttpOnly Cookie，生产 Cookie 带 Secure；状态变更同时遵循同源/Origin 校验。`X-Visitor-Id` 是设备访客标识，服务端将其哈希后使用；客户端昵称、头像或博主字段不能授予管理权限。

读取站点时取得 `X-Content-Context`，管理及要求该保护的公开写入附带当前值。完整恢复/重建会轮换内容代次，旧页面必须重新读取，即使账号重新登录也不能继续提交旧上下文。

| 认证入口                                                         | 行为                                  |
| ---------------------------------------------------------------- | ------------------------------------- |
| `POST /auth/login`                                               | 管理员登录，建立持久会话与刷新 Cookie |
| `POST /auth/refresh`                                             | 轮换刷新凭据与访问令牌                |
| `POST /auth/logout`                                              | 撤销当前授权并清除 Cookie             |
| `GET /auth/me`、`GET /auth/session`                              | 当前身份与会话状态                    |
| `GET /auth/sessions`                                             | 当前账号会话列表                      |
| `DELETE /auth/sessions/:id`、`POST /auth/sessions/revoke-others` | 撤销指定或其他会话                    |
| `POST /auth/password`                                            | 修改密码，沿用账号与会话版本保护      |

认证实现见[auth](../src/backend/server-main/src/modules/auth/)。审计保留操作者、动作、字段摘要和结果，不复制敏感正文或凭据；写入结果不确定时保留相应状态。

## 写入版本与幂等

支持版本的记录在 PATCH/DELETE 时使用读取到的 `revision`，省略字段表示保持原值；只有契约允许时才使用 `null` 或空字符串清空。版本冲突不能自动覆盖。图库、项目、友链、图片提示词、平台订阅费与朋友圈的创建使用 UUID v4 `requestId`；相同标识和规范化输入返回原记录，不同输入或已删除提交返回冲突。

未知创建结果可用对应 `/admin/<domain>/submissions/:requestId` 查询。删除保留必要提交墓碑，迟到请求不能复活内容。其他领域的提交/重试字段依其 DTO，不把某个域的标识强加到全部接口。

目标状态操作与切换操作不同：朋友圈点赞是 `PUT { liked }`，留言回应是 `PUT { emoji, reacted }`；文章和闪念的点赞仍使用各自的 POST 切换入口，不能把切换请求当作任意重试都安全的设置操作。

### 访客文本提交防垃圾

`POST /posts/:id/comments`、`POST /guestbook`、`POST /flashes/:id/comments`、`POST /moments/:id/comments` 共用以下可选请求字段，文章评论回复与留言回复同样适用：

- `website`：蜜罐字符串，正常表单发送空字符串。任何非空值（包括纯空白）均拒绝，不做去空白处理；非字符串和 `null` 也不接受。
- `formElapsedMs`：表单在客户端挂载或重新打开后到提交经过的毫秒数，前端用 `performance.now()` 单调时钟计算，不依赖设备时间。提供时须为安全整数，且不小于 1000、不大于 2592000000（30 天）；不足 1000 毫秒、超过上限或非法值均拒绝。前端上报前把超过上限的时长截断为上限。成功提交后前端重新开始计时，失败保留原输入与已有提交标识。
- `formRenderedAt`：旧客户端发送的渲染时间戳，为兼容仍接受；只校验为正的安全整数，不再与服务器时间比较。

蜜罐与时间校验失败统一返回 HTTP 400，沿用错误 envelope（`data: null`），提示“提交未完成，请稍后重试”，不说明具体命中规则；请求不会进入业务写入，也不会生成记录、计数或通知。选择通用错误而非伪造成功记录，是为了避免前端接受不存在的编号、丢失草稿或污染幂等结果。其他参数、身份、来源、限流和内容上下文校验仍沿用原有错误行为。

旧客户端可省略上述字段；后台博主直接回复接口不使用这套字段。前端蜜罐不参与布局，对读屏隐藏且不可聚焦，关闭自动填充；字段不写入数据库或本地草稿、不参与已有幂等摘要，SSR 缓存不保存表单计时起点。这是辅助防垃圾机制，可被主动省略字段或伪造时长的客户端绕过，不能替代现有身份、限流与审核。时长由客户端单调时钟计算，设备时间与服务端不一致不会导致拒绝。

## 文章、目录、评论与闪念

| 方法与路径                                                                                   | 作用                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `GET /posts`、`GET /posts/metadata`                                                          | 公开列表、搜索、分页与真实目录聚合         |
| `GET /posts/archive`                                                                         | 按 UTC 年月筛选的稳定分页归档              |
| `GET /posts/:id`、`GET /posts/by-slug/:slug`                                                 | 公开文章详情及地址解析                     |
| `GET /posts/:id/navigation`                                                                  | 前后文章，支持 `scope=all/folder/auto`     |
| `GET /posts/:id/related`                                                                     | 规则相关文章                               |
| `POST /posts/:id/like`、`POST /posts/:id/view`                                               | 访客点赞切换与去重浏览计数                 |
| `GET /posts/:id/interaction`                                                                 | 当前访客互动状态，私有且不缓存             |
| `GET/POST /posts/:id/comments`、`POST /comments/:id/like`                                    | 文章评论、回复与点赞                       |
| `GET/POST /admin/posts`、`GET/PATCH/DELETE /admin/posts/:id`                                 | 管理列表、创建、版本化编辑及回收           |
| `GET /admin/posts/filters`                                                                   | 管理列表可用的专栏与标签筛选项             |
| `GET /admin/posts/:id/revisions`、`GET /admin/posts/:id/revisions/:revision`                 | 修订列表与具体快照                         |
| `POST /admin/posts/:id/revisions/:historical/restore`、`POST /admin/posts/:id/restore`       | 恢复历史内容或回收记录                     |
| `POST /admin/posts/batch/preview`、`POST /admin/posts/batch/execute`                         | 明确编号及版本的批量预览和执行             |
| `GET /admin/posts/batch`、`GET /admin/posts/batch/:ticket`                                   | 最近批量任务及原票据结果                   |
| `POST /admin/posts/:id/preview-link`                                                         | 为未删除草稿签发 7 天预览链接              |
| `GET /posts/preview`                                                                         | 校验签名后读取最新已保存草稿               |
| `GET /admin/taxonomy`                                                                        | 专栏和标签                                 |
| `POST /admin/taxonomy/:kind`、`PATCH/DELETE /admin/taxonomy/:kind/:id`                       | 新增、重命名和删除专栏或标签               |
| `GET /admin/comments`、`GET/PATCH /admin/comments/policy`                                    | 评论管理与版本化审核策略                   |
| `GET /admin/comments/articles`、`GET /admin/comments/:id/context`                            | 评论所属文章选项与目标评论上下文           |
| `POST /admin/comments/:id/moderation`、`POST /admin/comments/:id/reply`                      | 影响范围确认后的审核与博主直接回复         |
| `DELETE /admin/comments/:id`                                                                 | 校验影响范围指纹后的单条及级联回复删除     |
| `POST /admin/comments/batch/moderation`、`POST /admin/comments/batch/delete`                 | 按版本逐条校验的批量审核与删除             |
| `GET /flashes`、`GET /flashes/search`、`GET /flashes/:id`                                    | 公开闪念列表、筛选、搜索及详情             |
| `GET /flashes/overview`                                                                      | 侧栏聚合与访客已赞，私有不缓存             |
| `POST /flashes/:id/like`、`POST /flashes/:id/comments`                                       | 闪念互动                                   |
| `GET/POST /admin/flashes`、`GET/PATCH/DELETE /admin/flashes/:id`                             | 博主闪念管理                               |
| `DELETE /admin/flashes/:id/comments/:commentId`                                              | 删除指定闪念评论                           |
| `GET /admin/flashes/comments`、`PATCH /admin/flashes/:id/comments/:commentId`                | 跨闪念评论审核列表与单条通过/隐藏          |
| `POST /admin/flashes/comments/batch/moderation`、`POST /admin/flashes/comments/batch/delete` | 按提交状态逐条校验的闪念评论批量审核与删除 |

文章公开列表只读取列表所需字段，正文检索仍由后端执行。

`GET /posts/:id/navigation` 接受可选 `scope`：省略或 `all` 保持全站顺序，`folder` 只查询当前文章所属专栏，`auto` 先查同专栏、专栏两侧均为空（或文章无专栏）时在同一请求内回退全站，其他值返回 400。查询参数按 DTO 白名单校验（全局 `forbidNonWhitelisted`），除 `scope` 外携带任何其他查询参数（如统计或缓存用的附加参数）同样返回 400，调用方不要追加未声明的参数。响应为 `{ prev, next }`，每侧为文章摘要或 `null`；`auto` 另带 `fallback`，`true` 表示结果来自全站。仅包含已发布且未回收文章，当前文章不可公开时返回 404。沿用发布时间、编号倒序的列表顺序：`prev` 是较新的最近一篇，`next` 是较旧的最近一篇，同发布时间按编号区分。`folder` 模式下当前文章无专栏或专栏内无其他公开文章时返回双 `null`，接口自身不回退全站。文章详情页使用 `auto`：数字地址与详情并行请求，自定义地址在详情解析出编号后请求；`fallback` 为 `false` 且文章有专栏时按详情的专栏名标注，否则不标注。专栏内只有一侧有相邻文章时保留另一侧为空；请求失败显示加载错误，不当作空结果。

评论与留言批量接口请求体为 `items: [{ id, revision }]`（1–100 条、编号不重复），审核另带 `status`；评论用 `POST`，留言用 `PATCH/DELETE`（删除的 JSON 体同样放 `items`）。整批在单个事务内执行，逐条校验版本：不存在或版本已变化的项跳过并在 `results[].reason` 返回 `not_found`/`conflict`，其余项照常生效；响应含 `successCount/failedCount`，评论删除另含级联回复在内的 `deleted`。批量审核只改选中项自身状态，以版本号代替单条接口的影响范围指纹；整批记一条汇总审计，评论使用 `comment.batch.moderate` / `comment.batch.delete`，留言使用 `guestbook.batch.moderate` / `guestbook.batch.delete`，后台显示对应的“批量审核/删除评论/留言”标签，部分失败记为 partial。已有单条动作和历史审计记录保持原有含义，不回填历史批量记录。

`POST /admin/posts/:id/preview-link` 只接受已登录管理员和当前内容上下文，不为已发布、已归档或已回收文章签发。响应是 `{ token, expiresAt }`：`expiresAt` 为签发后 7 天的 ISO UTC 时间。令牌是无状态 HMAC，由部署访问密钥 `JWT_ACCESS_SECRET` 派生出用途专用密钥后签名，不写入数据库，也不进入审计摘要或访问日志。载荷只绑定文章编号、当时的内容代次和到期时间，不绑定修订号。因此保存修改后旧链接仍然有效，直到到期，并返回最新已保存的正文；重新签发不会撤销此前的链接。发布、归档、回收，或完整恢复/重建轮换内容代次，以及轮换 `JWT_ACCESS_SECRET`，都会使旧链接失效。

`GET /posts/preview` 通过查询参数 `token` 传递签名，公开读取，不需要登录，也不接受访客身份。签名、格式、到期、代次不匹配或文章已不可预览时统一返回 404，文案为「预览链接无效或已过期」，不区分原因。成功时沿用公开详情投影，并强制 `commentEnabled: false`、`seoNoindex: true`；不增加浏览、不写入点赞，评论接口对草稿保持拒绝。成功与失败响应都带 `Cache-Control: private, no-store`、`X-Robots-Tag: noindex, nofollow, noarchive` 和 `Referrer-Policy: no-referrer`。日志只记录请求路径，不含查询字符串，来源地址整体脱敏。前台页面为 `/posts/preview`，顶部标明「预览，尚未发布」，不收录、不统计、不开放评论。

`GET /posts/:id` 与 `GET /posts/by-slug/:slug` 返回公开详情：`tags` 与列表同为 `{ label, color }` 数组；`updatedAt` 是内容最后修订时间（当前修订快照的写入时间，早于发布时间或缺少快照时取发布时间），不随浏览、点赞或评论计数变化，用于 `dateModified`、`article:modified_time` 与站点地图 `lastmod`。有 Markdown 原文时只返回 `contentRaw`，不再返回结构化 `content`；没有原文的旧文章仍返回 `content` 供结构化渲染。`toc` 始终由结构化正文中的标题生成。摘要为空时额外返回 `excerpt`（首个正文段落前 160 字）作为描述兜底。

`GET /posts/:id/related` 返回最多 4 项的数组，每项仍为 `{ id, slug, title, category, date }`（`id` 为字符串、`category` 为专栏、`date` 为 ISO UTC）。来源必须已发布且未回收，否则返回 404；候选同样仅含公开文章并排除来源自身。优先推荐有共同标签的文章，按 `(共同标签数 × 3 + 同专栏加 2 分) / (1 + 发布年龄天数 / 180)` 降序排列；标签按编号去重，发布年龄以查询时刻计算，未来日期按 0 天处理。相同分数按发布时间、编号倒序。标签推荐不足 4 篇时，用尚未入选的同专栏最新文章补齐；仍不足则返回实际数量，不补入跨专栏且无共同标签的文章。该排序不影响人工维护的 `relatedContent`。

`POST /posts/:id/view` 按访客每整点小时去重计数，响应 `{ views, likes, liked, counted }`（私有、不缓存）：`counted` 表示本次是否计入，`likes/liked` 与 `GET /posts/:id/interaction` 同口径，文章页挂载后一次请求即可同步计数与点赞状态；计数失败时前端再回退到 `interaction`。评论可见性需要同时考虑所属文章、祖先、审核和删除状态；缓存计数与公开聚合遵循相同口径。专栏重命名与引用同步在事务内完成，仍被引用的目录项不能直接删除。

`GET /posts/metadata` 保持旧完整响应：`tags/categories/stats/activity/archive`。`includeArchive` 默认为 `true`，只接受 `true` 或 `false`；显式 `false` 返回轻量 `tags/categories/stats/activity`，不查询或返回全量归档。完整模式的 `archive` 项与 `GET /posts/archive` 字段相同（含 `updatedAt`）。公开页面与主题侧栏使用轻量模式，服务端 sitemap 继续使用完整模式、过滤 `seoNoindex` 并以 `updatedAt` 作为文章 `lastmod`。

`GET /posts/archive` 接受可选 `year`（1–9999）、`month`（1–12，必须同时提供有效 `year`）、`page`（默认 1，最大 1000000）、`pageSize`（默认 50，最大 100），非法 API 参数返回 400，仅返回已发布且未回收文章。响应为 `{ items, total, page, pageSize, years }`；`items` 每项包含 `id/slug/seoNoindex/title/folder/date/updatedAt`（`updatedAt` 口径同文章详情），按 `published_at DESC, id DESC` 排序，日期为 ISO UTC。`total` 是当前年月筛选后的总数，`years` 是所有公开年份的 `{ year, count }` 数组，按 UTC 年份倒序；年月过滤在分页前执行，列表、总数与年份计数来自同一查询快照。空时间段或越界页返回空 `items`，保留真实总数和全部年份计数。

归档页面沿用查询参数地址：`/archive?year=2026` 分享全年，`/archive?year=2026&month=3` 分享该年该月，`&page=2` 访问下一页；每页只渲染 50 条，不累计历史页 DOM。SSR 直接读取对应年月分页，标题和 canonical 同步区分年月及非首页页码，canonical 省略第一页与无关参数。年份选择切回该年全年，月份选择回到第一页，翻页保留年月。页面 URL 的非法筛选沿用归一规则：非法年份忽略，缺少年份或非法月份忽略月份；有效数字去除前导零后用于 API 和 canonical，不改变原链接的可访问性。

批量任务绑定具体 ID、版本和影响范围，有执行期限及逐项结果；重复执行查询原结果。软删除与发布状态分开，永久删除需确认关联集合。媒体不会因删除文章而直接从磁盘移除。

`GET /flashes` 接受 `page`（默认 1）、`pageSize`（默认 20，最大 100）及可任意组合的筛选：`tag`（标签精确匹配）、`type`（`idea`/`todo`/`memo`）、`date`（`YYYY-MM-DD`，按 UTC 日）、`from`/`to`（`YYYY-MM-DD`，含首尾的 UTC 日范围，与 `date` 同时出现取交集）；日期须为真实存在的公历日，非法参数返回 400。`GET /flashes/search` 另需 `q`（1–200 字），匹配正文或任一标签包含关键词（不区分大小写，`%`/`_` 按字面处理），并可与上述筛选组合。列表与搜索只返回本站已发布、未归档的闪念，均按置顶优先、`createdAt` 倒序、编号倒序稳定分页，响应为 `{ items, total, page, pageSize }`，`total` 为筛选后的总数；带 `X-Visitor-Id` 时 `items[].liked` 反映该访客的点赞状态。

`GET /flashes/overview` 一次返回闪念页侧栏所需的聚合，全部由数据库聚合或限量查询得到、只读：`total`（公开总数）、`monthCount`（当前 UTC 自然月新增）、`dates`（有闪念的 UTC 日期 `{ date, count }`，日期倒序，覆盖全部历史以支持日历翻月与连续天数）、`tags`（`{ name, count }`，次数倒序、同次数按名称）、`onThisDay`（UTC 月日与今天相同且年份更早的最近一条，无则 `null`）、`recollections`（随机抽取的最多 12 条回顾）与 `likedIds`（当前访客已点赞的公开闪念编号，未带 `X-Visitor-Id` 时为空数组）。`onThisDay` 与 `recollections` 只含 `{ id, content, createdAt }`，`content` 截取前 300 字。响应按访客区分，`Cache-Control: private, no-store`；限流与其他公开读取接口相同。公开闪念页 SSR 直出第一页列表，挂载后读取概览补齐侧栏与首屏个人点赞状态，类型、日期、标签与关键词筛选均走后端分页。

闪念评论与文章、朋友圈评论共用站点评论策略（`/admin/comments/policy`）：`POST /flashes/:id/comments` 在开启先审后发时创建 `pending` 评论，否则为 `published`，响应带 `moderationStatus`（`published`/`pending`/`hidden`，与朋友圈评论同名同取值），并按状态写入 `flash-comment` 站内通知（`pending_review`/`new_comment`）。公开列表、搜索与详情的 `comments` 只返回已发布评论，以及携带 `X-Visitor-Id` 时该访客本人提交的待审评论（仅提交者本机可见，SSR 匿名读取不含待审）；`commentCount` 只计已发布评论。隐藏评论不公开。存量评论与旧内容包迁入的评论按已发布处理。

`GET /admin/flashes/comments` 接受 `status`（`all`/`published`/`pending`/`hidden`，默认 `all`）、`page`、`pageSize`（默认 20，最大 100）和用于通知跳转的 `commentId`，按提交时间倒序返回 `{ items, total, page, pageSize }`，每项含评论字段、`moderationStatus` 及所属闪念 `flashId/flashContent/flashStatus`。单条审核 `PATCH /admin/flashes/:id/comments/:commentId` 请求体为 `{ status, expectedStatus }`，当前状态既不是 `expectedStatus` 也不是目标状态时返回 409。批量接口请求体为 `items: [{ id, expectedStatus }]`（1–100 条、编号不重复），审核另带 `status`；整批单事务、逐条锁行校验，不存在或不属于本站闪念的项返回 `not_found`，状态已变化的项返回 `conflict`，其余照常生效；删除与单条一致为物理删除，媒体引用随外键清理。审计动作分别为 `flash.comment.moderate`、`flash.comment.delete`、`flash.comment.batch.moderate`、`flash.comment.batch.delete`；闪念本身的写入仍记为 `flash.write`。

源码入口：[post](../src/backend/server-main/src/modules/post/)、[comment](../src/backend/server-main/src/modules/comment/)、[flash](../src/backend/server-main/src/modules/flash/)。

## 朋友圈

| 方法与路径                                                       | 作用                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `GET /moments`                                                   | `page/pageSize/q/topic/date`；每页最大 50 条     |
| `GET /moments/overview`                                          | 公开动态、评论、点赞、话题、日期、照片与回顾聚合 |
| `GET /moments/:id`、`GET /moments/:id/navigation`                | 公开详情与按时间排列的前后动态                   |
| `GET/POST /moments/:id/comments`                                 | 分页评论与访客提交；可见自己的待审评论           |
| `PUT /moments/:id/like`                                          | 设置目标点赞状态                                 |
| `GET/POST /admin/moments`、`GET/PATCH/DELETE /admin/moments/:id` | 管理、版本化编辑和创建去重                       |
| `GET /admin/moments/submissions/:requestId`                      | 核查未知创建结果                                 |
| `GET /admin/moments/comments`                                    | 跨动态分页管理评论                               |
| `GET/POST /admin/moments/:id/comments`                           | 管理评论与博主回复                               |
| `GET /admin/moments/:id/comments/:commentId/location`            | 定位指定评论所在分页                             |
| `PATCH/DELETE /admin/moments/:id/comments/:commentId`            | 审核与删除；审核使用目标和 `expectedStatus` 比较 |

状态为 `draft/published/archived`，公开入口排除非公开和删除项。列表默认按置顶、发布时间、创建时间、ID 倒序；`pinnedFirst=false` 用于纯时间订阅。UTC 日期为 `YYYY-MM-DD`，筛选使用半开区间。

评论按动态、服务端访客身份和 `requestId` 去重，隐藏/删除后的旧提交不能重新公开。编辑可以保留已失效的原文章关系，新关系只允许可选择目标；公开投影不泄露私有文章，引用文章只读取卡片所需的标题、摘要、封面、地址与可见性列，不读取正文。`GET /moments/overview` 的 `dates` 包含全部有公开动态的 UTC 日期（日历可翻到任意历史月份并计算连续天数），`recollections` 不含引用文章。源码见[moment](../src/backend/server-main/src/modules/moment/)。

## 留言

| 方法与路径                                                           | 作用                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /guestbook`                                                     | `q/date/pageSize/before`，默认 20、最大 50；公开及当前访客自己的待审内容 |
| `GET /guestbook/metadata`、`GET /guestbook/:id`                      | 真实聚合、规则与经过可见性处理的单条引用                                 |
| `POST /guestbook`                                                    | `requestId/content/author`，可选 `avatar/replyToId`                      |
| `PUT /guestbook/:id/reactions`                                       | 设置目标回应状态                                                         |
| `GET/POST /admin/guestbook`、`GET/PATCH/DELETE /admin/guestbook/:id` | 博主分页、回复、审核、隐藏、置顶与软删除                                 |
| `PATCH/DELETE /admin/guestbook/batch`                                | 按版本逐条校验的批量审核与软删除                                         |

正文最多 500 字符，昵称最多 32 字符；状态为 `published/pending/hidden`。公开游标包含创建时间、编号及筛选指纹，翻页期间的新留言不会改变向旧记录翻页的边界。后台使用页码分页。

回复只指向公开留言；父留言后来隐藏或删除时，公开回复保留并返回 `replyUnavailable`，移除引用正文与作者。公开置顶最多一条，切换置顶会更新受影响版本。访客留言记录 `browser`（由 User-Agent 解析的“家族 主版本”）与 `region`（仅采信可信代理注入的 `CLIENT_REGION_HEADER`，默认 `x-client-region`），只用于展示，服务端不做 IP 地理查询；博主回复同样记录，早于该字段的旧记录为空。没有在线或已读字段。源码见[guestbook](../src/backend/server-main/src/modules/guestbook/)。

## 图库、项目与友链

三个领域的公开列表默认每页 12、最大 48，非公开/删除记录不返回管理状态、版本、提交标识或存储键。

| 方法与路径                                                         | 作用                                     |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `GET /gallery`、`GET /gallery/metadata`、`GET /gallery/:id`        | 公开图库列表、聚合与详情                 |
| `GET/POST /admin/gallery`、`GET/PATCH/DELETE /admin/gallery/:id`   | 管理图库列表、幂等创建、版本化编辑与删除 |
| `GET /admin/gallery/submissions/:requestId`                        | 核查图库创建结果                         |
| `GET /projects`、`GET /projects/metadata`、`GET /projects/:id`     | 公开项目列表、聚合与详情                 |
| `GET/POST /admin/projects`、`GET/PATCH/DELETE /admin/projects/:id` | 管理项目列表、幂等创建、版本化编辑与删除 |
| `GET /admin/projects/submissions/:requestId`                       | 核查项目创建结果                         |
| `GET /links`、`GET /links/metadata`、`GET /links/:id`              | 公开友链列表、聚合与详情                 |
| `GET/POST /admin/links`、`GET/PATCH/DELETE /admin/links/:id`       | 管理友链列表、幂等创建、版本化编辑与删除 |
| `GET /admin/links/submissions/:requestId`                          | 核查友链创建结果                         |

| 领域 | 查询与约束                                                                                |
| ---- | ----------------------------------------------------------------------------------------- |
| 图库 | `q/category/page/pageSize`；省略 category 为全部，空值为未分类；`sortOrder DESC, id DESC` |
| 项目 | `q/progress/tag/page/pageSize`；标签忽略大小写，`sortOrder DESC, id DESC`                 |
| 友链 | `q/featured/page/pageSize`；推荐优先，再按排序值和 ID 倒序                                |

图库 `mediaId/externalUrl` 必须恰有一个有效来源，切换时明确将另一字段设为 `null`。外链接受完整 HTTP(S)，但浏览器 CSP/HTTPS 可能阻止 HTTP 显示；外链不产生媒体资产、远端请求或伪造尺寸。可识别的受管媒体地址必须用媒体 UUID 关联。`takenOn` 只接受有效手工日期，未知则为空。`GET /gallery/:id/navigation` 按同一过滤和排序定位所在页及相邻作品，筛选外目标返回 `matched=false`。器材由 `GET/PATCH /admin/gallery/settings` 独立版本化管理。

项目发布状态为 `draft/published/withdrawn`，进展为 `active/dev/archived`，两者独立。技术标签最多 20 项，按名称去空白、小写去重并保留首项写法/颜色；链接最多 4 种 `source/demo/docs/download`，同用途不能重复。技术覆盖率来自使用该标签的公开项目比例，可重叠，不是语言占比。没有外部 Star/Fork 自动同步。

友链普通创建/改址检查全部未删除记录的规范 URL，同址冲突返回 400；内容包允许明确复制同址草稿，但同一 URL 最多有一条公开记录。URL 规范协议、主机与默认端口，保留路径大小写、尾斜杠、查询参数顺序/重复值和片段。Logo 可为空，受管媒体与外部 HTTPS 来源互斥。`GET/PATCH /admin/links/settings` 保存最多 12 条独立规则，每条最多 300 字符。

以上外部地址均拒绝凭据、控制字符、空白、反斜杠和危险协议；服务端只校验和保存，不抓取站点或图片。文本长度遵循 DTO 与浏览器 maxlength 的 UTF-16 计数，超限拒绝，不截断后悄悄保存。源码见[gallery](../src/backend/server-main/src/modules/gallery/)、[project](../src/backend/server-main/src/modules/project/)、[link](../src/backend/server-main/src/modules/link/)。

## 图片提示词

公开 `GET /prompts`、`GET /prompts/metadata` 与 `GET /prompts/:id` 只返回 `published` 内容。列表支持 `q/model/tag/page/pageSize`，默认每页 12、最大 48，按 ID 倒序；模型和标签匹配忽略大小写。统计与筛选项仅根据已公开内容计算。

博主使用 `GET/POST /admin/prompts`、`GET/PATCH /admin/prompts/:id`；列表额外支持 `status=all|draft|published`。创建须带 UUID v4 `requestId`，未知结果用 `GET /admin/prompts/submissions/:requestId` 核查；编辑必带当前 `revision`，冲突返回 409，不自动覆盖。管理写入沿用来源、认证与内容上下文保护。

标题最多 160、创作笔记 2000、完整提示词 30000、负面提示词 10000、模型 80、图片替代文本 240 个 UTF-16 单位。标签最多 12 项，每项最多 32，去首尾空白并忽略大小写去重。来源地址最多 2048，可为空。图片 `mediaId/externalImageUrl` 必须恰好选一，切换时显式将另一字段设为 `null`。外链沿用图库地址校验，不抓取远程资源；受管图片持有正式媒体引用。源码见 [prompts](../src/backend/server-main/src/modules/prompts/)。

## 平台订阅费

| 方法与路径                                                                   | 作用                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /subscriptions`、`GET /subscriptions/stats`、`GET /subscriptions/:id`   | 公开记录、全部匹配记录的分币种统计及详情              |
| `GET /subscriptions/favicons/:key`                                           | 读取已缓存的 favicon 图片                             |
| `GET/POST /admin/subscriptions`、`GET/PATCH/DELETE /admin/subscriptions/:id` | 管理列表、幂等创建、版本化编辑与软删除                |
| `GET /admin/subscriptions/submissions/:requestId`                            | 核查原创建结果，不复活已删除提交                      |
| `PATCH /admin/subscriptions/sort`                                            | 显式编号、目标排序值及 revision 的事务更新            |
| `POST /admin/subscriptions/fetch-favicon`                                    | 管理员触发受限 favicon 代理；不抓取任意官网或图片地址 |

列表支持 `q/category/currency/subscriptionStatus/page/pageSize/sort`，默认每页 12、最大 48；管理端另有 `status=all|draft|published|withdrawn`。公开接口仅返回 published 且未删除记录，使用白名单排除管理备注、发布状态、revision 和提交身份。金额排序按币种分组，统计覆盖全部匹配记录，与分页无关。

`amount` 为币种最小单位的非负整数，上限 2147483647；支持 CNY、USD、EUR、GBP、JPY、HKD、TWD。JPY 无小数位；不同币种从不直接合计。`billingCycle` 为 monthly/quarterly/yearly/lifetime/one-time，`subscriptionStatus` 为 active/paused/cancelled/trial/expired，后者与发布 `status` 独立。active、已开始的月/季/年付记录进入当前预算；一次性、买断和其他状态不重复计费。日期为真实 `YYYY-MM-DD`，未知留 null，不读取时自动推进逾期日期。

`priceHistory` 由服务端创建初始事件并在价格、币种或周期变化时原子追加；普通 PATCH 禁止覆盖历史和系统字段，未传字段保持原值。`priceChangeReason` 可说明此次变化，不改变价格的文字编辑不新增事件。历史事件包含 id、effectiveAt、recordedAt、amount、currency、billingCycle、可选 reason；内容包通过专门校验保留真实历史。

`iconMediaId` 使用 UUID 关联并受媒体引用保护；自动 favicon 只把规范官网域名交给固定供应商，浏览器读取本站缓存地址。私网/保留出站地址、重定向、超时、超大或非图片响应被拒绝；抓取失败不阻止订阅保存。访客本地模式不调用此写入接口，不将记录上传后端。源码见 [subscription](../src/backend/server-main/src/modules/subscription/)，计算规则见 [共用领域包](../src/shared/subscription-domain/)。

## 站点、媒体、运营与维护

| 入口                                                                                  | 契约                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /site`                                                                           | 公共站点资料，剔除隐藏关于字段与隐藏外链，不缓存；提供内容上下文 |
| `GET/PATCH /admin/site`、`GET /admin/site/revisions`                                  | 完整资料、版本化保存与历史                                       |
| `GET /admin/site/revisions/:revision`、`POST /admin/site/revisions/:revision/restore` | 读取指定历史版本与恢复资料                                       |

站点资料含可选的 `presenceLabel`（≤20）、`presenceSignature`（≤60）、`presenceStatus`（空串、`online`、`idle`、`busy`）与 `launchedAt`（`YYYY-MM-DD` 或空）：前两者驱动名片的在线状态与签名，都为空时保持离线；`presenceStatus` 决定状态点的类型，空串时按在线展示；`launchedAt` 决定 `GET /posts/metadata` 里 `stats.siteAgeDays` 的起点，缺省回退到最早公开文章的发布日。旧客户端与旧内容包可不携带这几项，缺省按空串处理且保存时沿用当前值。

站点资料还包含 `navigation`（`{ type: 'route', key, visible }` 或 `{ type: 'external', label, url, newTab, visible }`，`key` 限内置模块白名单且不重复，`home` 不可隐藏，外链 ≤4 个且仅 http(s)，缺失的内置模块按显示追加）、`footerLinks`（≤8 个 `{ label, url, newTab }`，`url` 为站内路径或 http(s)，不重复）、`quotes`（≤30 条、每条 1–120 字、去首尾空白后不重复）、`icpNumber`（≤40）、`icpUrl`（空或 http(s)，≤300）与 `copyright`（≤200，不含换行）。这些字段同样可选：未提交时沿用当前值，历史记录缺失时读取按缺省值补齐（缺省等于此前前端内置的导航、页脚链接与一言）。导航隐藏只影响展示，不做访问控制；公开 `GET /site` 不返回隐藏的外链，隐藏的内置模块仍保留条目以维持显隐与顺序。

| 入口                                                                                 | 契约                                                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `GET/POST /admin/media`                                                              | 服务端分页筛选与 multipart `file` 上传，可带 `uploadId/alt`                                                                 |
| `PATCH/DELETE /admin/media/:id`、`POST /admin/media/:id/restore`                     | 独立资料更新、回收与恢复                                                                                                    |
| `GET /admin/media/:id/references`、`GET /media/:file`                                | 管理引用明细与公开 WebP 字节；`file` 必须为 UUID v4 加 `.webp`，可选查询参数 `w` 仅接受 320、640、960、1280，其他值返回 400 |
| `GET /admin/content-relations`                                                       | 管理端选择有向关联目标，最终关系随来源内容版本保存                                                                          |
| `POST /admin/content-relations/resolve`                                              | 只读解析指定关联目标，返回其当前可见状态                                                                                    |
| `GET /admin/overview`                                                                | 服务端真实草稿、互动待办与最近编辑聚合                                                                                      |
| `GET /admin/notifications`、`GET /admin/notifications/summary`                       | 通知分页与未读统计；详情实时解析业务状态                                                                                    |
| `GET /admin/notifications/:id`                                                       | 读取单条通知及实时业务状态                                                                                                  |
| `POST /admin/notifications/:id/read`                                                 | 仅改变已读，不完成审核或回复                                                                                                |
| `POST /admin/notifications/read-all`                                                 | 一次标记全部未读为已读，返回 `updated/unread`；不完成审核或回复                                                             |
| `GET /admin/audit`、`GET /admin/audit/actions`                                       | 审计日志分页检索与可筛选动作，不提供修改或删除入口                                                                          |
| `GET /admin/operations`、`GET /admin/operations/tasks/:id`                           | 脱敏运行摘要与指定任务                                                                                                      |
| `POST /admin/operations/tasks/:id/retry`                                             | 核对当前状态后的显式人工重试                                                                                                |
| `GET /admin/maintenance/diagnostics`、`POST /admin/maintenance/media-check`          | 数据库/结构就绪与登记媒体完整性                                                                                             |
| `POST /admin/backup/export`                                                          | 内容包下载，可选择是否包含媒体                                                                                              |
| `POST /admin/backup/imports/preview`                                                 | multipart `file/requestId/strategy/includeSettings`，生成预览票据                                                           |
| `GET /admin/backup/imports`、`GET /admin/backup/imports/:id`                         | 当前管理员的票据与原结果                                                                                                    |
| `POST /admin/backup/imports/:id/repreview`、`POST /admin/backup/imports/:id/execute` | 重新预览或绑定摘要执行；执行需契约要求的确认文本与 confirmation                                                             |

媒体搜索参数为 `search/orientation/usage/deleted`，说明与替代文本独立保存；被当前或历史内容引用的资源拒绝回收。内容包票据绑定管理员、内容代次、目标版本和预览摘要，重复执行返回原结果。接口层约束不能替代[备份恢复](backup-and-recovery.md)与[运行任务](operations.md)中的完整操作流程。

`GET /admin/media/:id/references` 仅管理员可读，接受从 1 开始的 `page`，固定每页 20 项，响应为 `{ total, page, pageSize, items: [{ kind, revision?, title, url }] }`；包括草稿、归档及历史修订，媒体不存在时返回 404。后台批量回收复用此查询与单条 `DELETE /admin/media/:id`，逐项执行并展示结果，不是整批原子事务。删除会在共享媒体锁内重新统计全部引用，有引用时返回 409；成功只标记回收并清理图片变体，保留原文件供恢复。

## 附录 A：统一响应错误码

本表登记统一 JSON 响应顶层的 `code`，包含已定义但尚未启用的预留码；任务诊断字符串、底层系统错误码和批量结果中的 `reason` 不属于此表。通用码及 HTTP 映射定义在 [error-codes.ts](../src/backend/server-main/src/common/constants/error-codes.ts)，域错误码定义在对应业务服务中。

[全局异常过滤器](../src/backend/server-main/src/common/filters/all-exceptions.filter.ts)按以下顺序生成错误响应：`BusinessException` 原样使用其 `code` 和 HTTP 状态（未传状态时默认 422）；普通 NestJS `HttpException` 按 `HTTP_STATUS_TO_ERROR_CODE` 映射；未映射的 HTTP 状态使用 `90`，并保留异常原本的 HTTP 状态；非 HTTP 异常使用 `90` / HTTP 500。`code` 与 HTTP 状态不是一一对应关系，客户端应结合二者与 `message` 处理。

<!-- api-error-codes:start -->

| code   | 含义与来源                                          | HTTP 状态                  | 触发场景                                                                                                                                                                              |
| ------ | --------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`    | 成功；`ErrorCode.Ok`                                | 2xx（由接口决定）          | 普通 JSON 请求成功，由响应拦截器包装；此值不是错误。                                                                                                                                  |
| `10`   | 参数校验失败；`ErrorCode.ParamInvalid`              | 400                        | DTO / 路径参数校验失败，或业务通过 `BadRequestException` 拒绝输入，例如日期、URL、媒体关联、内容包字段或确认文字不合法。                                                              |
| `11`   | 参数缺失；`ErrorCode.ParamMissing`                  | 400                        | 必须提供访客身份的入口缺少有效的字符串 `X-Visitor-Id` 请求头，或值去除首尾空白后为空。                                                                                                |
| `12`   | 参数格式错误；`ErrorCode.ParamMalformed`            | 400                        | `X-Visitor-Id` 去除首尾空白后，不符合 8–128 位可打印 ASCII（不含空格）的格式要求。                                                                                                    |
| `20`   | 未鉴权或身份失效；`ErrorCode.Unauthorized`          | 401                        | 缺少或非法 Bearer token、账号密码不匹配、账号凭据变化、会话撤销或失效；也承接普通 HTTP 401 异常。                                                                                     |
| `21`   | 访问令牌过期；`ErrorCode.AccessTokenExpired`        | 401                        | 管理员守卫校验 JWT 时收到 `TokenExpiredError`。                                                                                                                                       |
| `22`   | 刷新令牌失效；`ErrorCode.RefreshTokenExpired`       | 401                        | 刷新令牌缺失、未知、过期、已撤销，所属会话失效，或检测到已轮换刷新令牌重放并完成撤销。                                                                                                |
| `23`   | 权限不足；`ErrorCode.Forbidden`                     | 403                        | 来源守卫拒绝跨站认证或写入操作；也承接普通 HTTP 403 异常。                                                                                                                            |
| `24`   | IP 黑名单；`ErrorCode.IpBlocked`                    | 未绑定（预留）             | 常量已定义，当前没有抛出路径或 HTTP 状态映射。                                                                                                                                        |
| `30`   | 资源不存在或不可见；`ErrorCode.NotFound`            | 404                        | 普通 `NotFoundException`，以及评论或父评论不存在、不可见等显式业务异常；多数领域管理和公开读取使用此码。                                                                              |
| `40`   | 状态冲突；`ErrorCode.Conflict`                      | 409                        | 记录版本、内容上下文、提交标识、导入票据或影响范围已变化；重复提交内容不一致、记录已删除或关联仍被引用等冲突。                                                                        |
| `50`   | 命中敏感词；`ErrorCode.SensitiveWord`               | 未绑定（预留）             | 常量已定义，当前没有抛出路径或 HTTP 状态映射；不表示已启用敏感词拦截。                                                                                                                |
| `51`   | 业务规则拒绝；`ErrorCode.BusinessRejected`          | 422                        | 普通 HTTP 422 异常的通用映射；当前已归档文章评论的显式业务异常使用 `1002`。                                                                                                           |
| `60`   | 请求限流；`ErrorCode.RateLimited`                   | 429                        | 应用级限流窗口配额耗尽；访客标识不能绕过真实连接 IP 的限制。                                                                                                                          |
| `90`   | 服务端异常或未映射状态兜底；`ErrorCode.ServerError` | 500；413、428 等未映射状态 | 未知异常或 HTTP 500；内容包大小、记录或图片规模超限返回 HTTP 413；缺少恢复后要求的内容上下文，或旧文章保存缺少必要版本时返回 HTTP 428。其他未登记的 HTTP 状态也保留原状态并使用此码。 |
| `91`   | 依赖暂不可用；`ErrorCode.DependencyUnavailable`     | 503                        | 登录状态无法校验、审计存储不可用或补全积压、媒体保存或读取失败、导入执行失败或结果暂不能确认，以及就绪检查发现关闭中或数据库未就绪。                                                  |
| `1001` | 文章不存在或不可见；`POST_NOT_FOUND`                | 404                        | 文章公开详情、地址解析、互动或评论入口找不到可访问文章；定义在 `post.service.ts` 与 `comment.service.ts`。                                                                            |
| `1002` | 文章已归档，拒绝评论；`POST_ARCHIVED`               | 422                        | 向已归档且未删除的文章提交评论；定义在 `comment.service.ts`。                                                                                                                         |
| `1003` | 评论层级超限；`COMMENT_DEPTH_EXCEEDED`              | 409                        | 回复将超过最多 3 层的评论深度；定义在 `comment.service.ts`。                                                                                                                          |
| `3001` | 闪念不存在或不可见；`FLASH_NOT_FOUND`               | 404                        | 公开闪念详情、点赞或评论入口找不到可访问闪念；定义在 `flash.service.ts`。                                                                                                             |

<!-- api-error-codes:end -->

业务异常的定义与调用入口：[BusinessException](../src/backend/server-main/src/common/exceptions/business.exception.ts)、[访客身份装饰器](../src/backend/server-main/src/common/decorators/visitor-id.decorator.ts)、[管理员守卫](../src/backend/server-main/src/common/guards/admin-auth.guard.ts)、[认证服务](../src/backend/server-main/src/modules/auth/auth.service.ts)、[文章服务](../src/backend/server-main/src/modules/post/post.service.ts)、[评论服务](../src/backend/server-main/src/modules/comment/comment.service.ts)、[闪念服务](../src/backend/server-main/src/modules/flash/flash.service.ts)。成功码由[响应拦截器](../src/backend/server-main/src/common/interceptors/response-wrap.interceptor.ts)生成。

维护错误码时，同时更新本表并运行后端单测中的文档覆盖检查。新增码不能只补 `ErrorCode`：模块内传入 `BusinessException` 的域常量和字面量也必须登记。
