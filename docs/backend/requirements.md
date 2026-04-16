# TixXinBlog 后端需求文档

本文记录 TixXinBlog 后端服务（`src/backend/server-main/`）必须具备的业务能力。所有需求从前端已实现的行为反向推导：**前端已经呈现的交互和字段 → 后端必须撑住的能力与数据**。凡是前端 `src/frontend/web-blog/app/features/<domain>/` 下已有的类型与 mock，均视为"事实上的需求"。

## 1. 文档定位

- 读者：后端开发者、前端对接者、评审人
- 基准：以 `src/frontend/web-blog/app/features/` 下 12 个业务域的 `types.ts` 为字段源真
- 边界：**不涉及 UI 实现细节**；只描述后端能力、数据、限制、验收点
- 优先级：P0（MVP 必须）、P1（完整版必须）、P2（可延后）

## 2. 项目目标与边界

### 2.1 目标

- 支撑一个中大型个人博客的全部公开与管理能力
- 前台读取 + 匿名写入（评论、留言、点赞、emoji 反应）
- 管理员写入 + 管理（文章、闪念、友链审核、站点配置）
- 提供全文搜索、RSS 订阅、AI 语义检索、实时通知

### 2.2 不做的事

- 多租户 / SaaS：后端只服务一个博主
- 用户注册体系：除管理员外不支持注册账号
- 移动 App：仅 Web 前端
- 支付 / 会员：无商业化
- 内容付费墙：所有已发布内容对匿名访客可见

### 2.3 服务对象

- `web-blog`（已开发）：公开前台，绝大多数接口面向它
- `web-admin`（规划中，未开始）：管理后台前端，使用同一后端的 `/admin/*` 接口

## 3. 角色与权限矩阵

| 角色 | 鉴权方式 | 读权限 | 写权限 | 限流 |
|------|---------|--------|--------|------|
| 匿名访客 | `X-Visitor-Id` 头 | 所有公开内容 | 评论 / 留言 / 回复 / 点赞 / emoji 反应 / 友链申请 | 匿名写 10 req/min，匿名读 120 req/min |
| 管理员 | JWT（access 15min + refresh 7d） | 全部 | 全部 | 600 req/min |
| 协作者（P2 预留） | JWT | 全部公开内容 + 自己的草稿 | 编辑自己的草稿 | 同访客 |

访客身份策略：

- 前端生成 `visitorId`（浏览器指纹哈希 + `localStorage` 兜底），后端只存 SHA-256 哈希
- 访客的 `nickname` / `avatarColor`（见 `VisitorIdentity`）由前端提交，后端做长度与字符校验后直接落库
- 访客无法"登录"或"找回"身份：清空浏览器数据即视为新访客

## 4. 业务域需求

按 `src/frontend/web-blog/app/features/` 每个域逐一映射。字段清单以 `types.ts` 为准，本文不重复列字段，只列**能力要求**。

### 4.1 文章（post / article）

涉及类型：`PostItem`、`PostTag`、`PostTab`、`ArticleSection`、`ArticleDetail`、`CommentItem`、`RelatedPost`、`TocItem`、`ArchiveYear`、`ArchivePost`、`CategoryDistribution`

P0 能力：

- 分页列表（支持 `category` / `tag` / `pinned` / `search` 过滤）
- 详情查询（返回 `content: ArticleSection[]` 结构化数据 + `TocItem[]`，由后端解析 Markdown 生成）
- 点赞（匿名，按 `visitorIdHash + postId` 唯一，重复点赞切换状态）
- 浏览统计（`POST /posts/:id/view` 异步累加，同一访客 1 小时内不重复计数）
- 评论树（`CommentItem.replies` 嵌套）：发表、获取、点赞
- 归档聚合（按年份分组，返回 `ArchiveYear[]`）
- 分类与标签分布（`CategoryDistribution[]`）

P1 能力：

- 管理员 CRUD（草稿、定时发布、置顶、隐藏）
- 相关文章推荐（基于共同标签 + 最近更新）
- Markdown → `ArticleSection[]` 的服务端解析（包含 heading id 生成、代码语言识别、引用块、列表）
- 全文搜索（Meilisearch `posts` 索引）

P2 能力：

- 文章版本历史
- 多作者协作

关键约束：

- 前端 `PostItem.id` 类型是 `number`，`ArticleDetail.id` 类型是 `string`。后端统一使用 uuid v7；在响应时 `PostItem.id` 按"uuid 取后 8 字节转 bigint"的方式派生稳定数字，`ArticleDetail.id` 直接返回 uuid 字符串。该映射规则在 [api.md 前后端类型对齐附录](./api.md#9-前后端类型对齐附录) 中明确
- 前端 `PostItem.readTime: number`（分钟数）与 `ArticleDetail.readTime: string`（如 "8 分钟"）不一致。后端列表接口返回 number，详情接口返回预格式化字符串
- `PostItem.comments: number` 是冗余计数字段，后端每次创建/删除评论都必须更新
- `PostTag.color` 是枚举（`emerald | rose | sky | orange | blue | amber`）。后端存储为字符串，列表中取前 N 个映射为前端允许的色值

### 4.2 统计（stats）

涉及类型：`SiteStats`、`TagItem`、`CategoryItem`

P0 能力：

- 站点统计（文章总数、总浏览数、总评论数、标签总数、运行天数）—— **全部从其他表派生**，不单独建表
- 标签云（`TagItem[]`，含每个标签的 count 与颜色）
- 分类列表（`CategoryItem[]`，含 icon 与背景色）

P1 能力：

- 统计结果缓存（Redis，TTL 5 分钟）
- 管理员面板额外指标（日活访客、接口 QPS、慢查询数）

关键约束：

- `SiteStats.views` 是**字符串**（如 "12.8k"），由后端格式化返回，不做客户端格式化
- `SiteStats.uptimeDays` 的起点是 `SiteConfig.launchedAt`

### 4.3 朋友圈（moment）

涉及类型：`MomentItem`、`MomentCommentItem`、`MomentLinkedArticle`、`MomentUserProfile`

P0 能力：

- 时间倒序的动态流（分页）
- 按 `topic` / 日期 / `authorId`（博主本人或预留协作者）过滤
- 点赞（与文章一致，匿名去重）
- 评论（支持 `profile` 展开，用于 hover 卡片）
- `linkedArticle`：关联文章的快照（冗余存储 title/summary/cover 避免原文修改后错乱）
- 作者统计（总动态数、总点赞、总评论、当前心情、社交链接）

P1 能力：

- 管理员 CRUD
- 图片上传走预签名 URL
- 话题标签聚合（取 top 20）

关键约束：

- `MomentItem.id` 为 string，与数据库 uuid 直接对齐
- `MomentItem.isLiked` 是**与当前访客相关**的字段，后端响应时按 `visitorIdHash` 即时查询
- `images: string[]` 存储已上传图片的公开 URL（R2 / S3），不存路径
- `MomentLinkedArticle.url` 指向 `/articles/[id]`，前端路由格式由后端直接拼接

### 4.4 闪念（flash）

涉及类型：`FlashNote`、`FlashComment`、`FlashNoteDraft`、`FlashCommentDraft`、`FlashAISearchResult`

P0 能力：

- 列表（按 `createdAt desc` 分页 / 按标签过滤）
- 详情
- 评论提交
- 点赞（与文章一致）

P1 能力：

- 管理员 CRUD（仅管理员可创建闪念）
- 全文搜索（Meilisearch `flashes` 索引）
- **AI 语义检索**（`POST /flashes/ai-search`）：
  - 对查询文本计算 embedding
  - pgvector `<=>` 余弦距离取 top-8
  - 按 `FlashAISearchResult` 返回：`answer`（模板拼接命中笔记内容）+ `citedNoteIds` + `latencyMs`
  - 不调用 LLM 生成答案，仅做检索 + 模板装配
- 标签自动补全（基于已有标签集合）

关键约束：

- `FlashNote.userId` 目前仅博主，保留字段以备未来多作者
- `FlashComment.authorId` 对匿名评论者是访客 visitorIdHash
- embedding 维度固定 1536，与 `text-embedding-3-small` 对齐。更换模型时 `flash_embedding` 表新增 `version` 字段区分
- AI 搜索的 `latencyMs` 是真实服务端耗时，非前端模拟

### 4.5 留言板（guestbook）

涉及类型：`GuestMessage`、`MessageReaction`、`ReplyRef`、`PinnedMessage`、`DateGroup`、`ChatStat`、`ChatRule`、`ActiveMember`、`VisitorIdentity`

P0 能力：

- 发送留言（匿名）
- 回复引用（`replyTo`，冗余存原作者 + 内容快照）
- 按日期分组的列表（后端聚合成 `DateGroup[]`，不让前端自己分）
- Emoji 反应（切换型：POST 同一 emoji 第二次即取消）
- 置顶公告（仅管理员可设，同一时间只有 1 条）
- 统计（总留言、活跃用户、今日新增）
- 社区守则（后台可改，API 返回 `ChatRule[]`）
- 活跃成员排行（按最近 30 天留言数）

P1 能力：

- 消息状态（`sending | sent | read`）：后端仅记录 `sent`；`read` 由管理员端确认；`sending` 仅前端临时态
- 管理员删除违规留言
- 敏感词过滤

P2 能力：

- 留言人自助删除自己的留言（凭 visitorIdHash 鉴别）

关键约束：

- `GuestMessage.id: number`。同 4.1 的处理，uuid 派生稳定数字
- `GuestMessage.browser` / `region` 由后端从 UA 和 IP 解析（MaxMind GeoLite2）
- `MessageReaction.reacted` 是**访客相关**的布尔字段，按 `visitorIdHash` 即时判断
- `ActiveMember.isOnline` 取值：该访客在过去 5 分钟内有过 WebSocket 心跳 → true

### 4.6 画廊（gallery）

涉及类型：`PhotoItem`、`GalleryCategory`、`GalleryStat`、`GearItem`

P0 能力：

- 照片列表（按 `category` 过滤）
- 大图 URL（`srcLarge`）直接走 R2 / CDN，不做鉴权
- 分类列表
- 器材展示（从 `SiteConfig` 或独立表读取）

P1 能力：

- 管理员上传（预签名 URL）
- EXIF 解析存储（光圈、快门、ISO、相机、镜头、GPS）
- 拍摄地点地图聚合

关键约束：

- `PhotoItem.id: number` → uuid 派生
- `src` 与 `srcLarge` 分别对应 `thumb-800.webp` 与 `large-1920.webp`，由上传后的 BullMQ 任务用 sharp 生成

### 4.7 友链（link）

涉及类型：`LinkItem`、`LinkRule`、`SiteInfo`

P0 能力：

- 公开友链列表（只返回 `status = approved`）
- 友链须知（`LinkRule[]`）
- 本站信息（`SiteInfo[]`，从 `SiteConfig` 派生）

P1 能力：

- 友链申请表单提交（匿名）
- 管理员审核队列（pending / approved / rejected）
- 自动活性检测：定时任务（每天）探活，连续 7 天失败的友链标记 `status = inactive`

关键约束：

- 前端 `LinkItem` 没有 `id` 字段。后端内部使用 uuid，响应时额外返回 `id` 以便管理员端定位

### 4.8 项目（project）

涉及类型：`ProjectItem`、`ProjectLink`、`ProjectTag`、`ProjectStatus`、`ProjectStats`、`TechStackItem`

P0 能力：

- 项目列表（返回 `ProjectItem[]`）
- 统计（总项目数、总 star 数、总 fork 数）
- 技术栈占比（`TechStackItem[]`）

P1 能力：

- 管理员 CRUD
- GitHub star / fork 自动同步（BullMQ 定时任务，每小时）
- 状态标签筛选（`active | dev | archived`）

关键约束：

- `ProjectItem.stars: string`（如 "1.2k"）：后端格式化返回
- `ProjectItem.status` 是强枚举，前端严格对齐

### 4.9 关于（about）

涉及类型：`Profile`、`SocialLink`、`SkillItem`、`ExperienceItem`、`ContactItem`、`HobbyItem`、`BookItem`

P0 能力：

- 单接口 `GET /about` 返回全部：`{ profile, skills, experiences, contacts, hobbies, books }`

P1 能力：

- 管理员 `PUT /about` 整体更新（存 JSONB，避免建 6 张小表）

关键约束：

- `SkillItem.percent` 范围 0-100
- 此域数据量极小，**不做缓存**，但走 HTTP `Cache-Control: public, max-age=60`

### 4.10 站点（site）

涉及类型：`FooterLink`、`PoweredByItem`、`SiteStatus`、`OwnerCardInfo`、`SiteAnnouncement`、`OwnerPresence`、`OwnerPresenceInfo`

P0 能力：

- 站点配置（`GET /site/config` 返回 `FooterLink[]` + `PoweredByItem[]`）
- 公告列表（置顶优先）
- 博主卡片信息（名称、头衔、社交链接、每日一言数组）
- 博主在线状态（`OwnerPresenceInfo`）
- 站点状态（ping 毫秒 + 健康文案，由后端健康探针派生）

P1 能力：

- 管理员修改在线状态（`PUT /site/owner-presence`）
- 管理员发布 / 撤下公告
- WebSocket 广播状态变更

关键约束：

- `OwnerCardInfo.quotes: string[]` 是整个数组，每次请求随机挑一句由前端展示（也允许前端缓存整组自行轮换）
- `OwnerPresenceInfo.since` 是 ISO 字符串，状态变更时更新
- `SiteStatus.pingMs` 由后端主动探测数据库 + 搜索 + 对象存储的综合延迟得出，非外部探针

### 4.11 导航（nav）

涉及类型：`NavItem`

P0 能力：

- `GET /nav/items` 返回 `NavItem[]`（含 `desktopOnly` 标记）

P1 能力：

- 管理员 `PUT /nav/items` 整体替换
- 响应 `Cache-Control: public, max-age=300`（低频变更）

关键约束：

- `NavItem.icon` 必须是 `lucide:*` 前缀（与前端 `<Icon>` 组件一致）

## 5. 横向能力需求

### 5.1 搜索

- 全文搜索 API `GET /search?q=...&type=post,moment,flash`（逗号分隔多索引）
- 单域搜索：`GET /posts?search=...` / `GET /flashes/search`
- 前端侧 fuse.js 已有的客户端搜索**仍保留**作为离线兜底；主站搜索走后端

### 5.2 订阅（RSS / Atom / JSON Feed）

- `GET /feed/rss.xml` / `GET /feed/atom.xml` / `GET /feed/feed.json`
- 内容：最近 20 篇文章 + 最近 20 条朋友圈（各自独立 feed，通过路径后缀区分）
- 缓存：Redis TTL 10 分钟，由 BullMQ `rss-refresh` 任务主动刷新
- 现有 `src/frontend/web-blog/server/routes/` 下的 Nitro RSS 路由作为前端 SSR 时的就近兜底，后端提供的是标准 API，二者并存

### 5.3 实时通知（WebSocket）

- 命名空间：`/ws/public`（匿名）、`/ws/admin`（管理员）
- 事件：
  - `comment.created`：新评论（文章 / 朋友圈 / 闪念）
  - `guestbook.created`：新留言
  - `owner.presence.changed`：博主上线状态变更
  - `moment.created`：管理员新发朋友圈
- 心跳：客户端每 30s 发 `ping`，用于统计"在线访客数"

### 5.4 文件上传

- 所有图片 / 头像 / 画廊 / 朋友圈附件走**预签名 URL**
- 流程：前端 `POST /upload/presign`（带 `type` 与 `contentType`） → 直传到 R2 / S3 → `POST /upload/callback` 告知后端落库
- 限制：单文件 10MB，仅允许 `image/jpeg | image/png | image/webp`
- 后端后处理：sharp 生成 thumb / large 版本，提取 EXIF

### 5.5 访问统计

- 文章 `views`：`POST /posts/:id/view`，按 `postId + visitorIdHash + 1h` 去重
- 站点 `views`：每次页面路由变化前端埋点，后端按日聚合

## 6. 非功能需求

### 6.1 性能

| 接口类型 | P50 | P95 |
|---------|-----|-----|
| 列表读 | < 80ms | < 200ms |
| 详情读 | < 120ms | < 300ms |
| 写接口 | < 150ms | < 400ms |
| 搜索 | < 150ms | < 400ms |
| AI 语义检索 | < 800ms | < 1500ms |

### 6.2 可用性

- 目标：99.5%（月停机 < 3.6h，包含计划内维护）
- 主要依赖（Postgres / Redis / Meilisearch）任何一项不可用时，**读接口降级为只返回缓存版本**

### 6.3 可观测性

- 日志：结构化 JSON，每条含 `traceId` / `userId` / `visitorIdHash` / `latencyMs`
- Metrics：Prometheus `/metrics` 端点
- Trace：OpenTelemetry 自动 instrument
- 告警：错误率 > 1% 持续 5min、P95 > 阈值持续 5min、慢查询 > 1s

### 6.4 数据备份

- 每日 `pg_dump` 到 R2，保留 30 天
- Meilisearch 每日 dump，保留 7 天
- R2 本身开启版本管理，保留 30 天

## 7. 安全需求

- **鉴权**：管理员强制 JWT + refresh rotation；访客基于指纹限流
- **CSRF**：访客写接口要求同源 `Origin` + `X-Requested-With: XMLHttpRequest`（Nuxt `$fetch` 自动带）
- **XSS**：
  - 评论 / 留言 **不允许 HTML**，仅纯文本 + 白名单 emoji
  - Markdown 渲染在后端完成，服务端 sanitize（禁用 `<script>` / `<iframe>` / `on*` 属性）
- **SQL 注入**：强制使用 MikroORM 查询构造器，禁用字符串拼接 SQL
- **限流**：见 [§3](#3-角色与权限矩阵)
- **敏感词过滤**：匿名写接口加载敏感词库，命中记录 + 返回 400
- **响应头**：与前端 CSP 对齐（`nuxt.config.ts` 中已配置），后端 `helmet` 补齐 HSTS / noSniff 等
- **密码**：管理员密码用 `argon2id` 哈希（m=65536, t=3, p=4）

## 8. 合规需求

- GDPR 风格的自助删除：访客可凭 `visitorIdHash` 申请删除自己的评论 / 留言（`DELETE /my/messages/:id`）
- 数据导出：管理员可导出全部数据（JSON + 图片 zip）
- Cookie 最小化：仅 refresh token 使用 httpOnly cookie，其余均走 header

## 9. 国际化与时间

- 后端不做文本 i18n，所有字段直存，前端按需翻译
- 时间字段统一 **ISO 8601 UTC**，由前端按地区格式化
- 前端现有 `time: string`（如 "2 小时前"）的"相对时间"字段，后端**始终返回 ISO**，由前端组合式函数做相对时间格式化

## 10. 部署需求

- **单机部署**：docker-compose up -d，包含 app + postgres + redis + meilisearch + minio
- **生产部署**（规划）：Kubernetes，app 至少 2 副本；postgres 走托管服务（如 Supabase / Neon）
- **健康检查**：`GET /health`（liveness，仅返回 200） / `GET /ready`（readiness，校验依赖）
- **环境变量清单**：见 [development.md 第 7 节](./development.md#7-本地开发流程) 与 `.env.example`

## 11. 验收指标

每个业务域列出"最小可用"与"完整版"两档。通过标准：前端对应页面在 `useMockRepo = false` 时**页面无报错、字段无缺失、交互行为与 mock 版一致**。

### 11.1 文章

- 最小可用：`GET /posts` + `GET /posts/:id` 可渲染首页与详情页
- 完整版：评论、点赞、浏览、归档、搜索全部通

### 11.2 朋友圈

- 最小可用：`GET /moments` 可渲染朋友圈流
- 完整版：评论、点赞、话题 / 日期 / 成员筛选、作者统计齐全

### 11.3 闪念

- 最小可用：`GET /flashes` + `POST /flashes/:id/comments` + `POST /flashes/:id/like`
- 完整版：全文搜索 + AI 语义检索

### 11.4 留言板

- 最小可用：`GET /guestbook/messages` + `POST /guestbook/messages`
- 完整版：reactions、pinned、统计、活跃成员、社区守则齐全

### 11.5 其他域

- 画廊 / 友链 / 项目 / 关于 / 站点 / 导航：最小可用即覆盖"返回结构化数据"；完整版要求管理员 CRUD 到位

## 12. 风险与未决事项

| 风险 / 待定项 | 影响 | 处置建议 |
|---------------|------|---------|
| Embedding 提供商切换（OpenAI → 本地 bge-m3） | 向量维度变化，需重建整个 `flash_embedding` 表 | 表内加 `version` 字段；切换时跑 backfill 任务 |
| 对象存储选型（R2 vs 自建 MinIO） | 成本与部署复杂度 | 生产默认 R2；自部署用户通过环境变量切 MinIO |
| `web-admin` 迟迟未启动 | 管理员接口缺乏实测 | `/admin/*` 接口先以 Postman + curl 验证，不阻塞主线 |
| Markdown 解析统一口径（后端生成 `ArticleSection[]` 的规则） | 前端展示一致性 | 在 `tech-stack.md` 附录补齐解析规则；以 `remark` + 自定义 visitor 实现 |
| 管理员多设备同时登录 | refresh token 冲突 | 支持多 refresh token（按 `deviceId` 分片），退出时仅撤销当前 |
| 评论树深度 | 过深导致递归查询慢 | 限制最大 3 层，第 3 层起不显示 "回复" 按钮 |
| WebSocket 在无 sticky session 集群下的 fallback | socket.io 自动降级到 long polling | 生产 Nginx 配 `ip_hash` 或使用 Redis adapter（已计划） |

## 13. 变更历史

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-04-16 | 初版 | 从前端 mock 反向推导出全量能力清单 |
