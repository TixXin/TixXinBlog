# TixXinBlog 后端开发文档

本文沉淀 `src/backend/server-main/` 的工程结构、编码规范、本地开发、迁移、测试、部署约定。后端尚未落地，但按本文即可从零初始化。

## 1. 适用阶段声明

| 阶段 | 状态 | 说明 |
|------|------|------|
| 文档设计 | 进行中 | 本目录四份文档交付后进入 |
| 工程初始化 | 未开始 | `nest new server-main` + MikroORM 脚手架 |
| 实体建模 | 未开始 | 按 [§4](#4-实体建模要点) |
| 最小闭环（post 读写 + 前端联调） | 未开始 | 打通 `useMockRepo` 切换 |
| 完整功能 | 未开始 | 按 [requirements.md §11](./requirements.md#11-验收指标) 分域验收 |

## 2. 项目目录

以下结构是约束，新模块必须落在对应位置：

```text
src/backend/server-main/
├── src/
│   ├── main.ts                       # 入口：NestFactory + global prefix + ValidationPipe
│   ├── app.module.ts                 # 根模块：装配所有业务 Module
│   ├── common/                       # 跨模块复用
│   │   ├── filters/                  # 全局异常过滤器（统一响应格式）
│   │   ├── interceptors/             # 全局拦截器（响应包装、日志、trace）
│   │   ├── pipes/                    # 自定义 Pipe
│   │   ├── guards/                   # JwtAuthGuard / ThrottlerGuard / AdminGuard
│   │   ├── decorators/               # @CurrentUser / @CurrentVisitor / @Public
│   │   └── utils/                    # 纯函数工具（id-hash、markdown-parser）
│   ├── config/                       # 环境变量 schema + ConfigModule
│   ├── modules/
│   │   ├── auth/
│   │   ├── post/
│   │   ├── comment/
│   │   ├── moment/
│   │   ├── flash/
│   │   ├── guestbook/
│   │   ├── gallery/
│   │   ├── link/
│   │   ├── project/
│   │   ├── about/
│   │   ├── site/
│   │   ├── stats/
│   │   ├── search/                   # 跨域搜索（Meilisearch 聚合）
│   │   ├── feed/                     # RSS / Atom / JSON Feed
│   │   ├── upload/                   # 预签名 URL
│   │   ├── notification/             # WebSocket Gateway
│   │   └── ai/                       # embedding + 语义检索
│   ├── entities/                     # MikroORM 实体（按文件拆分）
│   ├── migrations/                   # 生成的迁移 SQL
│   ├── seeders/                      # dev / demo / prod 三种 seeder
│   └── workers/                      # BullMQ 消费者（独立进程入口）
├── test/
│   ├── e2e/                          # Supertest 驱动的端到端
│   └── fixtures/                     # 共享测试数据
├── mikro-orm.config.ts
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── package.json
├── Dockerfile
├── docker-compose.yml                # 本地依赖栈（不含 app 本身）
├── .env.example
└── README.md                         # 快速开始（指向本目录）
```

每个 `modules/<name>/` 的内部结构：

```text
modules/post/
├── post.module.ts
├── post.controller.ts
├── post.service.ts
├── post.repository.ts                # 继承 EntityRepository，集中复杂查询
├── dto/
│   ├── create-post.dto.ts
│   ├── update-post.dto.ts
│   └── query-post.dto.ts
└── __tests__/
    ├── post.service.spec.ts
    └── post.controller.spec.ts
```

## 3. 命名规范

| 对象 | 规则 | 示例 |
|------|------|------|
| Module 类名 | PascalCase + `Module` 后缀 | `PostModule` |
| Controller / Service | PascalCase + 类型后缀 | `PostController` / `PostService` |
| Repository | PascalCase + `Repository` | `PostRepository` |
| 实体类 | PascalCase 单数 | `Post` / `GuestMessage` |
| 文件名 | kebab-case + 类型后缀 | `post.controller.ts` / `guest-message.entity.ts` |
| DTO | kebab-case + 动作前缀 | `create-post.dto.ts` / `query-post.dto.ts` |
| 迁移 | `YYYYMMDDHHMMSS_<动词>_<对象>.ts` | `20260416120000_create_post_table.ts` |
| 环境变量 | SCREAMING_SNAKE_CASE | `DATABASE_URL` / `JWT_SECRET` |
| 事件名（BullMQ / WebSocket） | dot.case | `post.created` / `comment.created` |

## 4. 实体建模要点

以下是必须存在的实体骨架。完整字段与关系在实现时按 [`requirements.md`](./requirements.md) 与前端 `types.ts` 精确对齐。

### 4.1 内容类

- **`Post`**（映射 `PostItem` + `ArticleDetail`）：`id`（uuid v7）、`title`、`slug`、`summary`、`cover`、`category`、`readTimeMinutes`、`contentRaw`（Markdown）、`contentSections`（JSONB，缓存解析后的 `ArticleSection[]`）、`pinned`、`status`（`draft | published | archived`）、`publishedAt`、`views`、`likes`、`commentCount`、`createdAt`、`updatedAt`
- **`PostTag`**：`id`、`label`、`slug`、`color`、`count`（冗余）
- **`PostTagMap`**：多对多联结（`postId`、`tagId`）
- **`Comment`**（文章评论，树形）：`id`、`postId`、`parentId`（自引用）、`authorSnapshot`（`{ name, avatar, visitorIdHash? }` JSONB）、`content`、`likes`、`isOwner`、`createdAt`
- **`Moment`**（映射 `MomentItem`）：`id`、`content`、`images` (`jsonb` 数组)、`topics`、`location`、`device`、`linkedArticleId`、`likes`、`commentCount`、`createdAt`
- **`MomentComment`**：结构类似 `Comment`
- **`FlashNote`**：`id`、`userId`、`content`、`tags` (`jsonb` 数组)、`likes`、`commentCount`、`createdAt`、`updatedAt`
- **`FlashComment`**：`id`、`flashNoteId`、`authorId`（visitorIdHash 或 adminId）、`authorName`、`authorAvatar`、`content`、`createdAt`
- **`FlashEmbedding`**：`flashNoteId`（主键）、`vector vector(1536)`、`model`、`version`、`updatedAt`

### 4.2 互动类

- **`PostLike`** / **`MomentLike`** / **`FlashLike`** / **`CommentLike`**：`id`、`targetId`、`visitorIdHash`、`createdAt`。联合唯一索引 `(targetId, visitorIdHash)`，点赞切换通过先查后决定 insert/delete
- **`PostView`**：`id`、`postId`、`visitorIdHash`、`hourBucket`（`date_trunc('hour', now())`），联合唯一索引用于 1 小时去重

### 4.3 留言板

- **`GuestMessage`**：`id`、`authorSnapshot` JSONB、`content`、`replyToSnapshot` JSONB（可空）、`browser`、`region`、`status`、`createdAt`
- **`MessageReaction`**：`id`、`messageId`、`emoji`、`visitorIdHash`，联合唯一 `(messageId, emoji, visitorIdHash)`
- **`PinnedMessage`**：单行表，或 `SiteConfig.pinnedMessageId` 外键

### 4.4 资源类

- **`Photo`**（映射 `PhotoItem`）：`id`、`title`、`description`、`src`、`srcLarge`、`category`、`takenAt`、`location`、`exif` JSONB
- **`Gear`**（映射 `GearItem`）：`id`、`icon`、`name`、`description`、`sort`
- **`FriendLink`**（映射 `LinkItem`）：`id`、`name`、`description`、`url`、`avatar`、`domain`、`status`（`pending | approved | rejected | inactive`）、`lastCheckedAt`
- **`LinkApplication`**：申请队列的快照，approve 后创建 `FriendLink`
- **`Project`**（映射 `ProjectItem`）：`id`、`title`、`description`、`cover`、`status`、`stars`、`forks`、`tags` JSONB、`links` JSONB、`githubRepo`（owner/repo）

### 4.5 身份与配置

- **`AdminUser`**：`id`、`username`、`passwordHash`（argon2id）、`createdAt`、`lastLoginAt`
- **`RefreshToken`**：`id`、`adminUserId`、`tokenHash`、`deviceId`、`userAgent`、`expiresAt`、`revokedAt`
- **`VisitorIdentity`**：`visitorIdHash`（主键）、`nickname`、`avatarColor`、`firstSeenAt`、`lastSeenAt`、`messageCount`（冗余）
- **`SiteConfig`**：单行表，存 `footerLinks` / `poweredBy` / `ownerCard` / `launchedAt` / `pinnedMessageId` 等（大部分字段用 JSONB 列）
- **`Announcement`**（映射 `SiteAnnouncement`）：`id`、`content`、`date`、`pinned`
- **`OwnerPresence`**：单行表，存当前 `status` / `label` / `signature` / `since`
- **`AboutProfile`**：单行表，JSONB 列存整块 profile / skills / experiences / contacts / hobbies / books
- **`NavItem`**（映射 `NavItem`）：`id`、`icon`、`label`、`to`、`desktopOnly`、`sort`

## 5. 编码规范

### 5.1 文件头注释

每个 `.ts` 文件首行必须有 JSDoc，与前端风格一致：

```typescript
/**
 * @file post.service.ts
 * @description 文章业务逻辑（列表、详情、点赞、浏览统计）
 * @author TixXin
 * @since 2026-04-16
 */
```

- 注释使用中文
- 新建文件 `@since` 填当日日期；重大重写可更新

### 5.2 语言与风格

- TypeScript `strict: true`，禁用 `any`（`@typescript-eslint/no-explicit-any: error`）
- 不使用默认导出，全部命名导出
- `const` 优先于 `let`，完全禁用 `var`
- 字符串统一单引号，禁用分号（与前端 Prettier 一致）
- 行宽 120，尾随逗号
- LF 行尾
- 函数签名必须显式标注返回类型（除单行箭头函数）

### 5.3 Nest 分层

- **Controller**：只做参数校验 + 调 Service + 构造响应。不写业务逻辑
- **Service**：业务逻辑主体。纯业务不依赖 HTTP 上下文
- **Repository**：复杂查询。继承 `EntityRepository<T>`，放 `findManyByTag()` 之类方法
- **Guard / Interceptor / Pipe**：跨模块复用的放 `common/`；模块专属的放对应 `modules/<name>/`

### 5.4 DTO 与校验

- 所有请求 body / query 必须有 DTO
- 统一使用 `class-validator` + `class-transformer`
- 全局启用 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
- 响应也应有 DTO（或 `interface`），确保响应字段与前端 `types.ts` 一致；**不直接返回实体对象**

### 5.5 MikroORM 使用

- 每个 Service 注入 `EntityManager` 或专属 `Repository`
- 必须使用 **`@CreateRequestContext()`** 装饰异步服务方法（非 HTTP 入口），避免 IdentityMap 跨请求污染：

```typescript
import { CreateRequestContext, MikroORM } from '@mikro-orm/core'

@Injectable()
export class RebuildService {
  constructor(private readonly orm: MikroORM) {}

  @CreateRequestContext()
  async rebuildSearchIndex() {
    const posts = await this.orm.em.find(Post, {})
    // ...
  }
}
```

- HTTP 路径由 `main.ts` 全局中间件统一创建上下文：
  ```typescript
  app.use((req, _res, next) => RequestContext.create(orm.em, next))
  ```
- 查询时**显式 populate 关联**，杜绝 N+1：
  ```typescript
  await em.find(Post, { status: 'published' }, { populate: ['tags'] })
  ```
- Service 方法结束前显式 `await em.flush()`，不依赖隐式 flush

### 5.6 日志

- 统一 `nestjs-pino`，通过构造函数注入 `Logger`：
  ```typescript
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(PostService.name)
  }
  ```
- 禁用 `console.*`（ESLint `no-console: error`）
- 日志级别：`error` 用于真实错误；`warn` 用于可恢复异常；`info` 用于业务里程碑；`debug` 用于详细流程

### 5.7 错误处理

- Service 内抛 Nest 内置异常（`NotFoundException` / `BadRequestException` / `ForbiddenException`）
- 业务错误码用自定义 `BusinessException(code: number, message: string)`，由全局过滤器包装为 `{ code, message, data: null, traceId }`
- 切勿吞掉错误；必须 catch 时记录并重抛或转换

## 6. Git 规范

复用根 `.cursor/rules/git-commit-message.mdc` 的 Conventional Commits + 中文 subject 规则。后端新增允许的 scope：

| Scope | 作用 |
|-------|------|
| `server` | 后端整体配置、入口、基础设施 |
| `schema` | 实体定义变更 |
| `migration` | 数据库迁移 |
| `auth` | 鉴权相关 |
| `search` | Meilisearch / 全文搜索 |
| `ai` | Embedding / 语义检索 |
| `worker` | BullMQ 队列与消费者 |
| `feed` | RSS / Atom / JSON Feed |
| `upload` | 文件上传 |
| `ws` | WebSocket Gateway |

**禁止在 commit message 中添加 `Co-Authored-By` / `Generated with ...` 等 AI 署名**（与仓库现有约定一致）。

## 7. 本地开发流程

### 7.1 首次准备

```bash
cd src/backend/server-main

# 复制环境变量模板
cp .env.example .env.local

# 起本地依赖栈（postgres / redis / meilisearch / minio）
docker compose -f docker-compose.yml up -d

# 安装依赖
pnpm install

# 执行迁移
pnpm mikro-orm migration:up

# 填充开发数据（从前端 mock 读取）
pnpm seed:dev
```

### 7.2 日常启动

```bash
# 一次性起 HTTP 服务 + Worker 进程
pnpm start:dev          # app 热重载
pnpm start:worker:dev   # BullMQ 消费者（独立终端）
```

### 7.3 环境变量清单

`.env.example` 必须包含以下变量（不提供默认值的用 `<required>` 占位）：

```bash
NODE_ENV=development
PORT=3000

DATABASE_URL=postgres://tixxin:tixxin@localhost:5432/tixxin_blog
REDIS_URL=redis://localhost:6379

MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=<required>

S3_ENDPOINT=http://localhost:9000
S3_BUCKET=tixxin-blog
S3_ACCESS_KEY_ID=<required>
S3_SECRET_ACCESS_KEY=<required>
S3_PUBLIC_BASE_URL=http://localhost:9000/tixxin-blog

JWT_ACCESS_SECRET=<required>
JWT_REFRESH_SECRET=<required>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=<required>

AI_EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=<required>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3456
```

### 7.4 前端联调

前端仓库 `.env`：

```bash
NUXT_PUBLIC_USE_MOCK_REPO=false
NUXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NUXT_PUBLIC_WS_BASE_URL=ws://localhost:3000
```

## 8. Migration 与 Seed 策略

### 8.1 Migration

- **手工命名**：`pnpm mikro-orm migration:create --name create_post_table`，避免默认时间戳名称的不可读性
- 每个 migration **只做一件事**：加表、加列、加索引、调整数据各一条迁移
- 不可逆操作（drop column / drop table）必须在 PR 描述中显式警告
- CI 启动时运行 `migration:check`（pending 变更数必须为 0）

### 8.2 Seeder

分三档：

| Seeder | 场景 | 数据来源 |
|--------|------|---------|
| `DevSeeder` | 本地开发 | 从 `src/frontend/web-blog/app/features/<domain>/mock.ts` 读取，保证前后端数据同源 |
| `DemoSeeder` | 演示环境 / 预发 | 精简版（每域 3-5 条） |
| `ProdSeeder` | 首次生产部署 | 仅 `AdminUser` + `SiteConfig` + `AboutProfile` + `NavItem` |

`DevSeeder` 实现策略：

```typescript
// seeders/dev.seeder.ts
import { mockPosts } from '../../../../frontend/web-blog/app/features/post/mock'
```

通过 TypeScript `paths` 或 `tsx` 直接跨 workspace 引用。这避免了"mock 改了 seed 没改"的双维护问题。

## 9. 测试策略

### 9.1 分层

| 层 | 框架 | 覆盖率目标 | 说明 |
|----|------|-----------|------|
| 单元 | Jest | Service ≥ 80% | 纯逻辑，mock Repository |
| 集成 | Jest + Testcontainers | 核心 Service 100% | 起真实 Postgres / Redis |
| e2e | Jest + Supertest | 每个 Controller ≥ 1 条 happy path + 1 条权限拒绝 | 覆盖 Guard |

### 9.2 约定

- 测试文件命名：`*.spec.ts`（单元） / `*.e2e-spec.ts`（e2e）
- 测试数据使用 `@mikro-orm/seeder` 的 Factory
- 每个测试前 `em.clear()`，e2e 测试用 `migration:fresh` 重建 schema
- CI：`jest --coverage --ci --maxWorkers=2`

## 10. 前后端联调切换

### 10.1 开关位置

前端 `nuxt.config.ts`：

```typescript
runtimeConfig: {
  public: {
    useMockRepo: process.env.NUXT_PUBLIC_USE_MOCK_REPO !== 'false',
    apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? '',
    wsBaseUrl: process.env.NUXT_PUBLIC_WS_BASE_URL ?? '',
  },
},
```

### 10.2 Composable 改造示例

以 `useNavItems` 为例（仅示意，实际实现时由前端同事按此思路重构）：

```typescript
// composables/useNavItems.ts
import { mockNavItems } from '~/features/nav/mock'
import type { NavItem } from '~/features/nav/types'

export function useNavItems() {
  const config = useRuntimeConfig()

  if (config.public.useMockRepo) {
    return { data: ref<NavItem[]>(mockNavItems), pending: ref(false), error: ref(null) }
  }

  return useAsyncData<NavItem[]>('nav-items', () =>
    $fetch(`${config.public.apiBaseUrl}/nav/items`),
  )
}
```

**关键点**：签名（返回 `NavItem[]` 或 Nuxt `useAsyncData` 结构）在两种模式下保持一致，组件无需改动。

### 10.3 切换验证清单

- [ ] 首页渲染文章列表
- [ ] `/articles/[id]` 详情 + 评论
- [ ] `/moments` 朋友圈 + 点赞
- [ ] `/guestbook` 留言板 + emoji 反应 + 回复
- [ ] `/flash` 闪念列表 + AI 搜索
- [ ] `/gallery` 灯箱预览
- [ ] `/links` 友链列表
- [ ] `/projects` 项目展示
- [ ] `/about` 关于
- [ ] 顶部公告 / 博主在线状态 / 页脚 / 导航

## 11. CI / CD

### 11.1 GitHub Actions

新增 `.github/workflows/backend-ci.yml`：

```text
jobs:
  backend:
    服务: postgres:16, redis:7, meilisearch:v1.9
    步骤:
      - pnpm install
      - pnpm --filter server-main lint
      - pnpm --filter server-main typecheck
      - pnpm --filter server-main test
      - pnpm --filter server-main test:e2e
      - pnpm --filter server-main mikro-orm migration:check
      - pnpm --filter server-main build
      - docker build -t tixxin-blog-server .
```

触发条件：push 到 main 或 PR 改动 `src/backend/**`。

### 11.2 版本发布

- 镜像 tag：`server-main:<git-sha>`（每次 push 发）+ `server-main:v<semver>`（打 tag 时发）
- 迁移：每次发布前单独跑 `pnpm --filter server-main mikro-orm migration:up` 容器

## 12. 部署

### 12.1 单机 docker-compose（最小化）

```yaml
# 伪码示意，详细配置跟随工程初始化补全
services:
  app:
    image: tixxin-blog-server:latest
    ports: ['3000:3000']
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://...
      # ...
    depends_on: [postgres, redis, meilisearch]
  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
  meilisearch:
    image: getmeili/meilisearch:v1.9
volumes:
  pgdata:
```

### 12.2 生产规划（Kubernetes）

- app Deployment：2 副本，滚动升级，就绪探针 `/ready`，存活探针 `/health`
- Worker Deployment：独立 1 副本（BullMQ 消费者）
- PostgreSQL：托管服务（Supabase / Neon / RDS）
- Redis：托管服务（Upstash / ElastiCache）
- Meilisearch：自部署 + 持久卷
- Ingress：Nginx，配 `proxy_read_timeout 60s`，WebSocket 单独规则

### 12.3 零停机迁移

- 先跑迁移容器 → 通过 → 再滚动更新 app
- 不可逆迁移（drop column）拆成两次发布：先代码不再读旧列，再发布迁移

## 13. 性能与可观测性

- **日志**：`pino-http` 打印入站请求 / 响应 / 耗时，过滤 `/health` / `/metrics`
- **慢查询**：`mikro-orm.config.ts` 启用 `debug: ['query']`，超过 200ms 的查询额外 `logger.warn`
- **Metrics**：`@willsoto/nestjs-prometheus` 暴露 `/metrics`：
  - `http_requests_total{route, method, status}`
  - `http_request_duration_seconds` 直方图
  - `mikroorm_query_duration_seconds`
  - `bullmq_jobs_active{queue}`
- **Trace**：OpenTelemetry 自动 instrument（HTTP / Postgres / Redis / BullMQ），导出到 Tempo / Jaeger / Grafana Cloud（按部署环境选）
- **错误上报**：Sentry 可选，`SENTRY_DSN` 为空时不启用

## 14. 常见陷阱与对应策略

| 陷阱 | 症状 | 对应策略 |
|------|------|---------|
| MikroORM IdentityMap 跨请求污染 | "Using global EntityManager" 警告、数据错乱 | HTTP 走全局 `RequestContext.create` 中间件；Worker / 定时任务用 `@CreateRequestContext()` |
| UnitOfWork 没 flush | 数据未落库 | 所有写操作末尾显式 `await em.flush()` |
| N+1 查询 | 列表接口慢 | 显式 `populate`；必要时用 `QueryBuilder` |
| Meilisearch 索引不同步 | 前端搜到"幽灵"或搜不到新内容 | 写操作通过 BullMQ 异步同步；提供 `POST /admin/search/reindex` 手动修复 |
| WebSocket 在多实例下广播失效 | 只有部分用户收到事件 | 启用 `@socket.io/redis-adapter` |
| JWT secret 泄漏 | 任意签发 access token | 用足够长（≥ 32 字节）的随机 secret；Refresh 独立 secret |
| Argon2 参数过低 | 密码爆破风险 | 至少 `m=65536, t=3, p=4` |
| 上传流量压垮后端 | 大图片上传时 app 实例 CPU 飙升 | 强制预签名 URL 直传，不经后端 |
| pgvector 维度错配 | 查询报 `expected 1536 dimensions` | 切换 embedding 提供商时新建表并 backfill，不就地修改 |
| CORS 漏配 | 前端请求被浏览器拦 | `CORS_ORIGIN` 环境变量支持逗号分隔多 origin；生产只放白名单 |

## 15. 变更历史

| 日期 | 变更 | 说明 |
|------|------|------|
| 2026-04-16 | 初版 | 工程结构、规范、流程、部署首版 |
