# 发布与版本切换

本入口补充 [本地生产式验收](local-production-validation.md)，面向单机 Docker Compose 发布。现有 `compose.yaml` 与日常开发服务保持独立。新增 `compose.production.yaml` 只引用预先构建的镜像，不执行 seed，不开启备份/通知调度。实际生产启用、DNS、外部证书签发和对外端口开放仍按对应授权执行。

## 准备版本与配置

应用镜像必须来自同一提交，使用同一不可复用的版本标签，建议采用完整 Git SHA。前端 Dockerfile 默认 target 为 runtime；后端提供 runtime、migration、worker 三个 target。worker 独立打包 PostgreSQL 16 客户端、固定 pnpm 9.15.0、生产依赖及维护脚本，API 镜像不会启动任务循环。先通过构建和容器验收，再构建目标版本：

```powershell
$releaseVersion = git rev-parse HEAD
docker build -t "tixxin-blog-web:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$releaseVersion" .
```

如使用镜像仓库，在受控环境另外取得授权并推送/拉取经过验证的镜像；发布脚本不自动推送、构建或拉取。必须提前取得 `POSTGRES_IMAGE` 与 `CADDY_IMAGE`。模板使用 PostgreSQL 16 和 Caddy 2，正式环境建议固定已验收的完整 tag 与镜像 digest。不要覆盖已发布版本标签。脚本记录实际镜像 SHA256，供发布审查。

将 `deploy/production.env.example` 复制到仓库外受控目录，替换占位值。`POSTGRES_PASSWORD` 使用至少 32 位随机十六进制值，签名密钥至少 32 位。不要将含秘密的环境文件、`docker compose config` 完整输出或终端历史放入报告。脚本只输出经过筛选的版本、镜像与阶段结果。

`RELEASE_PROJECT` 决定持久化卷归属，首次安装后保持固定。数据库不发布宿主端口；API 仅在 Compose 内由前端同源网关访问；媒体卷挂载在 API `/app/var/media`。Caddy 接收浏览器 HTTPS 请求，转发至前端，前端再代理 `/api/v1` 至 API。证书、Caddy 配置、数据库、媒体和可选 worker 备份分别持久化。worker 只读挂载同一媒体卷，备份写入独立 `/app/var/backups`；不挂载宿主 Docker socket。日志到 stdout/stderr，Docker 每服务最多保留 5 个 10MB 文件；日志不是内容备份。运行服务使用 `unless-stopped`，独立迁移任务没有重启策略。

`SITE_HOST` 填真实域名，`SITE_URL` 填相应 HTTPS origin。默认绑定 `127.0.0.1`；正式对外开放时按授权设置 `HTTPS_BIND_ADDRESS`，并完成 DNS/80/443 入口配置。Caddy 自动申请证书，因此不能将启动 edge 当作无外部动作的本地测试。本机无真实证书时无需跳过证书检查，应使用现有隔离容器验收或另外配置受信任的隔离证书。版本响应头 `X-TixXin-Release` 由 HTTPS 入口提供。

## 预检与首次安装

以下命令默认只解析配置、核对入口及本地镜像，没有服务/卷变更：

```powershell
node scripts/release/release.mjs --env-file D:/PrivateConfig/blog-production.env --version $releaseVersion --origin https://blog.example.com
```

脚本显式指定环境文件，并清除当前 shell 对模板变量的覆盖；仅 `--version` 覆盖文件版本。预检不验证 DNS、真实证书签发、生产凭据有效性或镜像与数据库版本兼容性。

全新安装使用 `--initialize`，脚本要求该项目无容器且全部目标卷尚不存在。先预检；授权实际启用后加 `--apply`：

```powershell
node scripts/release/release.mjs --env-file D:/PrivateConfig/blog-production.env --version $releaseVersion --origin https://blog.example.com --initialize
node scripts/release/release.mjs --env-file D:/PrivateConfig/blog-production.env --version $releaseVersion --origin https://blog.example.com --initialize --apply
```

首次安装依次启动空数据库、执行正式迁移、启动 API/前端/HTTPS 入口，并检查容器就绪、HTTPS 同源文章接口及版本响应头。没有账号或内容时使用 [初始化管理员](local-production-validation.md#初始化管理员) 的专用命令；不要运行开发 seed。首次安装失败后保留已创建的卷，不能继续使用 `--initialize` 绕过检查；核对结果、备份现有数据后走正常发布流程。

## 已有站点发布

先为目标数据库和受管媒体创建最新一致完整备份，并记录其目标与时间。备份生成/完整性校验/隔离恢复是不同结果，详见 [备份与恢复](backup-and-recovery.md)。Compose 网络使用 worker 内的 `BACKUP_EXECUTION_MODE=native` 和 PostgreSQL 16 客户端，备份通过同一数据库快照导出并复制、校验登记媒体；不能把简单数据库 dump 当作完整备份。宿主无需安装 pg_dump，也无需给 worker Docker socket。

准备具体备份目录后：

```powershell
node scripts/release/release.mjs --env-file D:/PrivateConfig/blog-production.env --version $releaseVersion --origin https://blog.example.com --backup-directory D:/PrivateBackups/blog-complete --apply
```

脚本调用现有 `backup:verify` 底层入口检查完整清单和文件摘要，再获取本机项目发布锁，启动/检查数据库、停止前端和 API 写入、执行独立迁移、启动应用及入口，最后检查 HTTPS 同源 API 与版本标识。期间有明确维护窗口。迁移失败不会继续启动新应用；就绪检查失败不会报告成功。失败时保留卷、镜像及应用容器，交由操作者依据阶段结果处理，不自动回滚数据。

脚本不能证明所给备份与目标站点一致，也不能证明该备份已成功演练恢复；操作者仍须核对目标与报告。发布锁只协调同一宿主、同一工作目录的脚本；不要同时在其他 checkout、主机或手动 Compose 入口发布。异常终止留下锁时，先确认对应进程确已退出再人工解除。结果在本地 `.artifacts/release/<项目>/`，包含镜像摘要、目标版本、完成/失败阶段，不包含环境文件正文。该目录无需提交 Git。

发布会检测本项目 worker 是否已经运行；已运行时在迁移前一并停止，仅在应用及 HTTPS 就绪后，以同版本镜像恢复原来已启用的 worker。默认关闭时不因发布自动启动 worker。若新配置明确关闭 `OPERATIONS_WORKER_ENABLED`，保持停止。迁移或应用验证失败时 worker 也保持停止，报告中的 `workerWasRunning`、`workerRestarted` 说明现场；完成故障处理后需明确核对并恢复所需 profile，不能假定失败流程已经恢复调度。

## 可选运行任务容器

正在运行的一次性 `compose run worker` 与长期服务分开处理：发布预检会拒绝与它并发，等待手动备份或其他单次操作完成；不会把一次性任务误识别成需要自动启用的长期 worker。

`worker` profile 默认关闭，模板中的 worker、自动备份和邮件开关也均为 false。先使用填好当前版本的独立生产环境文件，只读查看：

```powershell
docker compose --env-file D:/PrivateConfig/blog-production.env -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
```

确认备份目录归属 UUID、保留策略及目标后配置对应通道，按 [运行任务说明](operations-and-notifications.md) 显式执行 `enable --kind backup --revision <当前版本> --apply`；可以先用 `schedule --apply` 与 `run-once --kind backup --apply` 单次验收。只有已获长期启用授权、设置 `OPERATIONS_WORKER_ENABLED=true` 后，才使用以下命令持续运行：

```powershell
docker compose --env-file D:/PrivateConfig/blog-production.env -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

邮件设置同时注入 API 和 worker，避免仅执行器开启而事件入口没有入队；未配置、未启用以及数据库暂停均不能发送。真实邮件、异地传输和长期 worker 启用仍需对应授权。直接 `docker run` worker 镜像默认只读 status，不进入循环。

## 应用回退、数据库修复与恢复

应用版本回退只换回前端/API/迁移镜像引用，不执行旧迁移，更不执行 migration down。只有确认当前数据库结构和新写入数据与目标应用版本兼容，才传 `--database-compatible`：

```powershell
node scripts/release/release.mjs --env-file D:/PrivateConfig/blog-production.env --version <已验收的旧版本> --origin https://blog.example.com --action rollback --database-compatible --backup-directory D:/PrivateBackups/blog-before-rollback
```

预检可审阅后加 `--apply` 执行。脚本仍需旧版三类镜像在本机，检查备份、保留持久化卷、跳过迁移并验证就绪。数据库兼容声明是操作者确认，脚本不会将它伪装成自动验证。

迁移已经成功但新应用不可用时，优先修复应用，或发布新的向前修复迁移；不得假设任意迁移可无损逆转。必须恢复历史数据时，遵循完整备份的隔离恢复、报告检查、暂停写入、数据库与媒体一起切换流程；这是数据恢复，不是应用镜像回退。保留切换前数据库、媒体、备份和镜像，禁止用 `down -v` 或强制重建消除失败现场。

## 本批验证边界

```powershell
node --test scripts/release/release.test.mjs
```

单测以假的 Docker/HTTPS 依赖覆盖预览不变更、配置/版本约束、发布顺序、迁移失败停止、入口失败不报成功、应用回退跳过迁移、全新安装与既有卷拒绝。测试只创建自身临时目录并清理。现有生产镜像和真实 PostgreSQL 验收继续使用 `scripts/container-smoke.mjs`；真实 DNS、证书签发、生产发布、生产故障和真实目标恢复没有因这些单测而完成。

联合生产隔离验收入口为 `node scripts/release/production-integration.mjs`。它冻结当前源码到本轮 `.artifacts/production-release/<唯一编号>/build-context`，四类镜像从同一快照构建；仅使用本机端口和 Caddy 内部 CA，不修改系统信任或申请公共证书。测试创建非空文章、图库、项目和媒体，运行镜像内原生备份、独立校验和新的无外网恢复容器，并验证版本标识、迁移任务真实失败、回退不迁移、数据库故障与恢复。版本别名来自同一快照，用于核验发布编排，不能证明任意历史应用版本兼容。

全部测试容器、网络、卷和镜像标签带本次唯一归属，finally 只清本次资源；日常 PostgreSQL 保留。原始构建日志、内部根证书、快照摘要、备份与脱敏结论只保留在 `.artifacts/`。这类隔离恢复不能等同于已经投产、已配置真实异地备份或已启用长期通知。

2026-09-11 的最终联合运行已通过上述路径及真实一次性 worker 互斥校验：原生备份包含 42 张表和 1 个受管媒体文件，恢复后行摘要、新登录、旧授权失效与双暂停均通过；数据库停止时 `/ready` 返回 503，恢复后同源内容接口返回 200。原始本地报告：`.artifacts/production-release/tixxin-production-smoke-1789119281081-51708/verification-report.json`。该项目的容器、卷、网络和专属镜像标签均已清理，日常 PostgreSQL 仍在运行。
