# 开发启动与自检

在仓库根目录使用固定 Node 24 和 pnpm 9.15.0：

```bash
corepack pnpm dev:check
corepack pnpm dev:all
```

`dev:check` 只读检查配置、依赖、数据库认证与连接、待迁移项，以及前后端服务归属和就绪契约。全部通过返回 0，未运行、冲突或故障返回非零。

`dev:all` 先检查数据库，再依次启动或复用 API 与前端。原 `dev` / `dev:blog` 仍只启动 Nuxt，`dev:api` 仍只启动 Nest。完整链路要求真实 API 模式。

## 安装准备与构建目录

首次检出后执行 `corepack pnpm install --frozen-lockfile`。安装阶段的 `nuxt prepare` 在标准 `.nuxt/` 生成 ESLint 配置和 TypeScript 引用；需要重新准备时可运行 `corepack pnpm --filter web-blog exec nuxt prepare`。`nuxt typecheck` 同样使用该目录，不依赖其他工作区的生成缓存。

生产构建与静态生成使用仓库支持的 `corepack pnpm build`、`corepack pnpm generate` 入口。前端脚本显式传入 Nuxt 的 `--envName production-build`，只把中间目录切换到 `.nuxt-production/`；生产 `NODE_ENV` 语义保持不变，避免构建改写正在运行的开发 Vite 文件。直接执行裸 `nuxt build` 或 `nuxt generate` 不带此项目配置环境，不能保证开发目录隔离。

不按 `NODE_ENV` 单独选择生成目录：当前 Nuxt CLI 的 `prepare` 和 `typecheck` 也可能默认设为 `production`，否则干净安装后会缺少根 ESLint 与 tsconfig 所引用的 `.nuxt/` 文件。

## 配置与判断依据

- 后端工作目录为 `src/backend/server-main`；环境优先级是进程环境、`.env.local`、`.env`。
- 前端工作目录为 `src/frontend/web-blog`；沿用 Nuxt 的进程环境与 `.env`。`NUXT_API_BASE_URL` 指向本机后端 `/api/v1`，公开 API 地址保持 `/api/v1`。
- 后端端口使用 `PORT`（默认 3000），统一启动的前端端口使用 `NUXT_PORT`（默认 3456）。就绪时限通过 `TIXXIN_DEV_TIMEOUT_MS` 设置，默认 90000ms。
- 本机开发归属探针返回项目指纹、服务名、进程号与本次托管会话标识；后端还返回不含密码的数据库指纹。探针不返回路径或凭据，生产环境不开放。
- 端口已被占用时，只有归属匹配的项目服务才会复用。旧版本没有探针时，需要先在原终端更新/重启该服务，启动器不会猜测归属或结束它。
- Nuxt 开始监听端口后仍需编译；该阶段继续等待归属与业务接口就绪，不把监听端口等同于完成启动。运行中短暂热重载也保留恢复时限。

## PostgreSQL 与迁移

数据库端口没有服务监听时，`dev:all` 可按现有 Compose 配置启动 `postgres`。启动前核对数据库名、用户、密码、映射端口与当前 `DATABASE_URL` 一致；外部数据库、认证失败或配置不一致时明确退出。

已有数据库端口在监听但认证失败时，不重启容器。Compose 复用现有卷，PostgreSQL 作为持久依赖保留运行。启动和自检都不执行迁移、seed、清空或重置；待迁移时报告具体迁移名称，由显式命令处理。

## 退出、日志与回归

Ctrl+C 结束当前启动器。Windows 使用独立 Job Object，POSIX 使用独立进程组；仅清理本次创建的服务与后代。复用的原服务继续运行。控制管道关闭或启动中取消也会清理本次进程。

日志和启动状态保存在 `.artifacts/dev/<时间>-<进程号>/`。日志按完整行处理并隐藏已知配置凭据；状态文件是诊断记录，实际存活仍以当前进程与探针为准。

```bash
corepack pnpm test:dev
corepack pnpm test:dev:integration
corepack pnpm test:dev:postgres
```

前者使用真实测试进程验证复用、陌生端口、失败退出、就绪超时、编译等待、取消及孙进程清理。后者复制独立工作区，创建临时数据库和媒体，验证真实 Nuxt/Nest 冷启动、第二个启动器复用、数据库不可用、迁移提示及退出；最后清理临时服务、数据库与媒体。

`test:dev:postgres` 另建唯一命名的 Compose 项目验证 PostgreSQL 冷启动、配置不一致拒绝和已有监听端口保护，结束时只清理该项目的容器与卷。

本机已完成 Windows 生命周期与完整开发链路实测，并通过 Node 24 Linux 容器的生命周期回归。CI 增加 Windows/Ubuntu 生命周期矩阵，以及 Ubuntu 隔离完整启动入口；云端 CI 是否通过以实际运行结果为准。
