# server-main

TixXinBlog 后端服务(NestJS 11 + MikroORM 6 + PostgreSQL 16)。完整设计文档见 [`docs/backend/`](../../../docs/backend/README.md),已实现文章、鉴权、评论及闪念接口；文章与评论前端联调使用独立的 `NUXT_PUBLIC_POST_USE_MOCK_REPO=false`。

## 快速开始

```bash
cd src/backend/server-main

# 需要 Node 24 与 pnpm 9.15.0（推荐 corepack pnpm）
# 复制环境变量模板
cp .env.example .env.local
# 填写 DATABASE_URL 和至少 32 位 JWT_ACCESS_SECRET
# 首次 seed 还需显式填写至少 12 位 ADMIN_DEFAULT_PASSWORD；已有账号不会重置

# 当前已接入模块只需要 PostgreSQL；复用已有数据库卷
docker compose --env-file .env.local up -d postgres

# 安装依赖(在仓库根执行亦可)
pnpm install

# 检查并应用尚未执行的迁移；已有数据不需要重复 seed
pnpm migration:up
pnpm migration:check

# 开发模式(热重载)
pnpm start:dev
```

服务默认监听 `3000` 端口:

Windows 重启后若 5432 落入系统保留端口范围，可在 `.env.local` 将 `POSTGRES_PORT` 改为一个空闲端口，并同步修改 `DATABASE_URL` 端口，然后重新执行上面的 Compose 命令。该操作复用原 `pgdata` 数据卷，不要执行 `down -v`。

- `GET /health` — 存活探针(根路径,供 K8s / 反代直接访问)
- `GET /ready` — 就绪探针
- 业务接口统一前缀 `/api/v1`(契约见 [`docs/backend/api.md`](../../../docs/backend/api.md))

## 常用命令

```bash
pnpm build              # nest build 产出 dist/
pnpm lint               # ESLint 检查
pnpm typecheck          # tsc --noEmit
pnpm test               # Jest 单元测试
pnpm migration:up       # 执行待应用迁移(tsx)
pnpm migration:create <name>  # 依实体差异生成新迁移
pnpm migration:check    # CI 门禁:无待应用迁移且实体与 schema 零漂移
pnpm seed:dev           # DevSeeder:从前端 post mock 灌种子数据(50 篇文章 + 管理员)
```

## 镜像构建

```bash
# 构建上下文为仓库根目录
docker build -f src/backend/server-main/Dockerfile -t tixxin-blog-server .
# 运行需显式提供 JWT_ACCESS_SECRET 与 DATABASE_URL
docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_ACCESS_SECRET=... tixxin-blog-server
```

## 当前实现范围

- 入口引导:全局前缀、`ValidationPipe`(whitelist + forbidNonWhitelisted + transform)、CORS 白名单
- 统一响应:`{ code, message, data, traceId }` 包装拦截器 + 全局异常过滤器(错误码对齐 api.md 附录 A)
- 结构化日志:nestjs-pino(开发期 pino-pretty,探针请求不打日志)
- 环境变量启动期校验(class-validator)
- post 域实体(Post / PostTag / PostLike / PostView)+ auth/评论实体(AdminUser / RefreshToken / Comment / CommentLike)+ 迁移 + DevSeeder(50 篇文章 + 管理员)
- 文章接口(经真实 PostgreSQL 实测):
  - `GET /api/v1/posts` — 分页列表,支持 category / tag / search / pinned / sort / order
  - `GET /api/v1/posts/:id` — 详情(正文块 + TOC),字段对齐前端 `ArticleDetail`
  - `POST /api/v1/posts/:id/like` — 点赞切换(需 `X-Visitor-Id` 头)
  - `POST /api/v1/posts/:id/view` — 浏览计数(同访客 1 小时去重)
- 鉴权接口(api.md §7.1,21 项链路验证通过):
  - `POST /api/v1/auth/login` — argon2id 校验,签发 access JWT + refresh cookie(`tixxin_rt`)
  - `POST /api/v1/auth/refresh` — refresh token 轮换(旧 token 立即作废)
  - `POST /api/v1/auth/logout` / `GET /api/v1/auth/me` — Bearer 守卫保护
- 评论接口:
  - `GET /api/v1/posts/:id/comments` — 评论树(嵌套 replies)
  - `POST /api/v1/posts/:id/comments` — 发表(归档拒评 1002 / 层级超限 1003)
  - `POST /api/v1/comments/:id/like` — 评论点赞切换
- 健康探针模块与单元测试(9 个用例)

## 下一阶段

文章/闪念管理、修订/冲突保护、SEO 地址、媒体上传引用保护、文章批量回收和评论审核已实现。站点设置、活跃会话、审计及备份恢复已接入。任务与验收清单见 [长期维护进度](../../../docs/admin-long-term-progress.md) 和 [todo.md](./todo.md)。

## 本地配置注意

已有 `.env.local` 时保留其中的数据库连接与密钥。新建环境只需设置 `NODE_ENV=development`、`PORT=3000`、`DATABASE_URL`、随机生成的 `JWT_ACCESS_SECRET`、`CORS_ORIGIN=http://localhost:3456`；未接入的外部服务无需填写真实凭据。
入口、迁移与 Seeder 统一加载本地环境文件；数据库连接和 JWT 密钥必须显式配置，没有默认凭据。本机 PostgreSQL 当前映射至 15433，复用原持久卷。仅空库需要 `corepack pnpm --filter server-main seed:dev`，不要清库。

`/health` 检查进程存活，`/ready` 实际探测数据库；数据库失败返回 503，恢复连接后可重新就绪。联调还需验证同源文章与评论接口。
验收记录见 [评论联调](../../../docs/comment-integration-validation.md)。

## 内容与媒体数据维护

执行 `corepack pnpm --filter server-main migration:up` 后运行 `migration:check`。新增迁移保留已有文章、评论与账号；评论默认已通过，先审后发默认关闭。文章回收先转草稿并保留关联记录，永久删除必须使用短期批量预览和明确确认。评论审核/删除需读取上下文指纹，旧管理客户端必须同步升级。

媒体本地目录由 MEDIA_DIRECTORY 指定，默认 ./var/media；生产容器挂载 /app/var/media，运行用户为 node。备份必须同时包含 PostgreSQL 和媒体目录；回收不会物理删除图片。内容包迁入、完整快照备份和隔离恢复已实现并验证，操作步骤见 [备份与恢复](../../../docs/backup-and-recovery.md)。

`corepack pnpm --filter server-main test:integration` 创建随机命名本机隔离数据库及独立临时媒体目录，验证后只清理自己的测试数据，不使用开发文章测试删除或改密。

后端 `start:dev` 使用 tsconfig.dev.json 和独立 .dev-dist，保留终端输出；生产 build 仍写 dist，两者不会互相清理。迁移路径相对当前运行产物解析，CLI 继续使用源码迁移。
