# TixXinBlog 后端技术栈

本文沉淀后端服务的技术选型、版本基线、关键依赖与取舍理由。所有版本号均为基线值，允许向上浮动，但跨大版本升级必须在此补充变更说明。

## 1. 总览表

| 层次 | 选型 | 基线版本 | 备注 |
|------|------|----------|------|
| 运行时 | Node.js | >= 20 LTS | 与前端一致，优先偶数 LTS |
| 包管理 | pnpm | >= 9.15.0 | workspace 下统一 |
| 框架 | NestJS | ^11 | 模块化、装饰器、DI |
| ORM | MikroORM | ^6 | 取代 project-architecture.md 原定的 Prisma |
| 数据库 | PostgreSQL | 16 | 扩展：`pg_trgm`、`uuid-ossp`、`pgvector` |
| 搜索 | Meilisearch | ^1.9 | 覆盖 post / moment / flash 三索引 |
| 缓存与队列底板 | Redis | ^7.2 | session 黑名单、限流桶、BullMQ 持久化 |
| 任务队列 | BullMQ | ^5 | 异步任务、定时任务 |
| 对象存储 | S3 兼容（生产 Cloudflare R2） | - | 本地用 MinIO；后端只存 meta |
| AI / 向量 | OpenAI Embedding + pgvector | text-embedding-3-small | 可切本地 bge-m3 |
| 实时通信 | socket.io + Redis 适配器 | ^4 | 多实例广播 |
| 鉴权 | @nestjs/jwt + passport-jwt | - | access / refresh 分离 |
| 日志 | pino + nestjs-pino | ^9 / ^4 | 结构化 JSON |
| 可观测性 | OpenTelemetry（可选 Sentry） | - | HTTP / DB / Redis 自动 instrument |
| 测试 | Jest + Supertest + Testcontainers | - | 真实依赖 e2e |
| 容器 | Docker（多阶段）+ docker-compose | - | 本地与生产统一 |
| 代码质量 | ESLint + Prettier + Husky + commitlint | - | 复用前端配置 |

## 2. Node.js 运行时

- 固定 `engines.node >= 20`，避免引入 22 的实验特性
- 生产镜像运行 `node dist/main.js`，不引入 `ts-node`、`tsx` 等解释运行依赖
- 时区统一 `UTC`，面向前端输出时再由前端按地区格式化
- 异步代码默认使用 `async/await`，禁用 `callback` 风格；文件系统与 crypto 使用 `node:` 前缀以明确来源

## 3. NestJS

选用理由：

- 模块化体系（Module / Controller / Service / Provider）与前端 `features/<domain>/` 的领域划分思路天然对齐
- 装饰器驱动，DTO + `class-validator` 让请求校验内聚到类型定义
- CLI 成熟，`nest g module post` 等命令可直接生成骨架
- 与 MikroORM 有官方集成包 `@mikro-orm/nestjs`

约束：

- **不启用** GraphQL、Microservices、CQRS、TCP transport 等初期不需要的特性，避免过度设计
- 路由前缀统一 `/api/v1`，版本前缀通过 `app.setGlobalPrefix('api/v1')` 设置
- 全局启用 `ValidationPipe`（`whitelist: true` + `forbidNonWhitelisted: true`），拒绝未声明字段
- 异常过滤器统一包装为 `{ code, message, data, traceId }` 响应格式（见 [api.md 第 2 节](./api.md#2-统一响应格式)）

## 4. MikroORM

与 `project-architecture.md` 原定 Prisma 的替换说明：

| 维度 | Prisma | MikroORM（当前选择） |
|------|--------|---------------------|
| 风格 | Schema-first，自成 DSL | Decorator-first，贴近 TypeScript |
| Identity Map | 无（每次查询都是新对象） | 有，配合 UnitOfWork 自动 flush |
| NestJS 集成 | 社区包 | 官方包 `@mikro-orm/nestjs` |
| 迁移 | `prisma migrate` | `mikro-orm migration:create/up/down` |
| 学习曲线 | 低 | 中，需理解 Identity Map 与请求上下文 |

选择 MikroORM 的核心原因：Decorator 实体风格与 NestJS 完全一致，且 `pgvector` 自定义类型扩展比 Prisma 自绘更直观。

### 4.1 基线依赖

```text
@mikro-orm/core
@mikro-orm/postgresql
@mikro-orm/nestjs
@mikro-orm/migrations
@mikro-orm/seeder
@mikro-orm/reflection
```

全部锁定 `^6`。

### 4.2 实体风格

- **统一使用 Decorator 写法**（`@Entity()` / `@Property()` / `@ManyToOne()`），不混用 `EntitySchema`
- 所有实体放 `src/entities/`，按域命名文件：`post.entity.ts`、`moment.entity.ts`
- 主键统一 `uuid v7`（生成方式：`uuid/v7`），不使用自增整数；前端 `PostItem.id: number` 的差异在响应层通过 `bigint` hash 对齐
- 时间字段统一 `createdAt` / `updatedAt`，由 `@Property({ onCreate/onUpdate })` 自动维护

### 4.3 请求上下文

必须使用 **`@CreateRequestContext()`** 装饰器（MikroORM v6 的最新 API，取代旧版 `@UseRequestContext()`）为异步方法开启独立的 EntityManager fork：

```typescript
import { CreateRequestContext, MikroORM } from '@mikro-orm/core'

export class PostService {
  constructor(private readonly orm: MikroORM) {}

  @CreateRequestContext()
  async rebuildSearchIndex() {
    const em = this.orm.em.fork() // 每个请求一个独立 IdentityMap
    // ...
  }
}
```

HTTP 请求路径上推荐全局中间件注入：

```typescript
// main.ts
app.use((req, res, next) => {
  RequestContext.create(orm.em, next)
})
```

不这样做会出现 "Using global EntityManager instance directly" 警告，且可能导致跨请求数据泄漏。

### 4.4 常见陷阱

| 陷阱 | 规避方式 |
|------|---------|
| N+1 查询 | 显式使用 `populate: [...]` 或 `populateWhere: 'infer'` |
| UnitOfWork 未 flush | Service 层手动 `await em.flush()`，不依赖隐式 flush |
| 多实例 / Worker 共享 em | 每个 fork 使用独立 em；Worker 进程单独 `RequestContext.create()` |
| 循环引用 | 实体间 `{ ref: true }` + 懒加载 |

## 5. PostgreSQL

- 版本：16（提供逻辑复制、MERGE 语法、增量 VACUUM）
- 字符集：`UTF8`，Collation `en_US.utf8`
- 必装扩展：
  - `pg_trgm`：标签模糊搜索、文章标题 similarity 排序
  - `uuid-ossp`：uuid 生成（若运行时 Node.js 生成则可省略）
  - `pgvector`：闪念笔记 embedding 存储（维度固定 1536，对齐 `text-embedding-3-small`）
- 连接池：`@mikro-orm/postgresql` 内置 `knex` 连接池，生产配置 `pool.min = 2, pool.max = 20`
- 备份：每日 `pg_dump` 到对象存储，保留 30 天；搭配 WAL 归档用于点对点恢复

## 6. Meilisearch

- 版本：^1.9，运行于独立容器
- 索引设计：

| 索引名 | 数据源 | searchableAttributes | filterableAttributes | sortableAttributes |
|--------|--------|---------------------|---------------------|-------------------|
| `posts` | `Post` | `title`, `summary`, `content` | `category`, `tags`, `pinned` | `date`, `views`, `likes` |
| `moments` | `Moment` | `content`, `topics` | `topics`, `location`, `authorId` | `date`, `likes` |
| `flashes` | `FlashNote` | `content`, `tags` | `tags`, `userId` | `createdAt`, `likes` |

- 中文分词：Meilisearch 1.8+ 内置对 CJK 的 unigram 切分，无需额外插件
- 典型设置（以 `posts` 索引为例）：

```json
{
  "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
  "typoTolerance": { "minWordSizeForTypos": { "oneTypo": 4, "twoTypos": 8 } },
  "pagination": { "maxTotalHits": 5000 },
  "searchCutoffMs": 150
}
```

- 写入策略：MikroORM 实体 `afterCreate` / `afterUpdate` hook 入队 BullMQ 任务，由 Worker 调用 Meilisearch API 同步；**不在请求线程同步写索引**
- 重建：管理员 API `POST /admin/search/reindex?index=posts` 触发全量重建

## 7. Redis

用途：

- 会话 refresh token 黑名单（短期 TTL）
- 限流令牌桶（匿名写接口 10 req/min，按 IP + 指纹复合键）
- BullMQ 队列背板
- 热点接口缓存（`GET /stats/site`、`GET /nav/items` 等）

版本：^7.2。生产部署启用 `appendonly yes`。不使用 Redis 作为主存储。

## 8. BullMQ

异步任务与定时任务统一走 BullMQ：

| 队列名 | 触发 | 作用 |
|--------|------|------|
| `search-sync` | 实体写入 hook | 同步 Meilisearch 索引 |
| `embedding` | FlashNote 创建/更新 | 调用 Embedding API 并写入 pgvector |
| `rss-refresh` | 定时（每 10 分钟） | 重建 RSS / Atom / JSON Feed 缓存 |
| `github-stars` | 定时（每小时） | 刷新 `Project` 的 star 数 |
| `notification` | 应用事件 | WebSocket 广播新评论 / 新留言 |

Worker 独立进程运行（`pnpm start:worker`），通过 `@nestjs/bullmq` 模块接入。

## 9. 对象存储

- 生产：Cloudflare R2（S3 兼容，零出站流量费用）
- 本地开发：MinIO 容器，通过环境变量 `S3_ENDPOINT` 切换
- 上传方式：**预签名 URL**。后端只提供 `POST /upload/presign` 接口返回 URL，前端直传；上传完成后前端 `POST /upload/callback` 告知后端文件已就绪
- 后端数据库只存：`url`、`size`、`mimeType`、`width`、`height`、`exif`
- 不使用 `multer` 直接接收 multipart 上传（避免后端流量瓶颈）

## 10. AI 能力

### 10.1 Embedding

- 默认提供商：OpenAI `text-embedding-3-small`（1536 维，性价比最优）
- 可切换至本地 `bge-m3`（维度 1024，需改 `pgvector` 列定义并重建索引）
- 提供商切换通过环境变量 `AI_EMBEDDING_PROVIDER=openai|bge` 实现

### 10.2 语义检索（flash）

检索流程：

1. `FlashNote` 创建 / 更新 → BullMQ `embedding` 任务
2. Worker 调用 Embedding API 得到向量
3. 存入 `flash_embedding` 表（`note_id` + `vector vector(1536)` + `version`）
4. 查询 `POST /flashes/ai-search`：
   - 对 query 算 embedding
   - `SELECT * FROM flash_embedding ORDER BY vector <=> $1 LIMIT 8`
   - 拉回对应 FlashNote
   - 按 `FlashAISearchResult` 形状返回（answer 由模板拼接 citedNoteIds 对应内容，不做 LLM 生成）

**不引入独立向量数据库**（Qdrant / Weaviate），控制部署复杂度。

## 11. 实时通信

- 模块：`@nestjs/websockets` + `@nestjs/platform-socket.io`
- 适配器：`@socket.io/redis-adapter`，使 Pub/Sub 跨实例广播
- 命名空间：
  - `/ws/public`：匿名访客可订阅（新评论、新留言事件）
  - `/ws/admin`：管理员订阅（所有内部事件 + presence 上报）
- 鉴权：连接时携带 `auth.token`（JWT），通过 `WsJwtGuard` 校验

事件清单见 [api.md 第 7.17 节](./api.md#717-notifications)。

## 12. 鉴权

- 访客：**匿名**。前端生成 `visitorId`（`@vueuse/core` `useBrowserFingerprint` + `localStorage`），每次写请求在 header `X-Visitor-Id` 携带。后端只存哈希，用于限流与展示"浏览器/地区"字段
- 管理员：`POST /auth/login` 校验账号密码 → 签发 access token（HS256 / 15min）+ refresh token（HS256 / 7d，存 Redis）
- Access token：`Authorization: Bearer <token>`
- Refresh：`POST /auth/refresh` 带 httpOnly cookie 中的 refresh token
- 退出：`POST /auth/logout` 撤销 refresh token 并加入黑名单

限流策略：

| 接口类型 | 限制 | 键 |
|---------|------|---|
| 匿名写（评论、留言、点赞） | 10 req/min | `ip + visitorIdHash` |
| 匿名读 | 120 req/min | `ip` |
| 管理员 | 600 req/min | `userId` |

实现：`@nestjs/throttler` + Redis 存储。

## 13. 日志与可观测性

- 日志：`pino` + `nestjs-pino`
  - 开发模式：`pino-pretty` 输出到 stdout
  - 生产模式：JSON 格式，挂接到容器日志驱动
  - 每条日志自动包含 `traceId`（来自 `AsyncLocalStorage`）
- metrics：`@willsoto/nestjs-prometheus` 暴露 `/metrics`
- trace：OpenTelemetry 自动 instrument HTTP / Postgres / Redis / BullMQ
- 错误上报（可选）：Sentry，通过环境变量 `SENTRY_DSN` 启用

## 14. 测试

| 层级 | 框架 | 范围 |
|------|------|------|
| 单元 | Jest | Service / Repository / 纯函数 |
| 集成 | Jest + Testcontainers | Service + 真实 Postgres / Redis / Meili |
| e2e | Jest + Supertest | Controller → 响应，覆盖守卫与过滤器 |

覆盖率门槛：Service ≥ 80%，Controller ≥ 60%，整体 ≥ 70%。CI 中使用 `jest --coverage --ci` 生成报告。

## 15. 工程工具

- ESLint：复用前端 `@nuxt/eslint` 规则集的基础部分 + `@typescript-eslint/recommended-type-checked`
- Prettier：与前端保持 `single quotes、no semicolons、120 print width、trailing commas`
- Husky + lint-staged：复用根目录 `.husky/`，在 pre-commit 对后端路径追加 `nest build --noEmit` 检查
- commitlint：沿用 `.cursor/rules/git-commit-message.mdc` 的中文 subject + 8 种 type，新增 scope：`server`、`schema`、`migration`、`auth`、`search`、`ai`
- 禁用 `console.*`（由 ESLint `no-console: error` 强制），统一走 `Logger`

## 16. 容器化

### 16.1 镜像

多阶段 Dockerfile，最终运行层基于 `node:20-alpine`：

```text
Stage 1 deps   : pnpm install --frozen-lockfile（production=false）
Stage 2 build  : pnpm build → dist/
Stage 3 runtime: 仅拷贝 dist + production deps，node dist/main.js
```

镜像最终大小目标 < 250MB。不在镜像中包含 `.env`、测试资源。

### 16.2 本地依赖栈

`src/backend/server-main/docker-compose.yml` 编排：

- `postgres:16-alpine`（5432）
- `redis:7-alpine`（6379）
- `getmeili/meilisearch:v1.9`（7700）
- `minio/minio:latest`（9000 / 9001）

开发者只需 `docker compose up -d`，无需本地安装任何依赖服务。

## 17. 版本升级策略

- Node / pnpm：跟随 LTS 节奏
- NestJS：跨大版本升级必须先在 feature 分支运行全量 e2e 通过后合并
- MikroORM：跨大版本升级前阅读 migration 章节，必要时单独生成兼容迁移
- Meilisearch：跨大版本升级时通过 `meilisearch-dumps` 导出 / 导入
- PostgreSQL：跨大版本升级使用 `pg_upgrade`，停机窗口 < 30min

每次升级在 `CHANGELOG.md`（规划中）记录，同步更新本文件"基线版本"列。
