# 本地开发与测试

使用 Node.js **>=24 <25**、固定 **pnpm 9.15.0** 和 PostgreSQL 16。以下命令从仓库根目录执行，推荐通过 `corepack pnpm` 使用锁定版本。

## 安装与配置

```sh
corepack pnpm install --frozen-lockfile
```

首次配置时，参考[前端环境模板](../src/frontend/web-blog/.env.example)建立 `src/frontend/web-blog/.env`，参考[后端环境模板](../src/backend/server-main/.env.example)建立 `src/backend/server-main/.env.local`。保留已有配置文件，不用模板覆盖已有密码、数据库或站点地址。

| 配置                            | 作用                                                    |
| ------------------------------- | ------------------------------------------------------- |
| 后端 `DATABASE_URL`             | PostgreSQL 连接；必须与实际实例及容器端口映射一致       |
| 后端 `JWT_ACCESS_SECRET`        | 至少 32 位随机签名密钥                                  |
| 后端 `CORS_ORIGIN`              | 开发前端 origin，默认前端地址为 `http://localhost:3456` |
| 后端 `PORT`                     | API 端口，默认 3000                                     |
| 前端 `NUXT_API_BASE_URL`        | 服务端使用的后端地址，包含 `/api/v1`                    |
| 前端 `NUXT_PUBLIC_API_BASE_URL` | 浏览器同源入口，保持 `/api/v1`                          |
| 前端 `NUXT_PUBLIC_SITE_URL`     | 对外站点 origin；影响分享、canonical 和订阅地址         |
| `NUXT_PORT`                     | 统一启动器使用的前端端口，默认 3456                     |

后端环境优先级为进程环境、后端 `.env.local`、后端 `.env`；前端沿用 Nuxt 的进程环境与前端 `.env`。运行时密钥不进入源码、客户端配置或构建镜像。

需要本地数据库时，仅启动开发 Compose 的 PostgreSQL 服务：

```sh
docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml up -d postgres
corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main migration:check
```

先核对连接目标、端口和持久化卷，再应用迁移。`migration:check` 检查实体与数据库结构漂移。数据库变更通过正式迁移实现；不要修改已发布迁移来改变已有数据库。

## 启动、复用与退出

```sh
corepack pnpm dev:check
corepack pnpm dev:all
```

`dev:check` 只读核对配置、依赖、数据库认证、待迁移项以及服务归属和就绪状态；未运行、冲突或故障返回非零。`dev:all` 先检查数据库，再启动或复用本项目 API 与前端；完整链路要求真实 API 模式。

`dev` / `dev:blog` 只启动前端，`dev:api` 只启动后端。端口上已有服务时，启动器仅复用归属探针匹配的本项目实例，不结束陌生进程。Nuxt 监听端口后仍可能在编译，必须等业务接口与探针就绪；`TIXXIN_DEV_TIMEOUT_MS` 可调整等待时限。

数据库端口未监听时，统一启动器可以启动配置匹配的 PostgreSQL Compose 服务；已有监听但认证失败、外部数据库或配置不一致时退出。启动不隐式迁移、seed、清空或重建数据库。

Ctrl+C 只清理本次启动器创建的服务与后代，复用的服务保持运行。PostgreSQL 是持久依赖，保留容器和数据卷。需要停止复用服务时，在它原来的终端正常退出。

多个栏目同时出现 502 或加载失败时，先检查后端 `/ready`，再检查前端同源 `/api/v1/posts`。区分服务未就绪、配置错误与正常空结果；不得切换 Mock 掩盖真实 API 故障。

## 管理员与开发样本

在受控终端环境提供 `ADMIN_DEFAULT_USERNAME` 和至少 12 位随机 `ADMIN_DEFAULT_PASSWORD` 后：

```sh
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js
```

该命令只创建管理员，同名账号存在时拒绝覆盖。执行后移除终端中的密码环境变量。开发用 `seed:dev` 会插入内容，不用于生产初始化。

开发样本通过稳定归属账本增量管理，先检查再预览：

```sh
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev seed-data --dataset all
corepack pnpm db:dev remove-data --dataset gallery-v1
```

| 命令                              | 行为                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `status`                          | 始终只读，查看目标与迁移状态                                                            |
| `check-data`                      | 核对各域记录、关联、媒体和代表性场景；可用 `--domain` 限定领域                          |
| `seed-data --dataset <数据集>`    | 预览增量补齐；数据集及稳定归属由[种子实现](../src/backend/server-main/src/seeders/)维护 |
| `remove-data --dataset <数据集>`  | 预览指定样本的可删除范围与保护原因                                                      |
| `prepare-profile`                 | 只整理精确匹配、未经编辑的初始资料，保留已修改资料                                      |
| `clear-moments` / `clear-content` | 清空指定业务范围；不是样本定向清理                                                      |
| `reset`                           | 删除应用表并重放迁移，会清空账号、内容、配置历史和媒体索引                              |

实际写入需显式追加 `--apply --confirm <数据库名>`。工具只允许核对过的本机非生产目标，要求迁移完成且结构一致，并先通过完整备份流程备份；备份失败不写入。无待处理项时不重复修改数据。

开发样本必须覆盖当前功能的常见状态、分页、关联、近期日期和失败恢复。正文使用自然内容，内部稳定标识与用途说明保存在脚本和归属记录中。日常开发样本长期保留；自动回归使用可清理的独立数据库、媒体与账号。

重复补种不覆盖用户编辑、重写日期或复活已删除记录。定向清理保护用户修改、外部互动、跨数据集关系和历史媒体引用，未知关联保留；归属账本继续存在，防止以后重新补种已删除内容。

`remove-data`、清空和重建还要求其他数据库客户端断开。工具不主动结束服务；取得应用表锁并重新检查计划，范围变化则退出。`reset` 不使用 `CASCADE`，应用外依赖会令事务失败回滚。工具不删除磁盘媒体、环境文件或已有备份。重建后重新初始化账号不等于恢复原数据；恢复使用[完整备份](backup-and-recovery.md)。

## 构建与生成目录

```sh
corepack pnpm build
corepack pnpm --filter server-main build
corepack pnpm preview
```

安装时的 `nuxt prepare` 和类型检查使用标准 `.nuxt/`，与 ESLint、tsconfig 引用保持一致。必要时可运行 `corepack pnpm --filter web-blog exec nuxt prepare`。

项目 `build` / `generate` 命令显式选择 `--envName production-build`，使用 `.nuxt-production/` 隔离生产中间文件，并在该配置层设置 `site.env: production`。不要省略项目构建入口，也不要仅凭 `NODE_ENV` 选择生成目录：prepare/typecheck 也可能使用 production。生产 `.output/` 与开发 `.nuxt/` 分开，后端 watch 使用 `.dev-dist/`，生产构建使用 `dist/`；不要重建正在被另一个验证进程读取的目录。

开发环境默认不可索引；正式与预发布环境的运行时索引设置见[部署指南](deployment.md)。

## 验证入口

```sh
corepack pnpm check:secrets
corepack pnpm lint
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm --filter server-main test:integration
```

按改动选择相关检查；数据库、迁移和写入恢复不能仅靠前端单测验证。

| 范围                       | 命令                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| 启动生命周期               | `corepack pnpm test:dev`                                                        |
| Nuxt/Nest 隔离冷启动与复用 | `corepack pnpm test:dev:integration`                                            |
| PostgreSQL 启动归属        | `corepack pnpm test:dev:postgres`                                               |
| 固定版本 Nuxt 补丁         | `corepack pnpm test:nuxt-patches`                                               |
| 数据库工具与样本归属       | 后端 `test:database-dev`、`test:development-data`                               |
| 备份与运行任务             | 后端 `test:backup-integrity`、`test:backup-restore`、`test:operations`          |
| 浏览器                     | `corepack pnpm test:e2e`，或已有两端生产构建后执行 `corepack pnpm test:e2e:run` |

浏览器运行器需要可创建临时数据库的 PostgreSQL 用户，可按 spec 和浏览器选择范围：

```sh
node src/backend/server-main/tests/browser-runner.mjs release-seo.spec.ts --browser=all
node src/backend/server-main/tests/browser-runner.mjs blog.spec.ts --browser=firefox
```

会持久修改公共查询结果的场景，按浏览器分别启动新运行器与新数据库，避免前一浏览器的数据污染后一浏览器。测试仅清理自身拥有的数据库、媒体、进程和容器，不能清空日常开发库。

需要评估文章列表投影时，可在后端构建后运行 `corepack pnpm --filter server-main exec tsx tests/post-list-performance.ts --compare`。它比较完整业务响应、分页和公开过滤，而非只比较耗时。浏览器性能与服务方法耗时分别记录；明确样本、预热、缓存、硬件及并发条件，不把本机采样直接当作线上收益。

Git 保存可重复运行的测试源码。截图、录屏、trace、覆盖率、机器报告、运行日志和临时脚本写入 `.artifacts/` 或 `.playwright-mcp/`，不纳入发布文档。分享报告前清除凭据及私人内容。
