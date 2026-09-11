# 部署与版本切换

项目提供独立本地编排 `compose.yaml`，以及使用固定镜像版本的 `compose.production.yaml`。生产编排由 PostgreSQL、一次性迁移、API、前端、Caddy HTTPS 入口和可选 worker 组成。数据库、媒体、证书、Caddy 配置与备份分别持久化。

发布、应用回退和数据恢复是不同流程。应用回退不执行旧迁移；需要恢复数据时使用[备份与恢复](backup-and-recovery.md)。

## 镜像与环境

使用 Node 24、pnpm 9.15.0 和 Docker。应用镜像必须来自同一提交，并使用同一不可复用标签；推荐完整 Git SHA。不要覆盖已经发布的版本标签。

```powershell
$releaseVersion = git rev-parse HEAD
docker build -t "tixxin-blog-web:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$releaseVersion" .
```

构建上下文是仓库根。API runtime 只启动 HTTP；migration 只执行正式迁移；worker 携带生产依赖、维护脚本和 PostgreSQL 16 客户端，直接运行镜像时默认只读 status。发布脚本不构建、推送或拉取镜像，需要提前在目标主机准备全部已验证镜像。PostgreSQL 16 与 Caddy 2 也应固定经过核验的完整 tag 或 digest。

将[生产模板](../deploy/production.env.example)复制到仓库外受控目录，填写实际值。不要提交秘密文件或包含完整展开环境的 `docker compose config` 输出。

| 配置                                                                                                    | 要求                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `RELEASE_PROJECT`                                                                                       | 独立且稳定的 Compose 项目名；首次安装后不随意改变卷归属 |
| `RELEASE_VERSION`                                                                                       | 已构建、不可复用的应用版本                              |
| `WEB_IMAGE_REPOSITORY`、`API_IMAGE_REPOSITORY`、`MIGRATION_IMAGE_REPOSITORY`、`WORKER_IMAGE_REPOSITORY` | 对应同一版本的镜像仓库                                  |
| `POSTGRES_IMAGE`、`CADDY_IMAGE`                                                                         | 本机已有且明确固定的依赖镜像                            |
| `POSTGRES_PASSWORD`                                                                                     | 至少 32 位随机十六进制值，避免连接 URL 保留字符问题     |
| `JWT_ACCESS_SECRET`                                                                                     | 至少 32 位随机签名密钥                                  |
| `SITE_HOST`、`SITE_URL`                                                                                 | 对外域名与对应 HTTPS origin                             |
| `HTTPS_BIND_ADDRESS`、`HTTP_PORT`、`HTTPS_PORT`                                                         | 默认仅绑定本机；对外开放需明确配置入口、防火墙和 DNS    |

数据库不发布宿主端口，API 由前端同源网关访问。Caddy 转发到前端，前端再转发 `/api/v1` 到 API；版本响应头为 `X-TixXin-Release`。Caddy 在真实域名下会申请证书，正式启用前准备 DNS 和 HTTP/HTTPS 入口。隔离验证使用内部 CA，并真实校验证书，不关闭 TLS 检查或修改系统信任。

`media` 卷挂载到 API `/app/var/media`；worker 只读挂载同一媒体卷，备份写入专用卷，无需 Docker socket。上传资源会转为 WebP；更换存储位置时同时迁移原文件、数据库登记与权限。不要通过 `down -v` 处理服务故障。

## 站点地址与索引

前端生产构建通过项目 `build` 命令选择 `production-build` 配置层，隔离 `.nuxt-production/` 并显式保持 `site.env: production`。配置层名称不能被当成站点的预发布环境。运行时 `NUXT_PUBLIC_SITE_URL` 必须是实际公开 origin，不能依赖构建期缺省域名。

正式站点应检查首页 canonical、robots、RSS/JSON 订阅和 sitemap 使用同一运行时地址。公开首页不能带 noindex 或整站 `Disallow: /`，管理地址继续禁止索引，并从 sitemap 排除。

预发布可设置运行时 `NUXT_SITE_ENV=staging` 或 `NUXT_SITE_INDEXABLE=false`。这些设置优先于构建缺省；不要全局强制 indexable 使预发布内容可索引。使用同一产物分别检查正式与预发布配置。

## 预检与首次安装

以下示例中的配置和备份路径应替换为实际仓库外目录：

```powershell
$releaseEnv = '../tixxin-private/production.env'
$origin = 'https://blog.example.com'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin
```

默认只解析配置、检查入口约定和本地镜像，不创建服务或卷。脚本显式指定环境文件，并清除当前 shell 对模板变量的覆盖，仅 `--version` 覆盖文件版本。预检不证明 DNS、证书签发、生产凭据有效性或数据库兼容性。

首次安装要求项目尚无容器且全部目标卷不存在：

```powershell
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize --apply
```

执行依次启动空数据库、运行正式迁移、启动 API/前端/HTTPS，再验证就绪、同源公开 API 和版本头。不执行开发 seed。首次安装失败时保留已创建卷；不要反复使用 `--initialize` 绕过检查，核对现场并备份后改走已有站点流程。

## 初始化管理员

在受控终端环境设置 `ADMIN_DEFAULT_USERNAME` 与至少 12 位随机 `ADMIN_DEFAULT_PASSWORD`，不要把密码写入命令参数或日志。服务镜像就绪后执行：

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
```

该命令只创建账号，同名账号已存在时拒绝覆盖；完成后移除终端密码环境变量，再访问 `/admin/login`。`seed:dev` 会插入开发内容，不能用于生产初始化。个人资料和首批内容在后台明确维护、审核后发布。

## 已有站点发布

先为实际目标创建最新一致完整备份，并完成清单/文件校验；需要时另外做隔离恢复。备份必须包含数据库和登记媒体，普通 dump 不能代替完整备份。目标、快照时间和媒体范围由操作者核对，脚本不能证明任意输入目录属于即将升级的站点。

```powershell
$backupDirectory = '../tixxin-private/backups/verified-backup'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory --apply
```

实际执行会校验完整备份，获取本机项目发布锁，检查数据库，停止前端/API 写入，运行独立迁移，再启动应用与 HTTPS 并核对版本。发布存在明确维护窗口。发布锁存在时先确认是否仍有发布进程，不通过删除锁强行并发。

若本项目 worker 已经运行，迁移前一并停止；仅在新应用与 HTTPS 就绪且新配置仍允许 worker 时，使用同版本镜像恢复。默认关闭时不因发布自动启动 worker。一旦存在一次性 `compose run worker`，预检拒绝与其并发，先等待该任务结束。

迁移失败不继续启动新应用；入口检查失败不报告成功，worker 保持停止。失败保留卷、镜像和现场，由操作者依据阶段结果恢复所需服务，不自动回滚数据库或删除数据。

## 应用回退与数据恢复

确认目标应用兼容当前数据库结构及新写入数据后，才使用回退模式：

```powershell
node scripts/release/release.mjs --env-file $releaseEnv --version <已验证旧版本> --origin $origin --action rollback --database-compatible --backup-directory $backupDirectory
```

核对预检后追加 `--apply`。回退只切换应用镜像，保持持久化卷，跳过迁移并检查入口；`--database-compatible` 是操作者的明确判断，不是自动兼容验证。

迁移已成功而应用失败时，优先修复应用或新增向前迁移。需要回到备份时刻的数据状态时，停止 API 和 worker 写入，在独立目标恢复并校验，随后同时切换数据库和媒体；保留切换前数据，详见[恢复流程](backup-and-recovery.md#切换恢复目标)。应用回退与数据恢复不能互相替代。

## 可选 worker 与运行观察

SMTP、自动备份和持续 worker 默认关闭。先按[运行维护](operations.md)配置通道和数据库控制状态，再明确启用：

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

持续执行还要求 `OPERATIONS_WORKER_ENABLED=true`。邮件和备份各有环境开关及数据库暂停状态，缺一不可；恢复旧队列不会因启动 worker 自动重投。

服务日志写 stdout/stderr，Compose 按服务轮转；日志不是备份。通过 `/ready`、实际公开 API、媒体读取、管理登录、任务状态和存储完整性检查观察系统。版本升级后验证公开内容、后台写入、索引和备份，不能只用容器 running 状态判断可用。

## 本地编排与隔离验证

需要不接触已有部署的本地编排时，按 `compose.yaml` 配置独立环境文件，执行 `docker compose --env-file <本地配置> up --build -d`。该编排使用独立卷；本机 HTTP 入口不能替代真实 HTTPS 登录和发布验证。

```sh
node --test scripts/release/release.test.mjs scripts/release/production-artifact-cleanup.test.mjs
node scripts/release/production-integration.mjs
```

生产式集成要求干净 Git 检出，只从跟踪文件冻结同一快照构建四类镜像。它使用随机 Docker 项目、随机凭据、本机端口和内部 CA，验证首次 HTTPS、索引、非空内容、原生备份/恢复、非空历史队列暂停、版本协调、迁移失败、回退和故障反馈。

所有测试资源按本次归属清理；原始证据留在忽略目录。镜像别名来自同一快照时，仅能验证版本切换编排，不能证明任意旧版应用兼容新数据库。真实 DNS、外部证书、SMTP 认证、异地接收服务和实际数据切换需要在目标环境分别核验。
