# 部署与版本切换

项目提供独立本地编排 `compose.yaml`，以及使用固定镜像版本的 `compose.production.yaml`。生产编排由 PostgreSQL、一次性迁移、API、前端、Caddy HTTPS 入口和可选 worker 组成。数据库、媒体、证书、Caddy 配置与备份分别持久化。

发布、应用回退和数据恢复是不同流程。应用回退不执行旧迁移；需要恢复数据时使用[备份与恢复](backup-and-recovery.md)。

## 两种部署方式

| 方式                      | 适合                                                                              | 入口                                          |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| 一键安装（v0.3.0 起）     | 第一次部署、只想尽快上线的新手：一条命令安装，浏览器向导创建博主账号              | [5 分钟部署](quick-start.md)                  |
| 手动发布（`release.mjs`） | 需要精细控制的用户：逐项编写环境文件、自行构建镜像、指定备份目录、使用 PowerShell | 下文[高级：手动发布](#高级手动发布releasemjs) |

两者共用同一套镜像（web、api、migration、worker）、同一份 `compose.production.yaml` 编排和同一组数据卷，发布顺序也一致：停止写入、执行正式迁移、启动服务，再通过 HTTPS 同源 API 与版本头验收；已有站点升级前都要求一份已校验的完整备份。区别只在操作入口：

- 一键安装由 `install.sh` 下载并校验 Release 部署包，环境文件写在 `<安装目录>/.env`（默认 `/opt/tixxin-blog`），日常由 `tixxin` 命令完成状态、日志、完整备份、升级、应用回退、重启和重置密码，宿主机只需要 bash、curl 和 Docker。
- 手动发布从仓库检出读取编排与发布脚本，宿主机还需要 Node 26 和 Git，每一步由操作者显式执行并核对。

下文的环境变量、可信代理、内部网络、站点地址、访问统计、初始化管理员和运行观察说明同样适用于一键安装的站点：环境文件即 `<安装目录>/.env`，在安装目录中执行 `sudo docker compose …` 即可使用同一编排（`.env` 已写入 `COMPOSE_FILE`）。

### 服务器已有面板或反向代理（如 1Panel）

两种方式都由自带的 Caddy 占用 80/443。1Panel、宝塔等面板的 OpenResty/Nginx 已经占用这两个端口时，一键安装会在端口检查处退出；项目目前不提供面板应用包。自行让面板反向代理本站，或将来制作面板应用包时，需要满足以下约束（据 1Panel v2.3.2 源码与本机模拟验证）：

- **来源地址与可信代理**：1Panel 的 OpenResty 以 host 网络运行，经 `127.0.0.1:<端口>` 进入前端容器，容器看到的来源是 Compose 项目网络的网关。前端与 API 的可信代理应设为项目子网（`TIXXIN_NETWORK_SUBNET`）。前端不要同时加入 `1panel-network` 等共享网络：多网络时端口映射走名称排序靠前的网络网关，可信代理会对不上。
- **只绑定本机端口**：前端端口映射写成 `127.0.0.1:<端口>:3000`。对外开放时，Docker 的 userland-proxy 让外网直连也表现为网关地址，访客可以伪造 `X-Forwarded-For` 绕过按 IP 的限流。
- **必须 HTTPS 并转发协议头**：API 在生产环境始终签发 Secure Cookie；前端同源写入检查读取 `X-Forwarded-Proto`，代理不转发该头或只用 HTTP 时，提交会返回 403「不允许跨站写入」。
- **面板只执行 `docker compose up`**：应用包无法单独执行迁移，只能把迁移放进启动链路，这偏离了本项目“启动不隐式迁移”的原则，升级前必须备份。1Panel v2 会把安装表单的重启策略（默认 `always`）写到随机一个服务上，一次性迁移服务不能依赖 `service_completed_successfully`，否则约四分之一的安装会一直等待。
- **密钥不能用面板随机值**：1Panel 表单的 `random` 默认值只有约 33 位熵且不是十六进制，不满足 `POSTGRES_PASSWORD` 与 `JWT_ACCESS_SECRET` 的要求，需要由安装脚本用 `openssl rand -hex` 生成并以 600 权限保存。
- **参数文件会被改写**：1Panel v1 升级时按面板记录的表单参数重写 `.env`，额外写入的键（如子网）会丢失；v2 会保留。

以上结论尚未在真实 Linux 上的 1Panel 中完整验证安装、升级与卸载。

## 高级：手动发布（release.mjs）

本节面向需要精细控制的用户。首次部署建议先看[5 分钟部署](quick-start.md)。

命令示例以 Linux 服务器的 bash 为主，随后给出等价的 Windows PowerShell 写法。两种写法的变量一一对应：`release_version`/`$releaseVersion` 为应用版本，`release_env`/`$releaseEnv` 为生产环境文件，`origin`/`$origin` 为站点 HTTPS origin，`backup_directory`/`$backupDirectory` 为已校验的完整备份目录。

### 手动首次部署步骤

手动发布不需要构建源码，但发布脚本、`compose.production.yaml` 和 `deploy/Caddyfile` 都从仓库检出读取，所以要检出与镜像同版本的标签。浅克隆只下载这一个版本（以 v0.2.0 为例），后续命令都在这个目录中执行：

```sh
git clone --depth 1 --branch v0.2.0 https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog
```

| 文件                            | 作用                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `compose.production.yaml`       | 生产编排：PostgreSQL、迁移、API、前端、Caddy、worker |
| `deploy/Caddyfile`              | HTTPS 入口，自动申请证书并转发到前端                 |
| `deploy/production.env.example` | 生产环境变量模板                                     |
| `scripts/release/release.mjs`   | 预检、首次安装、升级与回退脚本                       |

随后依次：

1. 按[使用预构建镜像](#使用预构建镜像)拉取四个应用镜像和 PostgreSQL、Caddy 依赖镜像。
2. 按[环境文件](#环境文件)在仓库外建立环境文件，填写版本、镜像仓库、两个随机密钥、域名与对外绑定地址；需要浏览器初始化时一并填写 `SETUP_TOKEN`。
3. 按[预检与首次安装](#预检与首次安装)先预检，再以 `--initialize --apply` 执行首次安装。
4. 按[初始化管理员](#初始化管理员)创建博主账号。
5. 完成下面的上线检查。

上线检查：

- **HTTPS 正常**：下面的命令不加 `-k` 也能成功，响应头里有与 `RELEASE_VERSION` 一致的 `x-tixxin-release`；浏览器访问首页和 `/admin/login` 没有证书警告。

  ```sh
  curl -I --max-time 15 "$origin/"
  curl -i --max-time 15 "$origin/api/v1/posts?pageSize=1"
  ```

- **`/ready` 健康检查**：API 不发布宿主端口，它的容器健康检查请求的就是 `/ready`。`backend` 显示 `healthy` 即表示探针通过，也可以在容器内直接请求，输出 `200`。公开域名下的 `/ready` 不等同于后端探针。

  ```sh
  docker compose --env-file "$release_env" -f compose.production.yaml ps -a
  docker compose --env-file "$release_env" -f compose.production.yaml exec backend node -e "fetch('http://127.0.0.1:3000/ready').then((r) => console.log(r.status))"
  ```

- **访客限流按真实 IP 计数**：两个 `*_TRUSTED_PROXY_CIDRS` 保持留空即可，见[可信代理](#可信代理读取配额与媒体缓存)。
- **了解 HSTS**：见[可选 worker 与运行观察](#可选-worker-与运行观察)。
- **备份**：写下第一篇内容后，在 `/admin/maintenance` 下载附带受管图片的内容包作为最低限度的备份；升级前需要一份已校验的完整备份，见[备份与恢复](backup-and-recovery.md)。同时保存好环境文件。

### 镜像与环境

应用由四个镜像组成，必须来自同一提交并使用同一不可复用标签，不要覆盖已经发布的版本标签：

| 镜像      | 构建方式                                                   | 作用                                                                     |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| web       | 根 `Dockerfile`（`runtime`）                               | Nuxt 前端与同源 API 网关                                                 |
| api       | `src/backend/server-main/Dockerfile` 的 `runtime` target   | 只启动 HTTP                                                              |
| migration | `src/backend/server-main/Dockerfile` 的 `migration` target | 只执行正式迁移                                                           |
| worker    | `src/backend/server-main/Dockerfile` 的 `worker` target    | 携带生产依赖、维护脚本和 PostgreSQL 16 客户端，直接运行镜像时只读 status |

发布脚本只检查目标主机上已有的镜像，以 `--pull never` 启动，不构建、推送或拉取镜像。下面两条路径任选其一，在执行预检前把四个镜像准备到目标主机。PostgreSQL 16 与 Caddy 2 也应固定经过核验的完整 tag 或 digest。

目标主机还需要 Docker Compose、Node 26，以及与应用版本对应的仓库检出：发布脚本、`compose.production.yaml` 和 `deploy/Caddyfile` 都从检出中读取。

#### 使用预构建镜像

发版前可用 `corepack pnpm trial` 在本机用当前代码走一遍一键安装与升级，见[本地构建试装](development.md#本地构建试装)。推送 `v*` 标签后，[Release 工作流](../.github/workflows/release.yml)先校验标签与根 `package.json` 版本一致、标签提交已合入 main、CHANGELOG 有对应段落，再通过 `workflow_call` 并行调用同一标签提交上的完整 [CI](../.github/workflows/ci.yml) 和 [Backend CI](../.github/workflows/backend-ci.yml)。静态检查、单元测试、Chromium 全量与 WebKit 核心浏览器回归、迁移回放、隔离集成、备份恢复、容器验证和依赖审计全部成功后，才进入发布镜像构建；不以先前 main 上的 CI 结果替代本次门禁。Chromium 全量按文件分 4 片并行执行，门禁范围不变，任一分片失败都会阻止发布。

平时推送到 main 或提交 PR 时，CI、CodeQL 与 Security 按路径过滤：只改 `docs/`、根目录 Markdown、许可证、Issue/PR 模板与 README 时不触发；`docs/api.md` 由后端单测核对，改动它会触发 Backend CI。路径过滤不影响定时扫描，也不影响 Release 通过 `workflow_call` 调用的完整门禁。CI 触发后还会按改动跳过无关的重任务（例如只改部署脚本时不跑浏览器回归），Release 调用时同样不跳过，见[开发指南](development.md#验证入口)。

随后在原生 amd64/arm64 托管机上构建四个镜像，以无标签摘要推送到 GHCR，两个平台的 web/api/migration 都通过容器冒烟后，才合并为多架构清单、打上版本标签并创建 GitHub Release。镜像地址为 `ghcr.io/<所有者>/<仓库名>-<镜像>`（全小写），本仓库即 `ghcr.io/tixxin/tixxinblog-web`、`-api`、`-migration`、`-worker`。

每个镜像只有两类标签：去掉 `v` 的版本号（如 `0.2.0`）和 `sha-<完整提交 SHA>`，不提供 `latest`。镜像同时包含 linux/amd64 与 linux/arm64，并附 SBOM 与构建来源证明；Release 说明列出每个镜像的清单摘要。

在环境文件中填写 GHCR 仓库（见[生产模板](../deploy/production.env.example)中的示例），`RELEASE_VERSION` 使用版本号，然后在目标主机拉取并核对摘要：

```sh
release_version=0.2.0
image_prefix=ghcr.io/tixxin/tixxinblog
for name in web api migration worker; do
  docker pull "$image_prefix-$name:$release_version"
  docker image inspect --format '{{index .RepoDigests 0}}' "$image_prefix-$name:$release_version"
done
# 发布脚本以 --pull never 启动依赖服务，需与环境文件中的 POSTGRES_IMAGE、CADDY_IMAGE 一致并预先拉取
docker pull postgres:16-alpine
docker pull caddy:2-alpine
```

PowerShell：

```powershell
$releaseVersion = '0.2.0'
$imagePrefix = 'ghcr.io/tixxin/tixxinblog'
foreach ($name in 'web', 'api', 'migration', 'worker') {
  docker pull "${imagePrefix}-${name}:${releaseVersion}"
  docker image inspect --format '{{index .RepoDigests 0}}' "${imagePrefix}-${name}:${releaseVersion}"
}
docker pull postgres:16-alpine
docker pull caddy:2-alpine
```

输出的摘要应与 Release 说明一致。GHCR 包为私有时，先用具有 `read:packages` 权限的令牌执行 `docker login ghcr.io`。需要检查来源证明或 SBOM 时，可执行 `docker buildx imagetools inspect <镜像引用> --format '{{ json .Provenance }}'`（SBOM 使用 `.SBOM`）。

fork 的仓库推送自己的 `v*` 标签即可得到同名规则的镜像；首次推送后在 GitHub 包设置中确认可见性和仓库访问权限。

#### 自行构建

在目标主机或可信构建机上，从干净检出的同一提交构建四个镜像，推荐以完整 Git SHA 作为版本。构建上下文是仓库根：

```sh
release_version="$(git rev-parse HEAD)"
docker build -t "tixxin-blog-web:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$release_version" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$release_version" .
```

PowerShell：

```powershell
$releaseVersion = git rev-parse HEAD
docker build -t "tixxin-blog-web:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target runtime -t "tixxin-blog-api:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target migration -t "tixxin-blog-migration:$releaseVersion" .
docker build -f src/backend/server-main/Dockerfile --target worker -t "tixxin-blog-worker:$releaseVersion" .
```

在其他机器构建时，自行推送到可信镜像仓库或用 `docker save`/`docker load` 转移，并核对目标主机上的镜像 ID 与构建结果一致。

#### 环境文件

将[生产模板](../deploy/production.env.example)复制到仓库外受控目录，填写实际值并限制文件权限。不要提交秘密文件或包含完整展开环境的 `docker compose config` 输出。数据库密码和签名密钥可用 `openssl rand -hex 32` 生成。

```sh
install -d -m 700 ../tixxin-private
cp -n deploy/production.env.example ../tixxin-private/production.env
chmod 600 ../tixxin-private/production.env
```

PowerShell：

```powershell
New-Item -ItemType Directory -Force ../tixxin-private | Out-Null
if (-not (Test-Path ../tixxin-private/production.env)) {
  Copy-Item deploy/production.env.example ../tixxin-private/production.env
}
```

两段命令都不会覆盖已有的环境文件；复制后编辑实际值。

| 配置                                                                                                    | 要求                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RELEASE_PROJECT`                                                                                       | 独立且稳定的 Compose 项目名；首次安装后不随意改变卷归属                                                                                                                                                                  |
| `RELEASE_VERSION`                                                                                       | 已准备、不可复用的应用版本；预构建镜像填版本号（如 `0.2.0`），自行构建推荐完整 Git SHA                                                                                                                                   |
| `WEB_IMAGE_REPOSITORY`、`API_IMAGE_REPOSITORY`、`MIGRATION_IMAGE_REPOSITORY`、`WORKER_IMAGE_REPOSITORY` | 对应同一版本的镜像仓库；预构建镜像填 GHCR 地址，不带标签                                                                                                                                                                 |
| `POSTGRES_IMAGE`、`CADDY_IMAGE`                                                                         | 本机已有且明确固定的依赖镜像                                                                                                                                                                                             |
| `POSTGRES_PASSWORD`                                                                                     | 至少 32 位随机十六进制值，避免连接 URL 保留字符问题                                                                                                                                                                      |
| `JWT_ACCESS_SECRET`                                                                                     | 至少 32 位随机签名密钥                                                                                                                                                                                                   |
| `SITE_HOST`、`SITE_URL`                                                                                 | 对外域名与对应 HTTPS origin                                                                                                                                                                                              |
| `NUXT_PUBLIC_DEFAULT_LOCALE`                                                                            | 站点默认界面语言，`zh-CN`（缺省）或 `en`，其余值按 `zh-CN` 处理；运行时读取，访客可在「界面设置」中切换，选择保存在 `blog-locale` cookie；为 `en` 时，执行迁移会把仍未编辑的初始站点资料改为英文，博主编辑过的内容不改写 |
| `SETUP_TOKEN`                                                                                           | 可选，浏览器初始化向导的一次性令牌，至少 32 个字符且不含空白（建议 `openssl rand -hex 32`）；留空时向导关闭，见[初始化管理员](#初始化管理员)                                                                             |
| `TIXXIN_NETWORK_SUBNET`                                                                                 | 可选，项目内部网络子网，缺省 `172.31.250.0/24`；与宿主机已有网络冲突时改为其他未使用的私网 `/24`，见[内部网络](#内部网络)                                                                                                |
| `HTTPS_BIND_ADDRESS`、`HTTP_PORT`、`HTTPS_PORT`                                                         | 默认仅绑定本机，外网访问不到、也无法签发证书；直接对外服务时改为 `0.0.0.0` 或公网网卡地址，并配置防火墙和 DNS                                                                                                            |

API 未设置 `NODE_ENV` 时按 `production` 处理：限流生效、刷新 Cookie 带 `Secure`、日志级别缺省 `info`，且 `MEDIA_DIRECTORY` 必须是绝对路径，否则拒绝启动。镜像已设置 `NODE_ENV=production` 与 `MEDIA_DIRECTORY=/app/var/media`。只有显式的 `development`/`test` 才允许通过 `RATE_LIMIT_DISABLED=true` 关闭限流，生产忽略该开关。

数据库不发布宿主端口，API 由前端同源网关访问。Caddy 转发到前端，前端再转发 `/api/v1` 到 API；版本响应头为 `X-TixXin-Release`。Caddy 在真实域名下会申请证书，正式启用前准备 DNS 和 HTTP/HTTPS 入口。隔离验证使用内部 CA，并真实校验证书，不关闭 TLS 检查或修改系统信任。

#### 可信代理、读取配额与媒体缓存

`WEB_TRUSTED_PROXY_CIDRS`（Nuxt 的直接前置 Caddy 地址）和 `API_TRUSTED_PROXY_CIDRS`（API 的直接前置 Nuxt 地址）映射为 `NUXT_TRUSTED_PROXY_CIDRS` 与 `TRUSTED_PROXY_CIDRS`。这两项**未设置或为空**时，缺省信任项目内部网络子网（`TIXXIN_NETWORK_SUBNET`，缺省 `172.31.250.0/24`）：该网络只接入本项目容器，Caddy 与 Nuxt 都在其中，访客真实地址无需再手工查子网。填写了具体地址时原样生效；需要收窄时填写逗号分隔的明确 IPv4/IPv6 地址或 CIDR，不能用全部私网、`0.0.0.0/0`、布尔开关或任意跳数代替核对。内部网络子网包含 Docker 网关地址，宿主机本机进程可直连容器并伪造转发头，宿主机应只运行受控服务。若要像旧版那样忽略转发头，可填写一个不会出现的地址（如 `127.0.0.1/32`），此时访客会按代理连接地址共享配额，不能用于面向多访客的正式验收。

#### 内部网络

`compose.production.yaml` 声明项目网络 `app`（Docker 中名为 `<RELEASE_PROJECT>_app`），子网取 `TIXXIN_NETWORK_SUBNET`，缺省 `172.31.250.0/24`，所有服务只接入这一网络。数据库与 API 不发布宿主端口，只有 Caddy 发布 HTTP/HTTPS。

- 子网冲突：启动时报 `Pool overlaps with other one on this address space` 时，用 `docker network inspect $(docker network ls -q) --format '{{.Name}} {{range .IPAM.Config}}{{.Subnet}} {{end}}'` 查看已占用网段，把 `TIXXIN_NETWORK_SUBNET` 改为未使用的私网 `/24`。
- 子网只在网络创建时生效：已运行的站点修改子网时，先 `docker compose --env-file "$release_env" -f compose.production.yaml stop`，再 `docker network rm <RELEASE_PROJECT>_app`，然后按[已有站点发布](#已有站点发布)重新启动；数据卷不受影响，不要执行 `down -v`。

**从旧版本升级的影响**：旧版本编排使用 Compose 自动创建的 `<RELEASE_PROJECT>_default` 网络。升级到本版本后，发布流程重建的各容器改接 `<RELEASE_PROJECT>_app`，容器地址随之变化，数据卷、服务名与对外端口不变；旧的 `_default` 网络不再使用，确认没有容器接入后可用 `docker network rm <RELEASE_PROJECT>_default` 删除。环境文件中的取值按下表生效：

| 旧环境文件中的写法                             | 升级后                                                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB_TRUSTED_PROXY_CIDRS=`（模板旧缺省，空值） | **行为变化**：由忽略转发头改为信任内部网络子网，限流与留言地区按访客真实地址计算；内部网络只有本项目容器，Caddy 会重建 `X-Forwarded-For`，不会接受访客伪造的头 |
| 填写了旧 `_default` 网络子网或容器地址         | 原样生效，但新容器不在该网段，访客地址会退化为代理地址；升级时清空这两项或改为新子网                                                                           |
| 填写了独立代理网络、CDN 等其他明确地址         | 原样生效，不受影响                                                                                                                                             |

当前 Caddy 模板直接接收访客连接，覆盖 `X-Forwarded-For` 并移除其他客户端地址提示；Nuxt 从连接地址向外逐跳验证代理链，再向 API 发送单一客户端 IP，API 只接受可信 Nuxt 连接的转发地址。若 Caddy 前另有 CDN/负载均衡，先按真实拓扑独立配置并验证最外层信任边界，不能直接透传访客的头。部署后用两个独立访客地址和伪造转发头验证配额隔离。

限流按真实客户端地址计数：IPv4 按单地址，IPv6 按 `/64` 前缀归并。计数表有上限，满时先清理过期窗口、再淘汰最早的窗口，不会因表满拒绝新访客。

固定 60 秒窗口内，每 IP 的公开业务读取、公开媒体读取和管理读取分别为 120、600、300 次，三个桶互不占用；登录、刷新认证、写入、上传及浏览计数仍保留原有额度。超限响应包含 `Retry-After`，浏览器不立即自动重试。

公开媒体桶也包含精确的 `GET/HEAD /api/v1/subscriptions/favicons/<64位小写十六进制>.webp`，订阅列表与统计仍使用业务读取桶；favicon 经同源网关继续使用 `no-store`。

受管媒体的成功 GET/HEAD 与 304 使用 `Cache-Control: public, max-age=31536000, immutable` 及基于已登记 SHA-256 的 ETag（资源键由 UUID 决定、字节不可变）。条件请求先检查资源未删除且磁盘文件可读，命中时返回无正文的 304。删除后下一次请求返回 404；文件缺失返回 503，错误及其他业务响应保持 `no-store`。同源网关只为精确的受管媒体路径保留缓存头。

公开读取可带 `?w=320|640|960|1280` 取等比缩小的 WebP 变体（质量 80，ETag 为 `"<sha256>-w<宽度>"`），前端列表图据此输出 `srcset/sizes`；其他宽度返回 400，请求宽度不小于原图时直接返回原图。变体在首次请求时生成，缓存到 `MEDIA_DIRECTORY/.media-variants/<媒体UUID>-w<宽度>-<SHA-256前16位>.webp`，同一变体并发只生成一次，全进程同时最多生成 2 个。变体是可再生缓存：回收媒体或移除原文件时同步删除，恢复后按需重新生成；整个 `.media-variants/` 目录可随时删除以回收磁盘（每个媒体最多 4 份，合计通常不超过原图体积），无需停机。缓存写入失败（磁盘满、只读挂载）只影响缓存，不影响响应。

`media` 卷挂载到 API `/app/var/media`；worker 只读挂载同一媒体卷，备份写入专用卷，无需 Docker socket。上传资源会转为 WebP；更换存储位置时同时迁移原文件、数据库登记与权限，`.media-variants/` 不必迁移。不要通过 `down -v` 处理服务故障。

### 站点地址与索引

前端生产构建通过项目 `build` 命令选择 `production-build` 配置层，隔离 `.nuxt-production/` 并显式保持 `site.env: production`。配置层名称不能被当成站点的预发布环境。运行时 `NUXT_PUBLIC_SITE_URL` 必须是实际公开 origin，不能依赖构建期缺省域名。

正式站点应检查首页 canonical、robots、RSS/JSON 订阅和 sitemap 使用同一运行时地址。公开首页不能带 noindex 或整站 `Disallow: /`，管理地址继续禁止索引，并从 sitemap 排除。例外是博主在后台站点设置中关闭了「允许搜索引擎收录本站」：此时全站页面输出 `noindex, nofollow`（meta 与 `X-Robots-Tag`），`robots.txt` 为整站 `Disallow: /`，sitemap 为空；该开关在经本站代理保存后立即生效，其余途径的写入最多 60 秒内生效。

预发布可设置运行时 `NUXT_SITE_ENV=staging` 或 `NUXT_SITE_INDEXABLE=false`。这些设置优先于构建缺省；不要全局强制 indexable 使预发布内容可索引。使用同一产物分别检查正式与预发布配置。

### 访问统计

统计默认关闭，可接入 Umami 或 Plausible。前端在运行时读取下列配置，因此预构建镜像同样适用；生产环境文件中的 `ANALYTICS_*` 由 `compose.production.yaml` 映射为前端的 `NUXT_PUBLIC_ANALYTICS_*`：

| 生产环境文件           | 前端运行时变量                     | 说明                                                           |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `ANALYTICS_PROVIDER`   | `NUXT_PUBLIC_ANALYTICS_PROVIDER`   | `umami` 或 `plausible`；留空关闭                               |
| `ANALYTICS_SITE_ID`    | `NUXT_PUBLIC_ANALYTICS_SITE_ID`    | Umami 的 website ID，或 Plausible 中登记的站点域名             |
| `ANALYTICS_SCRIPT_URL` | `NUXT_PUBLIC_ANALYTICS_SCRIPT_URL` | 统计脚本的完整地址，如自建 Umami 的 `https://<域名>/script.js` |

只有同时设置服务商和脚本地址才会注入脚本。修改环境文件后重新创建前端容器即可生效，无需重新构建镜像；已有站点按[已有站点发布](#已有站点发布)流程切换，或在维护窗口内执行 `docker compose --env-file "$release_env" -f compose.production.yaml up -d --no-deps --no-build --pull never frontend`，只重建前端容器。

前端在运行时读取 `NUXT_PUBLIC_ANALYTICS_SCRIPT_URL`，把该脚本的 origin 追加到 CSP 的 `script-src` 与 `connect-src`，预构建镜像无需重新构建；Umami 与 Plausible 默认向脚本同源地址上报，因此只放行脚本 origin。上报地址与脚本不同源时需另行调整 CSP。统计脚本只在浏览器端注入，访客开启“请勿追踪”（DNT）或全球隐私控制（GPC）时不加载。接入后在浏览器开发者工具中核对脚本加载和上报请求均成功。

### 预检与首次安装

以下示例中的配置和备份路径应替换为实际仓库外目录：

```sh
release_env=../tixxin-private/production.env
origin=https://blog.example.com
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin"
```

PowerShell：

```powershell
$releaseEnv = '../tixxin-private/production.env'
$origin = 'https://blog.example.com'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin
```

默认只解析配置、检查入口约定和本地镜像，不创建服务或卷。脚本显式指定环境文件，并清除当前 shell 对模板变量的覆盖，仅 `--version` 覆盖文件版本。预检不证明 DNS、证书签发、生产凭据有效性或数据库兼容性。

首次安装要求项目尚无容器且全部目标卷不存在：

```sh
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize --apply
```

PowerShell：

```powershell
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --initialize --apply
```

执行依次启动空数据库、运行正式迁移、启动 API/前端/HTTPS，再验证就绪、同源公开 API 和版本头。不执行开发 seed。首次安装失败时保留已创建卷；不要反复使用 `--initialize` 绕过检查，核对现场并备份后改走已有站点流程。

### 初始化管理员

#### 浏览器初始化向导

环境文件配置了 `SETUP_TOKEN` 时，站点启动后打开 `https://<域名>/setup?token=<令牌>`，在页面上设置登录名、密码（6–128 个字符）、站点名称和站点语言即可创建首个博主账号，随后用刚设置的凭据自动登录并进入 `/admin`（自动登录失败时退回 `/admin/login`）。尚未初始化时，首页会在浏览器端显示一行提示并链接到后台登录页，初始化完成后提示消失。页面只在浏览器渲染（服务端响应不回显带令牌的地址），读取令牌后立即从地址栏移除；页面不进入 SSR 缓存、不被索引，也不发送 Referer。

- 只有数据库里没有任何管理员时向导才开放；账号创建后向导与接口永久关闭（`/api/v1/setup` 返回 404），令牌即使泄露也无法再次使用。完成后可从环境文件删除 `SETUP_TOKEN`，下次发布时生效。
- 后台登录页检测到需要初始化时会显示前往向导的提示。
- 提交受独立限流保护（每个地址每 10 分钟 5 次）；并发提交只有一次成功。
- 未配置 `SETUP_TOKEN` 时向导关闭，使用下面的命令行方式初始化。
- 一键安装会自动生成 `SETUP_TOKEN` 写入 `<安装目录>/.env`，并在安装完成时打印完整链接，见[5 分钟部署](quick-start.md#初始化)。

#### 命令行初始化

在受控终端环境设置 `ADMIN_DEFAULT_USERNAME` 与至少 6 位随机 `ADMIN_DEFAULT_PASSWORD`，不要把密码写入命令参数或日志。服务镜像就绪后执行：

```sh
read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
```

PowerShell：

```powershell
$env:ADMIN_DEFAULT_USERNAME = Read-Host '登录名'
$env:ADMIN_DEFAULT_PASSWORD = Read-Host '密码' -MaskInput
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
Remove-Item Env:ADMIN_DEFAULT_USERNAME, Env:ADMIN_DEFAULT_PASSWORD
```

该命令只创建账号，同名账号已存在时拒绝覆盖；完成后移除终端密码环境变量，再访问 `/admin/login`。`seed:dev` 会插入开发内容，不能用于生产初始化。个人资料和首批内容在后台明确维护、审核后发布。

### 重置管理员密码

忘记密码或怀疑凭据泄露时，在服务器本机通过一次性容器执行；该操作没有 HTTP 入口。新密码至少 6 位，可在受控终端设置 `ADMIN_RESET_PASSWORD`，未设置时在交互终端隐藏输入两次。存在多个管理员时用 `ADMIN_RESET_USERNAME` 指定账号。第一条交互输入，第二条从环境变量读取：

```sh
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -it backend node dist/admin-reset-password.js
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_RESET_USERNAME -e ADMIN_RESET_PASSWORD backend node dist/admin-reset-password.js
```

PowerShell：

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -it backend node dist/admin-reset-password.js
docker compose --env-file $releaseEnv -f compose.production.yaml run --rm --no-deps -e ADMIN_RESET_USERNAME -e ADMIN_RESET_PASSWORD backend node dist/admin-reset-password.js
```

命令以 argon2id 保存新密码，递增会话版本并撤销全部会话与刷新令牌，所有已登录设备需重新登录；同一事务写入“命令行重置密码”审计。本机开发先 `corepack pnpm --filter server-main build`，再执行 `corepack pnpm --filter server-main exec node dist/admin-reset-password.js`。完成后移除终端中的密码环境变量。

初始化与重置命令对配置缺失、账号已存在或不存在、密码不合规等情况输出具体原因；数据库等未知异常只输出脱敏提示，不打印连接参数。

### 已有站点发布

先为实际目标创建最新一致完整备份，并完成清单/文件校验；需要时另外做隔离恢复。备份必须包含数据库和登记媒体，普通 dump 不能代替完整备份。目标、快照时间和媒体范围由操作者核对，脚本不能证明任意输入目录属于即将升级的站点。

```sh
backup_directory=../tixxin-private/backups/verified-backup
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --backup-directory "$backup_directory"
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --backup-directory "$backup_directory" --apply
```

PowerShell：

```powershell
$backupDirectory = '../tixxin-private/backups/verified-backup'
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory
node scripts/release/release.mjs --env-file $releaseEnv --version $releaseVersion --origin $origin --backup-directory $backupDirectory --apply
```

实际执行会校验完整备份，获取本机项目发布锁，检查数据库，停止前端/API 写入，运行独立迁移，再启动应用与 HTTPS 并核对版本。发布存在明确维护窗口。发布锁存在时先确认是否仍有发布进程，不通过删除锁强行并发。

若本项目 worker 已经运行，迁移前一并停止；仅在新应用与 HTTPS 就绪且新配置仍允许 worker 时，使用同版本镜像恢复。默认关闭时不因发布自动启动 worker。一旦存在一次性 `compose run worker`，预检拒绝与其并发，先等待该任务结束。

迁移失败不继续启动新应用；入口检查失败不报告成功，worker 保持停止。失败保留卷、镜像和现场，由操作者依据阶段结果恢复所需服务，不自动回滚数据库或删除数据。

### 应用回退与数据恢复

确认目标应用兼容当前数据库结构及新写入数据后，才使用回退模式：

```sh
rollback_version=0.1.0 # 替换为已验证的旧版本
node scripts/release/release.mjs --env-file "$release_env" --version "$rollback_version" --origin "$origin" --action rollback --database-compatible --backup-directory "$backup_directory"
```

PowerShell：

```powershell
$rollbackVersion = '0.1.0' # 替换为已验证的旧版本
node scripts/release/release.mjs --env-file $releaseEnv --version $rollbackVersion --origin $origin --action rollback --database-compatible --backup-directory $backupDirectory
```

核对预检后追加 `--apply`。回退只切换应用镜像，保持持久化卷，跳过迁移并检查入口；`--database-compatible` 是操作者的明确判断，不是自动兼容验证。

迁移已成功而应用失败时，优先修复应用或新增向前迁移。需要回到备份时刻的数据状态时，停止 API 和 worker 写入，在独立目标恢复并校验，随后同时切换数据库和媒体；保留切换前数据，详见[恢复流程](backup-and-recovery.md#切换恢复目标)。应用回退与数据恢复不能互相替代。

### 可选 worker 与运行观察

SMTP、自动备份和持续 worker 默认关闭。先按[运行维护](operations.md)配置通道和数据库控制状态，再明确启用：

```sh
docker compose --env-file "$release_env" -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
docker compose --env-file "$release_env" -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

PowerShell：

```powershell
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker run --rm worker node scripts/operations.mjs status
docker compose --env-file $releaseEnv -f compose.production.yaml --profile worker up -d --no-build --pull never worker
```

持续执行还要求 `OPERATIONS_WORKER_ENABLED=true`。邮件和备份各有环境开关及数据库暂停状态，缺一不可；恢复旧队列不会因启动 worker 自动重投。

每个 API 响应带 `X-Request-Id`，与响应体 `traceId`、访问日志 `req.id` 及管理审计的 trace 编号一致；上游 `x-trace-id` 仅接受 UUID 或不超过 64 位的 `[A-Za-z0-9._-]`，否则重新生成。未知异常和 5xx 在服务端日志记录堆栈与 `traceId`，客户端只收到通用提示。API 收到 `SIGTERM`/`SIGINT` 后 `/ready` 立即返回 503，再继续原有关闭流程；启动失败记录错误并以非零码退出。

Caddy 入口为响应追加 `Strict-Transport-Security: max-age=86400`（不含子域和 preload）与禁用摄像头、麦克风、定位、支付和 USB 的 `Permissions-Policy`；API 不返回 `X-Powered-By`。

HSTS 生效后，访客浏览器在有效期内只用 HTTPS 访问本站，证书过期或配置错误时显示不可绕过的错误页，也无法临时退回 HTTP；撤销需改为 `max-age=0` 且只对再次通过 HTTPS 访问的浏览器生效。因此先用一天观察证书自动续期与迁移流程，确认稳定（建议至少一至两周、经历一次续期）后再在 `deploy/Caddyfile` 中改为 `max-age=31536000`。只有确认所有子域长期支持 HTTPS 时才考虑 `includeSubDomains`；`preload` 撤销需等待浏览器版本更新，个人站点一般不需要。

服务日志写 stdout/stderr，Compose 按服务轮转；日志不是备份。通过 `/ready`、实际公开 API、媒体读取、管理登录、任务状态和存储完整性检查观察系统。版本升级后验证公开内容、后台写入、索引和备份，不能只用容器 running 状态判断可用。

### 本地编排与隔离验证

需要不接触已有部署、也不复用开发数据库的生产式本机预览时，使用根 `compose.yaml`。它从源码构建前端、API 和迁移镜像，`up` 时先运行一次性迁移再启动 API 与前端，只在 `127.0.0.1` 发布前端端口；数据库与媒体使用该 Compose 项目自己的卷（项目名默认取仓库目录名）。本机 HTTP 入口不能替代真实 HTTPS 登录和发布验证。

| 变量                | 要求                                                           |
| ------------------- | -------------------------------------------------------------- |
| `POSTGRES_PASSWORD` | 必填，随机十六进制值                                           |
| `JWT_ACCESS_SECRET` | 必填，至少 32 位随机值                                         |
| `WEB_PORT`          | 可选，宿主端口，默认 `3458`                                    |
| `SITE_URL`          | 可选，默认 `http://localhost:3458`；修改 `WEB_PORT` 时同步修改 |

1. 在仓库外建立环境文件（已有文件不要覆盖）：

   ```sh
   preview_env=../tixxin-local/compose.env
   install -d -m 700 ../tixxin-local
   test -e "$preview_env" || (
     umask 077
     printf 'POSTGRES_PASSWORD=%s\nJWT_ACCESS_SECRET=%s\nWEB_PORT=3458\nSITE_URL=http://localhost:3458\n' \
       "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$preview_env"
   )
   ```

   PowerShell（7.2 及以上）：

   ```powershell
   $previewEnv = '../tixxin-local/compose.env'
   New-Item -ItemType Directory -Force ../tixxin-local | Out-Null
   function New-HexSecret { -join ([Security.Cryptography.RandomNumberGenerator]::GetBytes(32) | ForEach-Object { $_.ToString('x2') }) }
   if (-not (Test-Path $previewEnv)) {
     "POSTGRES_PASSWORD=$(New-HexSecret)", "JWT_ACCESS_SECRET=$(New-HexSecret)", 'WEB_PORT=3458', 'SITE_URL=http://localhost:3458' |
       Set-Content -Encoding utf8NoBOM $previewEnv
   }
   ```

2. 构建并启动，等待 `backend` 与 `frontend` 为 healthy、`migration` 已成功退出：

   ```sh
   docker compose --env-file "$preview_env" up --build -d
   docker compose --env-file "$preview_env" ps -a
   ```

   PowerShell：

   ```powershell
   docker compose --env-file $previewEnv up --build -d
   docker compose --env-file $previewEnv ps -a
   ```

3. 初始化管理员。与[生产初始化](#初始化管理员)相同，密码至少 6 位，只通过环境变量传入：

   ```sh
   read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
   read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
   docker compose --env-file "$preview_env" run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
   unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
   ```

   PowerShell：

   ```powershell
   $env:ADMIN_DEFAULT_USERNAME = Read-Host '登录名'
   $env:ADMIN_DEFAULT_PASSWORD = Read-Host '密码' -MaskInput
   docker compose --env-file $previewEnv run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
   Remove-Item Env:ADMIN_DEFAULT_USERNAME, Env:ADMIN_DEFAULT_PASSWORD
   ```

   忘记预览账号密码时，用同样的方式运行 `backend node dist/admin-reset-password.js`，参数见[重置管理员密码](#重置管理员密码)。

4. 按 `SITE_URL` 的地址打开网站与 `/admin/login`。API 按生产模式运行，刷新 Cookie 带 `Secure`；请通过 `localhost` 访问，浏览器对本机 HTTP 上 Secure Cookie 的处理不一致时，以真实 HTTPS 环境的验证为准。新库没有公开内容，也不执行开发 seed。

5. 停止预览使用 `docker compose --env-file "$preview_env" down`（PowerShell 将变量换成 `$previewEnv`），数据卷保留。只有确认不再需要这份预览数据时才追加 `-v` 删除本项目的卷；不要对生产项目使用 `down -v`。

发布脚本与生产式编排的自动化验证：

```sh
node --test scripts/release/release.test.mjs scripts/release/production-artifact-cleanup.test.mjs
node scripts/release/production-integration.mjs
```

生产式集成要求干净 Git 检出，只从跟踪文件冻结同一快照构建四类镜像。它使用随机 Docker 项目、随机凭据、本机端口和内部 CA，验证首次 HTTPS、索引、非空内容、原生备份/恢复、非空历史队列暂停、版本协调、迁移失败、回退和故障反馈。

所有测试资源按本次归属清理；原始证据留在忽略目录。镜像别名来自同一快照时，仅能验证版本切换编排，不能证明任意旧版应用兼容新数据库。真实 DNS、外部证书、SMTP 认证、异地接收服务和实际数据切换需要在目标环境分别核验。
