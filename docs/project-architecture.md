# TixXinBlog 项目架构基线

本文用于沉淀当前项目的长期有效约定，作为后续实现和 Cursor 规则的统一参考。

## 1. 项目定位

TixXinBlog 是一个中大型个人博客系统，目标包括：

- 文章创作、发布、管理
- 分类、标签、搜索
- 评论、点赞、收藏
- SEO 优化与性能优化
- 后台管理与统计分析
- 可扩展的内容系统与后续增强能力

当前已实现文章、评论、认证、闪念、朋友圈和创作后台的真实 API；书签使用本机 LocalStorage。本文的未来扩展不代表已实现功能。

## 2. 技术方向

- 前端：Nuxt 4、Vue 3、Composition API、TypeScript
- 服务端：NestJS
- 样式：SCSS
- 图标：@nuxt/icon（基于 Iconify，默认使用 Lucide 图标集）
- 数据层：MikroORM 6 + PostgreSQL 16
- 内容层：Markdown 原文与结构化内容块，元信息存储在 PostgreSQL
- 搜索：当前使用 PostgreSQL 查询；Meilisearch 为未来扩展
- 评论：自建
- 部署：Docker

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
```

## 4. 仓库与目录边界

当前仓库的长期目录边界应保持清晰：

- `src/frontend/`：前端项目
- `src/backend/`：后端项目
- `docs/`：文档与架构说明

结合现有空目录骨架，预期模块如下：

```text
src/
  frontend/
    web-blog/
    web-admin/
  backend/
    server-main/
```

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
- 相同或相似逻辑优先提炼复用，避免复制粘贴式开发

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

推荐写法示例：

```text
app/pages/
  index.vue
  login.vue
  dashboard.vue
  posts/
    index.vue
    [slug].vue
  users/
    index.vue
    create.vue
    [id]/
      index.vue
      edit.vue
```

## 8. 博客核心模块

首期核心能力建议围绕以下模块展开：

- 文章系统：文章、草稿、定时发布、Markdown 内容、阅读量
- 分类系统：分类列表与分类详情
- 标签系统：标签列表与标签详情
- 搜索系统：全文搜索、分类/标签检索
- 评论系统：评论、回复、点赞、举报
- 用户系统：登录、评论、收藏、点赞
- 统计系统：阅读量、热门内容、搜索统计
- 后台系统：文章、分类、标签、评论、用户、统计管理

## 9. 推荐页面结构

博客前台推荐路由：

```text
/
/posts
/posts/[slug]
/categories
/categories/[slug]
/tags
/tags/[slug]
/search
/about
```

后台推荐路由：

```text
/admin
/admin/posts
/admin/comments
/admin/users
/admin/settings
```

## 10. SEO 与性能方向

默认按 SEO 友好和性能优先来实现：

- 使用 `useSeoMeta()` 等页面元信息能力
- 补齐 sitemap、robots、OpenGraph、Twitter Card
- 优先考虑 SSG / SSR 兼容写法
- 配合 CDN 缓存、图片优化、懒加载

## 11. 安全与实现原则

- 基本安全目标：XSS 过滤、CSRF 防护、API 限流、登录权限校验
- 优先做最小可落地实现，避免过度设计
- 如果实现必须偏离本文档，应明确记录偏离原因和范围
- 实现时优先选择更易维护的拆分方案，而不是短期可跑但难以扩展的大文件方案

## 12. 开发阶段建议

推荐按阶段推进：

1. 第一阶段：文章、分类、标签、Markdown 内容能力
2. 第二阶段：评论、搜索、收藏等交互能力
3. 第三阶段：后台管理与统计能力
4. 第四阶段：推荐、多语言、AI 等增强能力

## 13. 开发阶段 Mock 数据策略

当前按业务域渐进接入真实 API：文章、统计、评论、认证、闪念、朋友圈、留言、媒体和站点配置已持久化；书签明确使用本机存储；项目、图库和友链仍有演示数据。逐项入口、证据和剩余工作见[能力清单](capability-map.md)。

### 基本原则

- Mock 数据统一存放在 `features/<domain>/mock.ts`，配套类型放 `features/<domain>/types.ts`
- 页面层通过 composable/仓储取得数据并通过 props 传递给组件；演示模式使用对应 Mock 仓储或数据
- **组件不直接 import mock 文件**，而是通过 props 接收数据，保持组件与数据源解耦
- 导航、Tab 列表等配置型数据也归入 `features/<domain>/mock.ts`
- 多个组件共用的数据（如导航项）只定义一次，统一 import，避免重复维护

### 真实模式与演示模式

文章由 `public.postUseMockRepo` 控制；闪念由 `public.useMockRepo` 控制；标签页仓储独立保持 LocalStorage。配置名称与具体数据源以当前仓储装配为准。真实模式的请求失败必须显示可恢复错误，不得回退为演示内容或虚假零统计。

`features/*/mock.ts` 中既有演示业务数据，也有静态导航配置；保留静态配置不影响对应业务使用真实 API。开发种子可通过显式命令写入开发库，日常启动不执行 seed、清空或重置。

### 未来迁移路径

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

`SiteSettings` 保存单站点公开资料、独立版本号及更新时刻，`SiteSettingsRevision` 保留配置历史。保存/恢复与媒体引用在同一事务提交，头像历史防止误删。部署环境地址与密钥不进入配置 API。Nuxt `site-settings` 插件在 SSR 读取共享状态，`useSiteSettingsEditor` 处理管理编辑与冲突，展示预览只接收 props；三套主题统一公告位。公开每日热力图由数据库聚合当前可见内容，组件仅渲染传入数组。

### 会话身份与审计

`AdminSession` 为访问 JWT 与刷新轮换提供稳定身份；认证守卫查询会话状态和账号版本。旧刷新记录迁移或首次刷新时升级。`AuthSessionsService` 按管理员优先顺序串行撤销，Cookie 和有效访问令牌指向不同会话时退出会撤销两者。

`AuditGateGuard` 位于全局限流之后，先持久化管理写入意图；`AuditInterceptor` 提取固定字段名称、版本与计数完成结果。`AuditEntry` 不保存原始凭据/内容，操作者 ID 不使用删除级联以保留历史。完成记录短时失败使用有界队列重试，pending/unknown 明确表示结果待核对，不伪造完成。展示组件 `ActiveSessions`、`AuditLog` 由 composable/页面通过 props 和事件驱动。

### 备份与恢复边界

内容迁入包创建新草稿副本，保持现有内容，冲突与资源引用先预览，执行绑定确认摘要并在同一事务提交。导入票据保存结果实现幂等；临时包完成/过期后清理。完整备份用 PostgreSQL 导出快照同步数据库、表摘要与登记媒体，恢复到无网络新容器后验证全部数据。

完整恢复轮换 `ContentContext` 并撤销旧授权；页面初始化捕获 X-Content-Context，管理 API 与媒体上传附带该上下文，防止旧页面重新登录后继续覆盖恢复内容。内容包与完整恢复是不同能力，完整恢复保留原编号、历史与认证资料。

后端 watch 使用 .dev-dist，生产 build 使用 dist；迁移目录相对运行产物解析，避免构建检查影响可见开发终端。默认浏览器验收按测试文件启动独立临时库，失败产物按运行与文件分目录保存。
