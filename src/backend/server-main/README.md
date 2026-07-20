# server-main

TixXinBlog 后端服务(NestJS 11 + MikroORM 6 + PostgreSQL 16)。完整设计文档见 [`docs/backend/`](../../../docs/backend/README.md),当前已完成**工程初始化 + post 域最小闭环**(列表/详情/点赞/浏览计数),等待前端 `useMockRepo=false` 联调。

## 快速开始

```bash
cd src/backend/server-main

# 复制环境变量模板
cp .env.example .env.local

# 起本地依赖栈(postgres / redis / meilisearch / minio,需 Docker)
docker compose up -d

# 安装依赖(在仓库根执行亦可)
pnpm install

# 开发模式(热重载)
pnpm start:dev
```

服务默认监听 `3000` 端口:

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

backend-ci workflow;评论发表 UI 接入(前端);其余域(moment/flash/guestbook 等)接口。任务清单见 [todo.md](./todo.md)。
