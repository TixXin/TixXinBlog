# 根脚本说明

根目录 `package.json` 中全部 `scripts` 的用途与边界。命令均在仓库根目录执行，使用 Node.js >=25 <26 和 pnpm 9.15.0，统一写法为 `corepack pnpm <命令名> [参数]`；首次安装依赖使用 `corepack pnpm install --frozen-lockfile`。修改根脚本时同步更新本页。环境配置与完整开发流程见[本地开发与测试](development.md)，提交约定见[贡献指南](../CONTRIBUTING.md)。

`--filter web-blog`、`--filter server-main` 形式的命令直接调用子项目脚本，不属于根脚本，例如 `corepack pnpm --filter server-main test`。

## 开发启动与自检

| 命令               | 实际执行                                       |
| ------------------ | ---------------------------------------------- |
| `dev`、`dev:blog`  | `corepack pnpm --filter web-blog dev`          |
| `dev:api`          | `corepack pnpm --filter server-main start:dev` |
| `dev:check`        | `node scripts/dev.mjs check`                   |
| `dev:all`          | `node scripts/dev.mjs all`                     |
| `dev:session:api`  | `node scripts/dev.mjs api`                     |
| `dev:session:web`  | `node scripts/dev.mjs web`                     |
| `dev:terminal`     | `node scripts/dev/terminal.mjs`                |
| `dev:terminal:api` | `node scripts/dev/terminal.mjs --service=api`  |
| `dev:terminal:web` | `node scripts/dev/terminal.mjs --service=web`  |
| `dev:setup`        | `node scripts/dev/setup-sandbox.mjs start`     |
| `dev:setup:reset`  | `node scripts/dev/setup-sandbox.mjs reset`     |
| `dev:setup:down`   | `node scripts/dev/setup-sandbox.mjs down`      |

`dev` 与别名 `dev:blog` 直接启动 Nuxt 前端开发服务并热更新，默认监听 `http://127.0.0.1:3456`；端口不可用时 Nuxt 可能改用其他端口，以终端打印的 Local 地址为准。它不启动后端、不检查数据库，也不复用已运行的前端，启动前可先运行 `dev:check` 避免重复启动。“只启动前端”不代表只能使用 Mock：浏览器仍请求同源 `/api/v1`，由 Nuxt 转发到 `NUXT_API_BASE_URL`，因此已运行的后端中的数据照常显示。

`dev:api` 直接以 watch 模式启动 NestJS 后端，默认端口 3457，使用 `tsconfig.dev.json` 并输出到后端 `.dev-dist/`。需要已有可用数据库和配置；不启动前端，不经过统一启动器的复用和自检，也不注入下文的限流开关。

`dev:check` 只读核对运行版本、配置、依赖、数据库连接、待执行迁移以及前后端归属和就绪状态，不启动服务。服务未运行、端口冲突、连接失败或存在待执行迁移时返回非零状态。

`dev:all` 在当前终端托管完整开发链路：先检查数据库，再启动或复用本项目后端和前端，要求真实 API 模式。追加 `--logs` 在当前终端同步显示脱敏服务日志。符合条件时可启动已有 Compose 配置中的 PostgreSQL，但不自动迁移、补样本或清库。Ctrl+C 只结束本次创建的服务，复用的服务和 PostgreSQL 保持运行；会话和日志保存在 `.artifacts/dev/`。

`dev:session:api` / `dev:session:web` 用统一启动器单独托管后端或前端，可选 `--logs`。两者都会检查数据库并校验服务归属；后端会话额外负责复用和运行巡检。前端会话不启动后端或 PostgreSQL，首次就绪要求同源 API 可用；就绪后后端暂时不可用时报告依赖故障并保留前端进程。

统一启动器（`dev:all`、`dev:session:api` 及下文的 `dev:terminal` 系列）启动的 API 默认注入 `RATE_LIMIT_DISABLED=true` 并固定 `NODE_ENV=development`；需要验证限流时在后端 `.env.local` 显式写 `RATE_LIMIT_DISABLED=false`。

`dev:terminal` 仅用于 macOS，为后端和前端分别打开独立 Terminal.app 窗口并显示日志：先处理后端，就绪后再处理前端，已就绪的本项目服务直接复用。`--help` 查看帮助，`--dry-run` 只显示启动命令而不开窗或写日志。启动前后都运行 `dev:check`；Ctrl+C 只停止对应窗口创建的服务。窗口启动日志在 `.artifacts/dev-terminal/`，服务会话日志在 `.artifacts/dev/`。新终端读取自己的环境和项目配置，不转发调用方临时设置的业务环境变量。`dev:terminal:api`、`dev:terminal:web` 只为单个服务开窗，其余行为相同；单独开前端前需准备好后端和数据库。

`dev:setup` 在当前终端托管初始化沙盒：在日常 PostgreSQL 实例上创建或复用固定空库 `tixxin_blog_setup_sandbox` 并执行正式迁移，不写样本；以随机 `SETUP_TOKEN` 启动沙盒 API（3467）和指向它的热更新前端（3466），就绪后打印初始化链接与首页地址。端口被占用时报错退出，不复用也不结束占用进程；可选 `--web-port=`、`--api-port=` 与 `--logs`。Ctrl+C 只结束本次启动的两个服务，沙盒库保留。`dev:setup:reset` 删除并重建为空库，`dev:setup:down` 删除沙盒库；两者都只作用于该固定库名，沙盒端口仍有服务或沙盒库还有其他连接时拒绝。沙盒变量只通过子进程环境传入，不改写环境文件；限流、Cookie 与目录隔离见[初始化沙盒](development.md#初始化沙盒)。

## 启动器与框架补丁测试

| 命令                   | 实际执行                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `test:dev`             | `node --test scripts/dev/*.test.mjs scripts/db/*.test.mjs` |
| `test:dev:integration` | `node scripts/dev/integration.mjs`                         |
| `test:dev:postgres`    | `node scripts/dev/postgres-integration.mjs`                |
| `test:nuxt-patches`    | `node --test scripts/nuxt/*.test.mjs`                      |

- `test:dev`：开发配置、进程托管、服务复用、终端命令生成、初始化沙盒参数与库名校验及数据库菜单测试。部分用例会创建短时进程并监听本机临时端口，不等同于真实数据库集成测试。
- `test:dev:integration`：用真实 Nuxt、NestJS 和隔离数据库验证冷启动、就绪、复用及退出清理。需要可用 PostgreSQL 和创建临时数据库的权限，会启动临时服务并产生运行产物。
- `test:dev:postgres`：验证 PostgreSQL Compose 启动、容器归属及连接配置不匹配时的拒绝行为。需要 Docker 和 Docker Compose，只使用本次测试的临时容器和数据卷。
- `test:nuxt-patches`：固定版本 Nuxt 路由启动补丁的回归测试，覆盖原生历史、查询参数、hash 及 SSR/SSG 行为。需先安装依赖并应用 pnpm 补丁；不是完整浏览器回归。

## 数据库与开发样本

| 命令     | 实际执行                                        |
| -------- | ----------------------------------------------- |
| `db`     | `node scripts/db.mjs`                           |
| `db:dev` | `corepack pnpm --filter server-main run db:dev` |

`db` 在交互终端打开数据库操作菜单，按查看、样本、清理、重建、账号配置和备份分组；菜单先显示目标与完整命令，写入操作先预览，再要求输入数据库名确认。带参数时直接转交 `db:dev`，例如 `corepack pnpm db status`。无参数且终端不可交互时只打印用法并返回非零状态。

`db:dev` 直接调用后端数据库工具，无参数时执行只读 `status`。常用动作：

- `status` 查看状态，`list` 列出动作和数据集，`check-data` 检查代表数据与关联；
- `seed-data --dataset all` 预览补齐样本，`remove-data --dataset <数据集>` 预览定向清理；
- `volume --scale small|large` 预览容量数据。

变更默认只预览；实际写入需要 `--apply --confirm <数据库名>`，并通过本机非生产目标、迁移、结构与完整备份检查。清理或重建前须停止目标库的使用方。`clear-content` 和 `reset` 会删除业务数据，`reset` 还会清空账号及配置历史，不能当作日常启动命令。其他动作与参数见[开发指南](development.md#管理员与开发样本)。

## 前端构建与运行

| 命令                  | 实际执行                                   |
| --------------------- | ------------------------------------------ |
| `build`、`build:blog` | `corepack pnpm --filter web-blog build`    |
| `generate`            | `corepack pnpm --filter web-blog generate` |
| `preview`             | `corepack pnpm --filter web-blog preview`  |
| `start`               | `corepack pnpm --filter web-blog start`    |

- `build` 与别名 `build:blog`：子项目执行 `nuxt build --envName production-build`，中间文件在 `src/frontend/web-blog/.nuxt-production/`，产物在前端 `.output/`。不构建后端、不启动服务、不部署；后端构建使用 `corepack pnpm --filter server-main build`。
- `generate`：子项目执行 `nuxt generate --envName production-build`，同样使用 `.nuxt-production/`，静态产物在前端 `.output/public/`。后台、认证和持久化 API 不会因此静态化，真实业务仍需后端服务。
- `preview`：用 `nuxt preview` 预览已有的前端生产构建，先执行 `build`；不重新构建，也不启动后端或数据库。
- `start`：子项目先执行 `corepack pnpm build`，成功后运行 `node .output/server/index.mjs`。每次都会重新构建，且只启动前端。

构建目录隔离的原因见[开发指南](development.md#构建与生成目录)。

## 代码规范与提交准备

| 命令            | 实际执行                                               |
| --------------- | ------------------------------------------------------ |
| `lint`          | 前端 ESLint，随后运行 `lint:size`                      |
| `lint:size`     | `node scripts/check-file-size.mjs`                     |
| `lint:fix`      | `corepack pnpm --filter web-blog exec eslint . --fix`  |
| `format`        | `prettier --write "src/**/*.{vue,ts,js,scss,json,md}"` |
| `prepare`       | `husky`                                                |
| `check:secrets` | `node scripts/check-secrets.mjs`                       |
| `check:local`   | `bash scripts/check-local.sh`                          |
| `lint:shell`    | `shellcheck` 检查安装、管理、打包、冒烟与试装脚本      |

- `lint`：检查前端子项目的 ESLint 规则，不修复文件，随后执行 `lint:size`；不包含后端 lint、类型检查或单元测试。
- `lint:size`：检查前后端源码文件体量，新文件不得超过上限，存量超限文件只许变短；拆分后加 `--update` 收紧基线。上限与例外见[代码组织与模块化](code-organization.md#文件体量上限)。
- `lint:fix`：自动修复前端 ESLint 可修复的问题并改写文件，完成后检查 Git 差异。
- `format`：按仓库 Prettier 配置改写 `src/` 下匹配的前后端及共享源码，不覆盖根配置、`docs/`、`scripts/` 或 `.mjs` 文件。
- `prepare`：初始化 Husky Git hooks，通常由依赖安装的生命周期自动执行。提交钩子运行 lint-staged，对暂存的前端脚本执行 ESLint 修复，对 `src/` 下匹配文件执行 Prettier。它与前端 `postinstall` 执行的 `nuxt prepare` 不同。
- `lint:shell`：用 shellcheck 检查 `deploy/install.sh`、`deploy/tixxin` 与 `scripts/release/` 下的打包、安装冒烟和本地试装脚本，以及提交署名检查 `scripts/check-ai-attribution.sh`；需要本机安装 shellcheck，CI 固定使用 v0.11.0。
- `check:local`：推送前按相对 `origin/main` 的改动（含未提交与未跟踪文件）自动挑选并运行与 CI 对应的本地检查；`--e2e` 额外运行改动涉及的浏览器 spec（先构建两端，改了应用代码但没改 spec 时跑全量），`--all` 不按改动挑选。有失败项时返回非零。挑选规则与 CI 共用 `scripts/ci/detect-changes.sh` 的分类思路。
- `check:secrets`：扫描 Git 已跟踪及未被忽略的未跟踪文件，查找已知 Context7/GitHub 凭据格式和私钥头；命中时只报告文件和行号并返回非零状态。规则有限，不保证发现所有敏感信息，超过 5 MiB 的文件会跳过。

## 业务与浏览器测试

| 命令                       | 实际执行                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:e2e`                 | `corepack pnpm --filter server-main build && corepack pnpm --filter web-blog build && node src/backend/server-main/tests/browser-runner.mjs` |
| `test:e2e:run`             | `node src/backend/server-main/tests/browser-runner.mjs`                                                                                      |
| `test:subscription-domain` | `corepack pnpm --filter @tixxin/subscription-domain test`                                                                                    |

`test:e2e` 依次构建后端和前端，再由浏览器运行器启动隔离环境执行 Playwright 回归，例如 `corepack pnpm test:e2e sustainable-admin.spec.ts --browser=all`。需要 PostgreSQL、创建临时数据库的权限和对应的 Playwright 浏览器；测试写入隔离数据、启动临时前后端，运行器只清理本次拥有的资源。

`test:e2e:run` 省略两端构建，参数和隔离要求相同；必须已有与当前源码一致的两端生产构建，不能把旧构建的结果当成最新源码的验证。

`test:subscription-domain` 运行 `src/shared/subscription-domain/` 中共享订阅领域逻辑的测试，不代替后端订阅接口、持久化或浏览器流程测试。

## 部署流程试装

| 命令           | 实际执行                                      |
| -------------- | --------------------------------------------- |
| `trial`        | `bash scripts/release/local-trial.sh install` |
| `trial:update` | `bash scripts/release/local-trial.sh update`  |
| `trial:status` | `bash scripts/release/local-trial.sh status`  |
| `trial:down`   | `bash scripts/release/local-trial.sh down`    |

用当前代码在本机构建四个镜像与部署包，交给同一个 `install.sh` 与 `tixxin` 安装和升级，只把下载源换成仓库 `.artifacts/local-trial/download/`，用于发版前体验安装、升级、备份等部署流程本身；新页面与功能仍用 `dev:all` 开发。试装站点固定在 `~/tixxin-blog-dev`（`TIXXIN_TRIAL_DIR` 可覆盖）、项目 `tixxin-dev`、`https://localhost:9443`，不影响官方试用与开发数据库。`--yes` 使用默认回答，`trial --from-release <版本>` 改装官方版本以体验升级到当前代码；`trial:down` 只清理该项目与 `*-dev.*` 镜像标签。用法与约定见[本地开发与测试](development.md#本地构建试装)。

## 常用组合

| 场景               | 命令                                                              |
| ------------------ | ----------------------------------------------------------------- |
| 日常完整开发       | 先 `corepack pnpm dev:check`，再按需 `corepack pnpm dev:all`      |
| macOS 分窗看日志   | 自检后 `corepack pnpm dev:terminal`，完成后再次自检               |
| 查看数据库状态     | `corepack pnpm db:dev status`                                     |
| 预览前端生产构建   | `corepack pnpm build`，然后 `corepack pnpm preview`               |
| 发版前试装部署流程 | `corepack pnpm trial`，改代码后 `trial:update`，结束 `trial:down` |
| 前端单元测试       | `corepack pnpm --filter web-blog test`                            |
| 后端检查与单元测试 | `corepack pnpm --filter server-main lint`、`typecheck`、`test`    |
