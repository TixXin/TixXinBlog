# server-main

TixXinBlog 后端服务(NestJS 11 + MikroORM 6 + PostgreSQL 16)。完整设计文档见 [`docs/backend/`](../../../docs/backend/README.md),当前处于**工程初始化完成、实体建模未开始**阶段。

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
pnpm build       # nest build 产出 dist/
pnpm lint        # ESLint 检查
pnpm typecheck   # tsc --noEmit
pnpm test        # Jest 单元测试
pnpm mikro-orm   # MikroORM CLI(迁移 / seeder,实体建模阶段启用)
```

## 当前实现范围

- 入口引导:全局前缀、`ValidationPipe`(whitelist + forbidNonWhitelisted + transform)、CORS 白名单
- 统一响应:`{ code, message, data, traceId }` 包装拦截器 + 全局异常过滤器(错误码对齐 api.md 附录 A)
- 结构化日志:nestjs-pino(开发期 pino-pretty,探针请求不打日志)
- 环境变量启动期校验(class-validator)
- 健康探针模块 + 单元测试
- MikroORM / 迁移 / Seeder 配置就位(尚未在 AppModule 注册,待实体建模阶段启用)

## 下一阶段

按 [`docs/backend/development.md`](../../../docs/backend/development.md) §1 阶段表推进:实体建模 → 最小闭环(post 读写 + 前端 `useMockRepo=false` 联调)→ 分域完整功能。任务清单见 [todo.md](./todo.md)。
