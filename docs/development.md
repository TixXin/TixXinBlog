# 本地开发与测试

使用 Node.js **>=25 <26**、固定 **pnpm 9.15.0** 和 PostgreSQL 16。以下命令从仓库根目录执行，推荐通过 `corepack pnpm` 使用锁定版本。

## 安装与配置

```sh
npm install --global corepack@0.34.6
corepack pnpm install --frozen-lockfile
```

首次配置时，参考[前端环境模板](../src/frontend/web-blog/.env.example)建立 `src/frontend/web-blog/.env`，参考[后端环境模板](../src/backend/server-main/.env.example)建立 `src/backend/server-main/.env.local`。保留已有配置文件，不用模板覆盖已有密码、数据库或站点地址。

| 配置                            | 作用                                                    |
| ------------------------------- | ------------------------------------------------------- |
| 后端 `DATABASE_URL`             | PostgreSQL 连接；必须与实际实例及容器端口映射一致       |
| 后端 `JWT_ACCESS_SECRET`        | 至少 32 位随机签名密钥                                  |
| 后端 `CORS_ORIGIN`              | 开发前端 origin，默认前端地址为 `http://localhost:3456` |
| 后端 `PORT`                     | API 端口，默认 3457                                     |
| 前端 `NUXT_API_BASE_URL`        | 服务端使用的后端地址，包含 `/api/v1`                    |
| 前端 `NUXT_PUBLIC_API_BASE_URL` | 浏览器同源入口，保持 `/api/v1`                          |
| 前端 `NUXT_PUBLIC_SITE_URL`     | 对外站点 origin；影响分享、canonical 和订阅地址         |
| 前端 `NUXT_DEVTOOLS_ENABLED`    | 默认关闭 Nuxt DevTools；仅 `true` 启用，修改后重启前端  |
| `NUXT_PORT`                     | 统一启动器使用的前端端口，默认 3456                     |

Nuxt DevTools 默认关闭，避免调试器在每次状态变化时遍历整份页面数据。需要调试时，在前端启动终端临时设置 `NUXT_DEVTOOLS_ENABLED=true` 后启动或重启前端；关闭面板不等于停用调试器。项目自带的 DEV 面板仍可使用。性能采样保持 DevTools 关闭，并分别记录开发与生产构建结果。

后端环境优先级为进程环境、后端 `.env.local`、后端 `.env`；前端沿用 Nuxt 的进程环境与前端 `.env`。运行时密钥不进入源码、客户端配置或构建镜像。

需要本地数据库时，仅启动开发 Compose 的 PostgreSQL 服务：

```sh
docker compose --env-file src/backend/server-main/.env.local -f src/backend/server-main/docker-compose.yml up -d postgres
corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main migration:check
```

先核对连接目标、端口和持久化卷，再应用迁移。`migration:check` 检查实体与数据库结构漂移。数据库变更通过正式迁移实现；不要修改已发布迁移来改变已有数据库。

本机端口分配为前端 `3456`、API `3457`、PostgreSQL `5433`，用于避开其它项目常用的 `3000/3002/8080/8090/5432`。修改 API 端口时同步后端 `PORT` 与前端 `NUXT_API_BASE_URL`，再重启这两个项目进程；`POSTGRES_PORT` 与 `DATABASE_URL` 继续指向已有数据库，不因应用端口调整重建数据卷。

根 `compose.yaml` 的生产式本机预览默认发布 `127.0.0.1:3458`，可用 `WEB_PORT` 覆盖；自定义后同时设置匹配的 `SITE_URL`。容器内部的前后端仍各自使用 `3000`，数据库使用 `5432`，Docker 网络隔离且后端不发布宿主端口，因此这些内部端口不占用其它项目的宿主监听端口。`compose.production.yaml` 的正式 HTTPS 入口仍遵循部署配置。

## 启动、复用与退出

```sh
corepack pnpm dev:check
corepack pnpm dev:all
```

全部根脚本的实际命令与边界见[根脚本说明](scripts.md)。

`dev:check` 只读核对配置、依赖、数据库认证、待迁移项以及服务归属和就绪状态；未运行、冲突或故障返回非零。`dev:all` 先检查数据库，再启动或复用本项目 API 与前端；完整链路要求真实 API 模式。

`dev` / `dev:blog` 只启动前端，`dev:api` 只启动后端。端口上已有服务时，启动器仅复用归属探针匹配的本项目实例，不结束陌生进程。Nuxt 监听端口后仍可能在编译，必须等业务接口与探针就绪；`TIXXIN_DEV_TIMEOUT_MS` 可调整等待时限。

数据库端口未监听时，统一启动器可以启动配置匹配的 PostgreSQL Compose 服务；已有监听但认证失败、外部数据库或配置不一致时退出。启动不隐式迁移、seed、清空或重建数据库。统一启动的 API 默认注入 `RATE_LIMIT_DISABLED=true`：本机浏览器、SSR 与测试工具同为 127.0.0.1，按 IP 限流只会限住自己；需要验证限流时在 `.env.local` 显式写 `RATE_LIMIT_DISABLED=false`。生产环境忽略该开关。

Ctrl+C 只清理本次启动器创建的服务与后代，复用的服务保持运行。PostgreSQL 是持久依赖，保留容器和数据卷。需要停止复用服务时，在它原来的终端正常退出。

### macOS 可见终端

由代理启动长期服务时，先运行 `corepack pnpm dev:check`，已就绪则直接复用。需要启动时使用：

```sh
corepack pnpm dev:terminal --help
corepack pnpm dev:terminal --dry-run
corepack pnpm dev:terminal
corepack pnpm dev:terminal:api
corepack pnpm dev:terminal:web
```

默认入口先启动或复用后端，等待就绪后再启动前端。两端使用独立 Terminal.app 窗口，标题分别为 `TixXinBlog | 后端 API` 和 `TixXinBlog | 前端网站`，日志分开显示。两个窗口默认在系统枚举的首块副屏左侧按一列上下排列；没有副屏时使用主屏。布局保持一列（后端在上、前端在下），留出间距；高度根据可用屏幕空间缩小，避开菜单栏和 Dock。`dev:terminal:api` / `dev:terminal:web` 仅处理对应服务，也可使用 `--service=api|web`。已就绪服务直接复用，不重复开窗。 每次新窗口的启动命令输出同时写入 `.artifacts/dev-terminal/<时间>-<进程>-<服务>.log`，路径在开窗前打印；配置、版本或数据库检查在正式会话创建前失败时也可查阅。日志来自本次命令的标准输出和错误输出，不读取已有终端内容；`--dry-run` 不创建目录或日志文件。

每个窗口运行单服务托管器，各自保存 `.artifacts/dev/<会话>/` 日志和 `session.json`；Ctrl+C 只清理本窗口创建的服务与后代。后端停止或重启后，已就绪过的前端保留进程并报告依赖未就绪，后端恢复后继续工作；前端首次启动仍需同源 API 就绪。前端进程退出或端口归属变化时仍会报错退出。启动某一侧失败不会停止另一侧，数据库保持运行。复用服务的日志仍在原会话中查看。

启动器的归属与业务巡检携带 `x-tixxin-dev-probe: 1`；开发环境只静默这些已成功的只读巡检访问日志，普通业务请求仍记录。健康检查和巡检出现 4xx、5xx 或错误时保留警告、错误日志，运行状态变化也会显示，避免持续成功检查刷屏。

`--dry-run` 只显示启动命令，不打开窗口或启动服务。启动命令只转交当前 Node、pnpm 和 PATH 路径；业务配置由新终端环境及项目已有环境文件读取，调用方临时设置的业务环境变量不转发。需要临时覆盖时，在两个本地终端分别设置变量，运行 `corepack pnpm dev:session:api --logs` 和 `corepack pnpm dev:session:web --logs`。

打开窗口不代表服务已就绪，仍需运行 `corepack pnpm dev:check` 核验。Ctrl+C 清理本次服务后，窗口保留；启动失败时也保留错误输出。下次启动同一服务前，会自动关闭标题相同且已无运行进程的旧窗口，仍在运行的窗口和其他终端不受影响。不要重复打开窗口来处理端口冲突，先核对占用者。macOS 拒绝终端控制权限时，命令会报错，可手动打开两个终端，分别执行 `corepack pnpm dev:session:api --logs` 和 `corepack pnpm dev:session:web --logs`。其他系统也可使用这两个入口，或继续使用 `dev:all` 统一启动。

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
corepack pnpm db
corepack pnpm db:dev status
corepack pnpm db:dev check-data
corepack pnpm db:dev seed-data --dataset all
corepack pnpm db:dev remove-data --dataset gallery-v1
```

| 命令                              | 行为                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `status`                          | 始终只读，查看目标与迁移状态                                                            |
| `list`                            | 只读输出可用动作、数据集与数据域目录，供菜单和脚本取用                                  |
| `volume --scale <规模>`           | 预览或补齐容量档文章与评论；`--clear` 整批清理                                          |
| `check-data`                      | 核对各域记录、关联、媒体和代表性场景；可用 `--domain` 限定领域                          |
| `seed-data --dataset <数据集>`    | 预览增量补齐；数据集及稳定归属由[种子实现](../src/backend/server-main/src/seeders/)维护 |
| `remove-data --dataset <数据集>`  | 预览指定样本的可删除范围与保护原因；`--forget-ownership` 另见下文                       |
| `prepare-profile`                 | 只整理精确匹配、未经编辑的初始资料，保留已修改资料                                      |
| `clear-moments` / `clear-content` | 清空指定业务范围；不是样本定向清理                                                      |
| `reset`                           | 删除应用表并重放迁移，会清空账号、内容、配置历史和媒体索引                              |

`corepack pnpm db` 不带参数时进入交互菜单，按查看、补充样本、清理、重建、账号与配置、备份分组列出上表同一批命令：先显示目标数据库，执行前打印即将运行的完整命令，写入条目先预览再要求输入数据库名确认，`clear-content` 和 `reset` 还需额外输入动作名。菜单不自行写库，数据集与数据域名单取自 `db:dev list`。带参数的 `corepack pnpm db <命令>` 等价于 `corepack pnpm db:dev <命令>`；非交互终端只打印用法和条目清单并返回非零，便于脚本与 CI 使用。

容量档用于撑起分页、搜索与统计的数据量，与代表样本分开：`corepack pnpm db:dev volume --scale small|large` 预览，`--apply --confirm <数据库名>` 写入，`volume --clear` 整批清理。内容由固定词表按序号确定性生成，重复执行只补缺口，标题、正文和评论使用自然中文，不带任何标记。其中三篇文章集中承载评论（small 为 60/30/15 条，large 为 300/150/60 条，含一层回复与待审、隐藏状态），用于查看单篇文章的评论分页；升高规模时这部分同样按缺口补齐。容量记录归属 `volume-v1`，按批次整体删除，不参与代表样本的逐条指纹保护，也不随 `remove-data --dataset all` 进入保护式清理计划；`check-data` 的全表计数会包含容量数据，核对代表样本覆盖时先清理或改用干净数据库。

实际写入需显式追加 `--apply --confirm <数据库名>`。工具只允许核对过的本机非生产目标，要求迁移完成且结构一致，并先通过完整备份流程备份；备份失败不写入。无待处理项时不重复修改数据。

核心样本集 `core-v1` 的公开讨论覆盖可分页的评论量、两级回复、待审与隐藏状态、长评论以及跨文章分布，并保留一个未被任何内容引用的孤立媒体资产，供媒体库和清理计划核对。提高覆盖要求后，已经补种过的开发库需要再次执行 `seed-data --dataset core-v1` 才会补齐新增记录；重复执行不覆盖已修改内容，也不复活已删除记录。

真实感样本集 `showcase-v1` 让开发库看起来像一个持续更新的个人博客：五十篇每篇一千六百字以上的长文（专栏、标签、封面、置顶与两年内的发布日期分布）及针对正文的访客评论与博主回复、按文章热度铺开的点赞记录、十八条带地点与器材的朋友圈及其评论点赞、四张图库作品、两条当天留言，以及博主资料（姓名、头衔、头像、在线状态与签名、上线日期、公告和社交链接）。正文与评论保存在 [`showcase-content/`](../src/backend/server-main/src/seeders/showcase-content/)，图片素材及来源登记在 [`showcase-assets/`](../src/backend/server-main/src/seeders/showcase-assets/README.md)，访客不带头像，前端按名字生成首字母头像。博主资料只在仍等于初始值或 `prepare-profile` 整理结果时写入，已编辑过的配置原样保留并在报告的 `unavailable` 中说明；资料改名时，只有指纹未变的样本里的博主署名会跟着更新。通过 `corepack pnpm db:dev seed-data --dataset showcase-v1` 预览，按本节流程写入；与容量档同时存在时统计会叠加，想得到接近真实的站点数字先执行 `volume --clear`。

开发样本必须覆盖当前功能的常见状态、分页、关联、近期日期和失败恢复。正文使用自然内容，内部稳定标识与用途说明保存在脚本和归属记录中。日常开发样本长期保留；自动回归使用可清理的独立数据库、媒体与账号。

平台订阅代表样本集为 `subscription-v1`（15 条订阅、1 个有来源和许可的受管图标），覆盖七种币种、五种周期、双状态、价格历史与近期日期。金额仅为开发代表值，不代表博主实际消费或商家当前报价；通过 `corepack pnpm db:dev seed-data --dataset subscription-v1` 预览，按本节备份与目标确认流程写入。图标代理的供应商响应由隔离测试控制，样本准备不会请求第三方网络。

重复补种不覆盖用户编辑、重写日期或复活已删除记录。定向清理保护用户修改、外部互动、跨数据集关系和历史媒体引用，未知关联保留；归属账本继续存在，防止以后重新补种已删除内容。

样本定义变更后需要让已补种的库跟上时，常规的清理再补种不会生效：归属账本在清理后仍然保留，补种会把这些记录判定为用户已删除并跳过。此时使用 `remove-data --dataset <数据集> --forget-ownership`，在清理的同时清除那些已经没有对应记录的归属，该数据集随后可以重新补种。代价是此前被真正删除的样本也会一并重新创建，因此这个开关只用于重建，不用于日常清理；仍有记录存在的归属继续保留，用户编辑过的内容不会被覆盖。

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

## 交互光标

全站光标由 `_interaction.scss` 按原生控件和交互角色提供基础规则。禁用控件使用 `not-allowed`；只有实际执行请求的操作按钮设置 `aria-busy`，使用 `progress`，不把忙碌容器的状态扩散到子控件。只读文本仍可选择复制。

组件需要图片放大、拖拽或调整尺寸等专用光标时，使用 `cursor: var(--interaction-cursor, zoom-in)` 等原生值作为后备。共享变量优先表达禁用和忙碌状态，避免组件选择器覆盖全站规则。不要仅凭 `tabindex`、悬停效果或父容器的 `aria-busy` 判断控件可操作性。

## 验证入口

Node 25 默认暴露服务端 Web Storage；前端单测入口关闭该 API，让 Nuxt 测试环境使用模拟浏览器的存储实现，避免原生空对象覆盖浏览器接口。

```sh
corepack pnpm check:secrets
corepack pnpm test:subscription-domain
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
| 订阅业务与内容迁入         | 后端 `test:subscriptions`，共用计算 `corepack pnpm test:subscription-domain`    |
| 数据库工具与样本归属       | 后端 `test:database-dev`、`test:development-data`                               |
| 备份与运行任务             | 后端 `test:backup-integrity`、`test:backup-restore`、`test:operations`          |
| 浏览器                     | `corepack pnpm test:e2e`，或已有两端生产构建后执行 `corepack pnpm test:e2e:run` |

浏览器运行器需要可创建临时数据库的 PostgreSQL 用户，可按 spec 和浏览器选择范围：

```sh
node src/backend/server-main/tests/browser-runner.mjs release-seo.spec.ts --browser=all
node src/backend/server-main/tests/browser-runner.mjs blog.spec.ts --browser=firefox
```

会持久修改公共查询结果的场景，按浏览器分别启动新运行器与新数据库，避免前一浏览器的数据污染后一浏览器。测试仅清理自身拥有的数据库、媒体、进程和容器，不能清空日常开发库。

### 公开页面可访问性回归

[`accessibility.spec.ts`](../src/frontend/web-blog/tests/e2e/accessibility.spec.ts) 使用 `@axe-core/playwright` 扫描整页，覆盖 Nexus、Dock、Aurora 三主题与 light/dark 两种模式。14 个公开页面各自生成独立用例，共 84 项：文章首页与详情、归档、朋友圈、画廊、项目、友链、留言板、图片提示词、平台订阅费、站内搜索结果、闪念空态、关于我和书签。导航、侧栏、页脚也纳入扫描。

```sh
corepack pnpm test:e2e accessibility.spec.ts
# 已有当前源码对应的前后端生产构建时，可省去构建步骤
corepack pnpm test:e2e:run accessibility.spec.ts
```

两条命令都通过现有 runner 建立隔离数据库、媒体和动态端口服务，需要 PostgreSQL 与 Playwright Chromium。用例复用 runner 的真实样本，不登录、不自行写入样本，不得绕过 `playwright.config.ts` 的 `E2E_ISOLATED` 检查直接指向日常开发服务。运行器当前没有闪念样本，因此这里只覆盖闪念真实空态，不代表已覆盖闪念详情。

扫描前确认实际主题、明暗模式、水合、业务内容和请求就绪，以减少动态效果模式保持页面稳定，不把加载态或请求错误当成正常页面。所有 axe 默认规则保持开启；`critical`、`serious` 违规导致失败，其他级别和需人工确认的 `incomplete` 结果仍保存在每个用例的 `axe-results` JSON 附件中，产物位于 `.playwright-mcp/e2e-results/`。允许清单是用例中的 `allowedViolations`。当前为空，因为还没有经维护者接受的豁免。新增条目必须写明规则 id、axe 节点 `target` 和非空理由，并可限定页面、主题与明暗模式；只放行列出的节点。适用于当前用例但没有命中节点的条目会使该用例失败。不得用 `disableRules`、排除整块页面或空 `target` 掩盖问题。

自动扫描只覆盖当前桌面页面状态，不能代替键盘操作、焦点恢复、读屏、窄屏、弹层和正常动效的验收；参见[主题验证](themes.md#验证)与 [Playwright 可访问性测试说明](https://playwright.dev/docs/accessibility-testing)。

[CI](../.github/workflows/ci.yml) 的 `lint-and-build` 按默认 [Playwright 配置](../src/frontend/web-blog/playwright.config.ts) 跑 Chromium 全量。该配置没有 `projects`，`browserName` 默认为 `chromium`，`workers` 为 1，命令行 `--browser=webkit` 会覆盖这次运行的浏览器。WebKit 核心冒烟与全量回归并行，范围是 `blog.spec.ts` 与 `hydration-history.spec.ts` 两个完整文件：前者覆盖分页、发布撤回、评论、三主题移动端和后台闭环，后者覆盖水合与原生历史。每个文件单独调用隔离运行器，避免写入互相影响。`performance-admin.spec.ts` 固定断言 Chromium，留在全量 job。`playwright.motion.config.ts` 的多浏览器项目只用于单独的动效验收，默认 CI 配置仍是 `playwright.config.ts`。准备好当前源码的两端生产构建、PostgreSQL 和 WebKit 后，可复现相同范围：

```sh
corepack pnpm test:e2e:run blog.spec.ts --browser=webkit
corepack pnpm test:e2e:run hydration-history.spec.ts --browser=webkit
```

需要评估文章列表投影时，可在后端构建后运行 `corepack pnpm --filter server-main exec tsx tests/post-list-performance.ts --compare`。它比较完整业务响应、分页和公开过滤，而非只比较耗时。浏览器性能与服务方法耗时分别记录；明确样本、预热、缓存、硬件及并发条件，不把本机采样直接当作线上收益。

公开栏目导航验收使用 `node src/backend/server-main/tests/navigation-performance.mjs --samples=28 --devtools-ab`，运行前完成前后端生产构建。脚本建立独立数据库和媒体目录，使用至少 2,000 篇公开文章及每页 12 张真实受管图片，分别采样三主题生产导航和独立开发进程的 DevTools 开关对照；报告包含点击到页面就绪、长任务、DOM 峰值、请求与传输量，以及本次资源清理结果。默认只对功能与资源边界作断言，毫秒目标需在同硬件、同样本、相同预热条件下核验；不能把有失败响应的快速轮测当成成功性能结果。

Git 保存可重复运行的测试源码。截图、录屏、trace、覆盖率、机器报告、运行日志和临时脚本写入 `.artifacts/` 或 `.playwright-mcp/`，不纳入发布文档。分享报告前清除凭据及私人内容。
