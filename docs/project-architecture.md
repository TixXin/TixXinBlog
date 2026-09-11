# TixXinBlog 项目架构基线

本文说明当前代码的职责边界与长期约定。业务入口见[能力清单](capability-map.md)，使用、维护、规划和历史记录分别从[文档导航](README.md)进入；历史报告里的阶段数字不代表当前整站能力。

## 1. 项目定位

TixXinBlog 面向单博主持续创作与运营，当前实现包括：

- 文章创作、发布、管理
- 分类、标签、搜索
- 各业务实际支持的评论、留言、点赞与回应
- SEO 优化与性能优化
- 内置运营工作台、内容管理、真实业务聚合与通知
- 可扩展的内容系统与后续增强能力

文章、评论、认证、闪念、朋友圈、留言、图库、项目、友链、媒体和站点资料使用真实 API。关于页复用站点身份资料并维护可选栏目；书签独立使用本机 LocalStorage。没有多租户、访客注册账户或协作办公模型，友链公开申请、访客邮件订阅和书签云同步未开放。

## 2. 技术方向

- 前端：Nuxt 4、Vue 3、Composition API、TypeScript
- 服务端：NestJS
- 样式：SCSS
- 图标：@nuxt/icon（基于 Iconify，默认使用 Lucide 图标集）
- 数据层：MikroORM 6 + PostgreSQL 16
- 内容层：Markdown 原文与结构化内容块，元信息存储在 PostgreSQL
- 搜索：六类内容使用现有 PostgreSQL/域查询，前端按类型组织结果；未引入外部搜索服务
- 评论：自建
- 运行：Docker Compose、Caddy HTTPS 入口、独立迁移及可选任务 worker；SMTP 通过 Nodemailer 实现

运行基线为 Node 24、pnpm 9.15.0。公开文章入口统一使用后端公开查询，生产环境不回退演示数据。

## 3. 整体架构

系统按四个主要方向组织：

- 前台网站
- 后台管理系统
- 内容系统
- API 服务

整体链路可以理解为：

```text
Browser -> Nuxt / Nitro same-origin API -> NestJS -> PostgreSQL
                                      -> 受管媒体目录
独立 worker -> 同一 PostgreSQL 的持久任务 -> 一致备份 / 明确配置的备份接收器 / SMTP
```

公开站点与后台都位于 `web-blog`，浏览器通过同源 `/api/v1` 访问服务。任务执行器不是 HTTP 启动钩子：环境开关、数据库暂停状态和显式启动共同控制副作用，默认不自动执行。图库/友链外链由内容字段保存，服务端导入、备份与查询不下载外链图片。

## 4. 仓库与目录边界

当前仓库的长期目录边界应保持清晰：

- `src/frontend/`：前端项目
- `src/backend/`：后端项目
- `docs/`：文档与架构说明

当前实际工作区如下：

```text
src/
  frontend/
    web-blog/
  backend/
    server-main/
```

早期设计中的 `web-admin` 是预留名称，当前没有独立实现；管理页面与布局位于 `web-blog/app/pages/admin/` 和 `app/layouts/admin.vue`。不得据历史目录树添加不存在的启动命令或假定另一个后台已经部署。

## 5. Nuxt 前端目录规范

前端项目默认采用 Nuxt 4 文件系统路由，推荐目录职责如下：

```text
app/
  pages/
  components/
  composables/
  features/
  layouts/
  middleware/
  utils/
  types/
```

职责约定：

- `app/pages/`：只放可访问页面
- `components/`：放可复用 UI 组件
- `composables/`：放跨页面复用逻辑
- `features/`：按业务域组织接口、model、schema、constants 等
- `layouts/`：页面布局
- `middleware/`：路由守卫
- `utils/`：纯函数工具
- `types/`：跨域共享类型

核心原则：

- 页面保持轻量，主要负责组装 UI 和页面级交互
- 业务逻辑尽量下沉到 `features/`
- 页面私有 UI 不要塞进 `pages/`
- 优先采用组件化、模块化开发方式组织前端实现
- 只抽取已有多个使用点且语义一致的逻辑，不统一不同业务的发布、删除和恢复规则

## 6. 模块化与可维护性原则

项目实现过程中，默认遵循以下约束：

- 优先采用模块化开发，按领域和职责拆分代码
- 尽量遵守单一职责原则，一个文件只做一件事
- 当单个文件同时承担页面、状态、请求、数据转换等多类职责时，应主动拆分
- 页面优先通过组件、组合式函数和业务模块组合完成，而不是把逻辑集中在单个大文件中
- 遇到重复逻辑时，优先抽取为可复用组件、`composables`、`utils` 或 `features` 内部能力
- 写代码时优先考虑长期维护成本，保持命名清晰、结构稳定、依赖关系简单

## 7. 页面与路由命名规范

这是当前最重要的前端约定。

- 独立页面直接使用 `xxx.vue`
- 只有模块存在子页面时才使用 `xxx/index.vue`
- 简单动态详情优先使用 `[id].vue` 或 `[slug].vue`
- 详情页存在子流程时再使用 `[id]/index.vue`
- 不为了目录“好看”而多包一层无意义的 `index.vue`

以当前页面举例：

```text
app/pages/
  index.vue
  about.vue
  projects.vue
  articles/
    [id].vue
  admin/
    login.vue
    posts/
      index.vue
      new.vue
      [id].vue
```

## 8. 博客核心模块

| 模块         | 当前职责                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| 文章与目录   | Markdown/历史结构块、草稿与发布、历史地址、专栏标签、修订、批量回收、阅读和互动计数                  |
| 多类型内容   | 闪念、朋友圈、留言、图库、项目、友链各自实体和发布规则；图库两种图片来源互斥，项目进展与发布状态独立 |
| 发现与关联   | 六域公开搜索；文章/项目/图库持有有向、有序的结构化关联，公开读取过滤不可见目标                       |
| 身份与治理   | 单博主管理会话、审计、评论/留言审核及各域支持的回复关系；普通访客不需要注册账号                      |
| 站点与关于页 | 基础身份复用、可选介绍/经历/技能/兴趣/书单、栏目和条目显隐及历史保护                                 |
| 运营与通知   | 工作台服务端聚合、站内已读、实时业务处理状态、持久任务和可配置 SMTP                                  |
| 维护与恢复   | v9 内容包、受管媒体引用与说明、完整快照、校验、隔离恢复和恢复后的外部投递暂停                        |

定时发布、举报流、用户管理平台和完整流量分析不属于上述已实现能力；早期需求建议需要另行建模与验收。

## 9. 当前页面入口

公开入口由文件路由实现，主要包括：

```text
/
/archive
/articles/:id
/flash
/flash/:id
/moments
/guestbook
/gallery
/projects
/links
/tabs
/search
/about
```

主要后台入口：

```text
/admin
/admin/posts
/admin/comments
/admin/moment-comments
/admin/guestbook
/admin/flashes
/admin/moments
/admin/gallery
/admin/projects
/admin/links
/admin/media
/admin/taxonomy
/admin/site
/admin/notifications
/admin/operations
/admin/maintenance
/admin/account
/admin/audit
```

文章地址解析、旧地址重定向、canonical、RSS 和 sitemap 沿用既有契约；项目/图库搜索及关联链接携带编号，进入真实详情上下文。通知与媒体引用支持对应业务深链，不能用显示名称猜测目标记录。

## 10. SEO 与性能方向

默认按 SEO 友好和性能优先来实现：

- 使用 `useSeoMeta()` 等页面元信息能力
- 补齐 sitemap、robots、OpenGraph、Twitter Card
- 优先考虑 SSG / SSR 兼容写法
- 使用当前图片尺寸、加载与媒体转换能力；缓存范围和失效依具体业务确定

已落地的性能改动是在 `PostService.findMany` 指定公开列表所需字段，避免联表返回无用的长正文；正文搜索条件与最终业务响应保持不变。对比样本、缓存条件与计时边界见[性能维护说明](performance-maintenance.md)，不将服务方法采样当作线上首屏或吞吐承诺。

## 11. 安全与实现原则

- 基本安全目标：XSS 过滤、CSRF 防护、API 限流、登录权限校验
- 优先做最小可落地实现，避免过度设计
- 如果实现必须偏离本文档，应明确记录偏离原因和范围
- 实现时优先选择更易维护的拆分方案，而不是短期可跑但难以扩展的大文件方案

## 12. 早期阶段规划（历史背景）

以下为早期推进顺序，保留设计背景，不再作为当前进度判断：

1. 第一阶段：文章、分类、标签、Markdown 内容能力
2. 第二阶段：评论、搜索、收藏等交互能力
3. 第三阶段：后台管理与统计能力
4. 第四阶段：推荐、多语言、AI 等增强能力

当前实现以第 8 节和能力清单为准。多语言、AI 等未经独立实现与验证的建议仍是后续规划；没有因旧页面或文档提及而自动具备能力。

## 13. 开发阶段 Mock 数据策略

当前数据边界：文章、统计、评论、认证、闪念、朋友圈、留言、图库、项目、友链、媒体和站点配置使用真实持久数据；书签明确使用本机存储。友链公开申请和外部项目指标同步尚未开放。逐项入口、证据和剩余工作见[能力清单](capability-map.md)。

### 基本原则

- 显式演示数据可位于 `features/<domain>/mock.ts`；领域类型位于 `features/<domain>/types.ts` 或该域专用类型文件
- 页面层通过 composable/仓储取得数据并通过 props 传递给组件；演示模式使用对应 Mock 仓储或数据
- **组件不直接 import mock 文件**，而是通过 props 接收数据，保持组件与数据源解耦
- 导航等静态配置留在对应领域，不因历史文件名带 `mock` 就将真实业务误判为演示仓储
- 多个组件共用的数据（如导航项）只定义一次，统一 import，避免重复维护

### 真实模式与演示模式

文章由 `public.postUseMockRepo` 控制；闪念由 `public.useMockRepo` 控制；标签页仓储独立保持 LocalStorage。配置名称与具体数据源以当前仓储装配为准。真实模式的请求失败必须显示可恢复错误，不得回退为演示内容或虚假零统计。

`features/*/mock.ts` 中既有演示业务数据，也有静态导航配置；保留静态配置不影响对应业务使用真实 API。开发种子可通过显式命令写入开发库，日常启动不执行 seed、清空或重置。

### 后续新增能力的迁移要求

每个业务接入时同时核对实体和迁移、公开/管理权限、分页排序、请求状态、媒体引用、维护与备份、刷新/跨上下文持久化及实际验收。展示组件保持数据解耦，页面入口可见不等于上述闭环已完成。

## 14. 当前结论

对后续实现最重要的基线只有三条：

- 仓库分层先稳住：前端在 `src/frontend/`，后端在 `src/backend/`，文档在 `docs/`
- Nuxt 前端坚持“页面归 pages，复用归 components，业务归 features，逻辑归 composables”
- 没有子页面就不要建目录，只有存在子页面时才使用 `index.vue`

同时始终补充遵守两条工程约束：

- 优先模块化开发，避免把多类职责堆在同一文件中
- 优先复用已有组件和模块，减少重复代码

## 后台分类契约

category 是固定内容类型 tech/life；folder 是可维护专栏，目录保存在 post_folder，文章继续保留原字符串契约以兼容公开页面。专栏重命名事务内同步文章，所有生产文章保存与目录写入共用事务锁；标签按 post_tag_map 多对多引用，删除有引用目录项被拒绝。引用数量包括全部状态，公开统计只包括已发布文章。

### 文章回收和批量任务

`Post.deletedAt` 将回收状态与内容发布状态分离；回收/恢复推进内容 revision，修订仍保留。`PostBatchOperation` 持久化明确 ID/版本的预览与逐项执行结果，操作者隔离、5 分钟执行有效期、每项事务及幂等重试。永久删除的确认绑定关联记录集合，数据库级联只删除文章关联数据，媒体文件独立保留。前端 `usePostBatch` 管理请求与结果，`AdminPostBatch` 仅通过 props/model/events 展示确认，最近操作支持刷新后结果查询。

### 评论治理

`CommentPolicy` 持久化新游客评论是否先审核，策略带 revision 防止覆盖。`Comment` 增加审核状态和独立版本。`comment-visibility.ts` 统一三级祖先公开条件的 ORM 和 SQL 表达，用于评论树、文章缓存计数、发现统计及管理概览。`CommentModerationService` 生成明确子树影响和状态指纹，审核只改变目标自身状态；与删除、游客写入和点赞统一采用文章优先的锁顺序。

### 站点配置与公开展示

`SiteSettings` 保存单站点资料、独立版本号及更新时刻，`SiteSettingsRevision` 保留配置历史。`about` 作为站点资料的一部分维护介绍与可选栏目，公开接口剔除隐藏内容；管理员冲突/历史预览可核对完整隐藏资料。姓名、头像、简介和社交方式复用基础配置，不重复建个人事实来源。旧客户端或旧包未提供关于字段时保留目标配置。

保存/恢复与媒体引用在同一事务提交，头像历史防止误删。部署地址与密钥不进入配置 API。Nuxt `site-settings` 插件在 SSR 读取共享状态，`useSiteSettingsEditor` 按账号/内容上下文保留恢复副本，三方合并保留独立字段/栏目的服务器改动，未确认提交先读取核对而非直接重投。三主题统一公告位；公开热力图从当前可见记录聚合。个人事实的确认边界见[首批内容说明](personal-content.md)。

### 会话身份与审计

`AdminSession` 为访问 JWT 与刷新轮换提供稳定身份；认证守卫查询会话状态和账号版本。旧刷新记录迁移或首次刷新时升级。`AuthSessionsService` 按管理员优先顺序串行撤销，Cookie 和有效访问令牌指向不同会话时退出会撤销两者。

`AuditGateGuard` 位于全局限流之后，先持久化管理写入意图；`AuditInterceptor` 提取固定字段名称、版本与计数完成结果。`AuditEntry` 不保存原始凭据/内容，操作者 ID 不使用删除级联以保留历史。完成记录短时失败使用有界队列重试，pending/unknown 明确表示结果待核对，不伪造完成。展示组件 `ActiveSessions`、`AuditLog` 由 composable/页面通过 props 和事件驱动。

### 备份与恢复边界

内容迁入包当前导出 v9，接受 v1–v8；新契约包含关于资料、媒体说明与三域结构化关联，旧版本不被静默改写为新格式。关联按整批目标编号映射，预览明确缺失/失效关系的省略。既有跳过/复制、预览变化检测、事务回滚和同票据幂等继续保留，导入不会触发互动邮件。代码入口为后端 `modules/backup/content-package.ts`、`content-relation-plan.ts` 和 `content-import-relations.ts`。

内容迁入创建草稿或按各业务既有规则处理，现有内容与用户配置按选择保留；临时包完成/过期后清理。完整备份另外保存全部数据库表、历史、认证、运行任务与登记媒体，使用同一导出快照，恢复到无网络新容器后先核对原始表摘要和媒体。

完整恢复轮换 `ContentContext` 并撤销旧授权；页面初始化捕获 X-Content-Context，管理 API 与媒体上传附带该上下文，防止旧页面重新登录后继续覆盖恢复内容。内容包与完整恢复是不同能力，完整恢复保留原编号、历史与认证资料。

恢复还轮换 `OperationControl.generation` 并双暂停邮件/自动备份；恢复的旧队列不自动重投。原始摘要验证后新增独立 `recoveryVerified` 记录供后台展示恢复时间，不把它记为一次新备份生成成功。详见[备份契约](backup-and-recovery.md)与[运行任务](operations-and-notifications.md)。

### 内容关联、素材与章节定位

`post`、`project`、`gallery_photo` 的 `related_content` JSONB 保存类型/编号数组，每条最多 12 个有序目标。`modules/content-relations` 验证、批量解析并按公开权限投影；关联与 `MediaReference` 分离，不改变图片使用计数。目标撤回、删除和缺失在公开展示与管理核对中分别处理。

媒体 `description` 与图片替代文本独立保存，构图/使用状态查询来自真实尺寸和跨业务/历史引用。`useMediaLibrary` 保护未保存说明、迟到响应和选择器状态。章节导航由 Markdown 行映射生成，通过选区与排版测量定位，不重写 textarea 内容，不清空原生撤销记录。使用入口见[关联与写作](writing-navigation.md)、[素材整理](media-organization.md)。

### 运营工作台与最小持久任务

`AdminOverviewController` 在服务端汇总六域草稿、五类真实互动待办与各域限量的最近编辑，分区失败用 null 表示。待回复只使用有可靠直接回复关系的文章根评论与根留言；通知已读不参与业务计数。`useAdminReadResource` 在工作台、通知和运行面板复用读取归属与失败保留，页面仍保留各自的业务处理规则。

`OwnerNotification` 保存稳定事件标识和已读，详情实时解析业务状态；`BackgroundTask` 保存去重键、尝试次数、租约、固定错误分类与脱敏结果；`OperationControl` 保存双暂停和运行代次。业务事务内登记通知与邮件任务，独立执行器同类互斥、有限重试并限频。SMTP 已接受但落库异常、断线或中断的不确定投递不自动重试；恢复旧队列同样需要明确核对。

生产编排见 `compose.production.yaml`：前端、API、数据库、HTTPS 入口与可选 worker 分工，worker 使用原生 PG16 客户端和受管媒体只读挂载。备份传输通过明确配置的接收器进行长度/摘要核验，保留策略仅作用于匹配 owner 的资源。发布脚本默认预检；生产部署、真实外投和长期启用是独立授权动作，当前代码与隔离验证不等于已经投产。

后端 watch 使用 .dev-dist，生产 build 使用 dist；迁移目录相对运行产物解析，避免构建检查影响可见开发终端。默认浏览器验收按测试文件启动独立临时库，失败产物按运行与文件分目录保存。
