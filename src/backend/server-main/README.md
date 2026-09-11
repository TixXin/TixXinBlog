# server-main

TixXinBlog 的 NestJS 11 / MikroORM 6 / PostgreSQL 16 API。负责内容持久化、认证与审计、媒体引用、站点资料、通知及备份任务。公开网站和后台经 `/api/v1` 访问；这里不提供访客注册或多租户系统。

首次配置、PostgreSQL 和管理员初始化步骤见[根 README](../../../README.md)，请求契约见 [API 文档](../../../docs/api.md)。

## 目录与运行职责

| 目录                             | 用途                                   |
| -------------------------------- | -------------------------------------- |
| `src/modules`                    | 内容、认证、互动、媒体、站点与运行模块 |
| `src/entities`、`src/migrations` | 持久模型和正式迁移                     |
| `src/common`                     | 守卫、响应、校验及跨域基础工具         |
| `src/seeders`                    | 显式开发数据工具，保留归属与编辑保护   |
| `scripts`、`tests`               | 维护命令及隔离回归                     |

HTTP 服务启动不执行迁移、seed、重置或 worker 循环。`/health` 检查存活，`/ready` 查询数据库并在未就绪时返回失败。业务和维护边界见[架构](../../../docs/architecture.md)、[内容管理](../../../docs/content.md)。

## 配置与专业命令

本地配置参考 [.env.example](.env.example)，使用 `.env.local`；已有环境文件不覆盖。基本启动需要有效 `DATABASE_URL` 和至少 32 字符的 `JWT_ACCESS_SECRET`。管理员初始化另外需要用户名及至少 12 字符的密码，同名账号不会被覆盖。

以下命令从仓库根目录执行：

```sh
corepack pnpm dev:api
corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main migration:check
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js
corepack pnpm --filter server-main lint
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test
corepack pnpm --filter server-main test:integration
```

`dev:api` 只启动 API。开发 watch 使用 `.dev-dist`，正式构建输出 `dist`；使用该输出的测试或维护进程运行时，不要同时重建它。开发数据和数据库工具见[开发指南](../../../docs/development.md)。

## 内容迁入、备份与任务

内容包导出 v9，兼容 v1–v8；迁入通过预览与票据创建草稿或跳过相同内容，并映射媒体及内容关系。完整备份另行保存数据库历史与受管媒体；恢复时验证实际库存、撤销旧授权并暂停恢复出来的外部任务。操作说明见[备份与恢复](../../../docs/backup-and-recovery.md)。

```sh
corepack pnpm --filter server-main backup:full
corepack pnpm --filter server-main operations status
```

官方手动备份在完整校验后登记运行记录。邮件、定时备份和持续循环默认不启动，配置和执行入口见[运行维护](../../../docs/operations.md)。

后端 Dockerfile 的构建上下文为仓库根，提供 `runtime`、`migration`、`worker` 三个目标；worker 包含维护脚本与 PostgreSQL 16 客户端。镜像版本、持久化和发布顺序见[部署指南](../../../docs/deployment.md)。对应专项测试及提交要求见[贡献指南](../../../CONTRIBUTING.md)。
