# server-main

TixXinBlog 的 NestJS 11 + MikroORM 6 + PostgreSQL 16 后端。文章、评论、闪念、朋友圈、留言、图库、项目、友链、媒体、站点/关于资料、运营聚合和通知均有真实接口。公开网站与后台由 `web-blog` 同源访问 `/api/v1`；这里没有另外一套访客注册或多租户系统。

当前边界见[能力清单](../../../docs/capability-map.md)，统一入口见[文档导航](../../../docs/README.md)。`docs/backend/` 中的早期设计背景与当前域接口说明分开阅读，不再把“从零设计阶段”的历史文字当作服务现状。

## 开发准备

使用 Node >=24 <25 与固定 pnpm 9.15.0。下列命令从仓库根目录执行。

1. 安装依赖：`corepack pnpm install`。
2. 仅在新环境、目标文件不存在时参考本目录 `.env.example` 建立 `.env.local`；保留已有配置。显式配置 `DATABASE_URL`、至少 32 位随机 `JWT_ACCESS_SECRET`、`NODE_ENV=development` 和 `CORS_ORIGIN=http://localhost:3456`，API 缺省端口为 3000。
3. 核对数据库实例、端口与已有数据卷。当前必需依赖是 PostgreSQL；开发 Compose 中其他历史服务不是本轮启动依赖，不要无差别启动整个依赖栈。
4. 应用正式迁移并检查结构，再选择账号初始化或开发数据工具。开发启动不会代替这些步骤。

```powershell
# 仅在需要启动本目录的本机 PostgreSQL 时执行，复用已有 pgdata 卷
docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml up -d postgres

corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main migration:check

# 检查完整链路，再启动或复用本项目前后端
corepack pnpm dev:check
corepack pnpm dev:all
```

已有 PostgreSQL 的实际端口以 `db:dev status`、配置及容器映射为准，不假设每台机器都是 5432 或文档记录过的 15433。若要改变端口，先核对服务归属与连接配置，保留原卷；不要使用 `down -v` 或清库来排除启动问题。见[开发运行](../../../docs/development-runtime.md)和[开发数据库](../../../docs/development-database.md)。

## 账号与开发样本

单独初始化管理员时，在受控环境中提供 `ADMIN_DEFAULT_USERNAME`、至少 12 位随机 `ADMIN_DEFAULT_PASSWORD`，构建后执行：

```powershell
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js
```

该命令不插入内容，同名账号存在时拒绝覆盖。不要把密码写进命令参数、报告或提交。生产镜像内初始化见[部署说明](../../../docs/local-production-validation.md)。

开发数据按稳定归属账本增量管理，不能将旧版 Seeder 的固定文章数量当作当前目录。先检查和预览：

```powershell
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev seed-data --dataset all
```

写入需要核对本机非生产目标、备份与明确数据库确认，具体参数和样本数量见[开发数据目录](../../../docs/development-data-catalog.md)。工具保留用户编辑、账号、配置以及已删除样本的归属，不因重复补种复活用户删除的内容。`seed:dev` 是显式开发入口，不用于生产账号初始化，也不在服务启动时自动执行。

## 接口与代码入口

| 能力       | 入口与职责                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------ |
| 健康       | `/health` 检查存活，`/ready` 实际查询 PostgreSQL，失败返回 503                                   |
| 文章/目录  | `modules/post`；公开分页、正文检索、元数据、详情/地址、修订、发布与回收                          |
| 其他内容   | `modules/flash`、`moment`、`guestbook`、`gallery`、`project`、`link`；公开与管理状态分别校验     |
| 站点/关于  | `modules/site`；`GET /api/v1/site` 只返回允许公开的资料，管理与历史保留完整显隐内容              |
| 工作台     | `GET /api/v1/admin/overview`；六域草稿、五类互动待办、最近编辑的服务端汇总，分区失败不返回假零值 |
| 素材与关联 | `modules/media`、`content-relations`；说明/替代文本与历史引用，三域有向有序关联及公开过滤        |
| 通知/运行  | `modules/operations`；通知已读、实时业务状态、指定 ID 详情、脱敏运行状态与显式任务重试           |
| 认证/审计  | `modules/auth`、`audit`；管理会话、撤销、写入意图和固定字段摘要，秘密不入日志                    |
| 维护       | `modules/backup`；内容包校验/预览/事务迁入、媒体完整性与运行诊断                                 |

后台对应入口是 `/admin`、`/admin/site`、`/admin/media`、`/admin/notifications`、`/admin/operations` 和 `/admin/maintenance`。详细域契约从[文档导航](../../../docs/README.md)进入；服务代码是响应状态、参数和权限的核对来源。

访问令牌保留于前端内存，刷新使用 HttpOnly Cookie；真实访客标识不等同于账号。管理写入复用版本、提交去重、审计和 `X-Content-Context` 保护。文章待回复只计算可见游客根评论且无公开博主直接回复，留言同样按真实直接回复关系判断；通知已读不改变这些数量。

## 内容包、备份与任务

当前内容包导出 **v9**，兼容 **v1–v8**。关于资料、媒体说明与文章/项目/图库关联纳入各自版本契约，关联按整批新编号映射；缺失/失效关系的省略在预览中说明。跳过/复制、目标变化检测、回滚和同票据幂等保留。导入不会发送互动邮件，运行队列和投递凭据不进入公开内容包。

完整备份保存所有 public 表与登记媒体的一致快照，既有回收/历史/会话/任务状态也被保存；外链图片不由服务端下载。恢复到独立无网络目标，先验证原表摘要，再撤销旧授权、轮换内容与运行代次、双暂停邮件/备份，并记录真实恢复校验。见[完整维护契约](../../../docs/backup-and-recovery.md)。

```powershell
# 后端已构建时可直接调用；默认 docker 模式只处理核对过的本机 PostgreSQL 容器
node src/backend/server-main/scripts/full-backup.mjs create
node src/backend/server-main/scripts/operations.mjs status

# 默认仅预览；执行/启用参数见运行说明
node src/backend/server-main/scripts/operations.mjs schedule
node src/backend/server-main/scripts/operations.mjs run-once --kind backup
node src/backend/server-main/scripts/operations.mjs run-once --kind mail
```

SMTP、自动备份和持续循环默认关闭；环境开关与持久暂停状态缺一不可。SMTP 明确接受后的落库异常或接收结果不确定不能自动重投。配置、有限重试、人工核对、HTTP 备份接收器和 owner 保留策略见[运行任务与通知](../../../docs/operations-and-notifications.md)。真实收件人、异机上传与长期启用须单独授权；本机可运行不等于已投产。

## 镜像与发布

构建上下文是仓库根。Dockerfile 提供三个明确目标：

```powershell
docker build -f src/backend/server-main/Dockerfile --target runtime -t tixxin-blog-api:review .
docker build -f src/backend/server-main/Dockerfile --target migration -t tixxin-blog-migration:review .
docker build -f src/backend/server-main/Dockerfile --target worker -t tixxin-blog-worker:review .
```

runtime 只启动 HTTP；migration 显式执行正式迁移；worker 携带维护脚本与原生 PostgreSQL 16 客户端，缺省仅查询状态。生产编排使用固定应用版本和单独 worker profile，媒体只读挂载给 worker。运行时秘密通过受控环境文件注入，不写入镜像或仓库。

发布前核对完整备份与版本兼容，先迁移再启动新应用；应用回退不会自动逆迁移。发布脚本、HTTPS 和失败处理见[发布操作](../../../docs/release-operations.md)。不要用单个 `docker run` 示例代替数据库、媒体、网关与任务的完整编排。

## 验证命令与隔离边界

```powershell
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm --filter server-main test:integration
corepack pnpm --filter server-main test:backup-restore

# 下列专项使用现有编译输出；不要在另一个验收读取 dist 时重建
node src/backend/server-main/tests/operations-integration.mjs
node src/backend/server-main/tests/content-relations-backup-integration.mjs
corepack pnpm --filter server-main exec tsx tests/post-list-performance.ts --compare
```

隔离工厂创建随机数据库、媒体与测试账号，只清理自己的资源；通知投递测试使用本机捕获服务，恢复容器没有外部网络。日常 watch 使用 `.dev-dist`，生产/验收构建使用 `dist`。原始产物只保存 `.artifacts/` 或 `.playwright-mcp/`，不复制到受 Git 跟踪的文档目录。

公开文章列表已使用所需字段投影，保留正文搜索与最终业务响应；效果和环境限制见[性能说明](../../../docs/performance-maintenance.md)。后续业务待办见本目录 [todo.md](todo.md)，过去的实施报告从[历史导航](../../../docs/README.md#历史交付与设计背景)阅读。
