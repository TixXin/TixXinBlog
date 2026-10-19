# 常见问题与故障排查

本文覆盖本地开发与生产部署的常见故障。命令从仓库根目录执行，使用 Node.js >=25 <26、pnpm 9.15.0；Shell 示例适用于 macOS/Linux，系统观察命令需安装相应工具。首次配置见[开发指南](development.md)，生产操作见[部署指南](deployment.md)，项目命令定义见[根脚本说明](scripts.md)。

## 先保留现场并确认环境

记录当前提交、故障时间、实际 URL、HTTP 状态及复现步骤。后端请求使用响应头 `X-Request-Id`、响应体 `traceId` 对照 API 日志；连接未到达后端时可能没有后端请求编号。提交日志前去除 Cookie、令牌、密码、数据库连接串和私人内容。

```sh
git status --short
git rev-parse HEAD
node --version
corepack pnpm --version
```

本地先核对后端 `.env.local`、前端 `.env` 与进程环境中的目标地址，不用模板覆盖已有配置。需要完整开发链路自检时执行：

```sh
corepack pnpm dev:check
```

`dev:check` 不启动服务，但会连接配置中的数据库、读取迁移记录并请求服务探针；禁止连接数据库的场景不要运行。数据库检查先于服务检查，数据库失败时应先读具体错误，不能据此认定端口空闲。开发日志位于 `.artifacts/dev/<会话>/`，macOS 分窗启动日志位于 `.artifacts/dev-terminal/`；复用的服务查看原会话日志。

生产观察示例使用以下变量，先替换为实际环境文件与站点地址，并确认 `RELEASE_PROJECT` 是原部署项目名：

```sh
release_env=../tixxin-private/production.env
origin=https://blog.example.com
docker compose --env-file "$release_env" -f compose.production.yaml ps -a
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge frontend backend
```

以上 Compose 命令只查看已有容器。生产服务名为 `postgres`、`migration`、`backend`、`frontend`、`edge` 和可选 `worker`；不要用完整展开的 Compose 配置输出收集问题报告，以免暴露秘密。

迁移、恢复、修改配置和重启需分别按对应操作指南核对目标、备份及授权。不要用清库、删卷或切换 Mock 处理服务故障。

## 端口占用或访问了错误的实例

症状包括 `EADDRINUSE`、启动器提示“端口被占用，但无法确认服务归属”，或前端启动后地址与预期不一致。

1. 核对默认端口：开发前端 `3456`、API `3457`、开发 PostgreSQL 宿主映射 `5433`；根 `compose.yaml` 的本机预览为 `127.0.0.1:3458`。生产 Compose 内部前后端各用 `3000`，API 不发布宿主端口。
2. 用系统工具找出监听者，再核对其启动终端、工作目录与用途：

   ```sh
   lsof -nP -iTCP:3456 -sTCP:LISTEN
   lsof -nP -iTCP:3457 -sTCP:LISTEN
   ```

3. 统一启动器依据服务、worktree 路径与数据库指纹判断归属。其他 worktree 的实例不一定可复用；它不会结束陌生进程。确认是本人的旧实例后，在其原终端正常退出，避免按端口批量杀进程。
4. `corepack pnpm dev` / `dev:blog` 直接启动 Nuxt，不做归属复用，端口不可用时可能选择其他端口，以终端 Local 地址为准。需要完整链路时按[启动、复用与退出](development.md#启动复用与退出)操作；macOS 分窗启动前后都用 `dev:check` 核验。
5. 若需更换端口，同步后端 `PORT` 与前端 `NUXT_API_BASE_URL`；更换前端端口时同步 `NUXT_PORT`、后端 `CORS_ORIGIN` 和前端 `NUXT_PUBLIC_SITE_URL`，然后重启受影响实例。不要因应用端口冲突改写原数据库配置或重建卷。

复查时以归属匹配、后端就绪、前端同源业务接口成功为准，打开终端窗口或看到监听端口不等于启动完成。

## 提示有待执行迁移或数据库结构漂移

开发启动器不会自动迁移、seed 或清库。确认 `DATABASE_URL` 指向预期数据库后，检查已执行/待执行数量及结构：

```sh
corepack pnpm --filter server-main migration:list
corepack pnpm --filter server-main migration:check
```

这两条命令会连接数据库。`migration:list` 输出 `executed`、`pending` 数量；`migration:check` 先检查待执行迁移，再比较实体与数据库结构，失败时返回非零，不会自动修复。

- 存在待执行迁移：保留备份、确认写入目标与授权后，本地执行下列命令，再重新自检。

  ```sh
  corepack pnpm --filter server-main migration:up
  corepack pnpm --filter server-main migration:check
  corepack pnpm dev:check
  ```

- `pending` 为零但仍有结构差异：核对代码版本、实际数据库和正式迁移记录。保留错误输出，由维护者判断是否需要新增正式迁移；不要手工覆盖结构、修改已发布迁移或用 `reset` 消除错误。
- 生产迁移失败：查看发布脚本的失败阶段与 `migration` 日志，按[已有站点发布](deployment.md#已有站点发布)处理。生产使用独立迁移镜像，HTTP 服务启动不执行迁移；失败后保留卷与现场，不自动回滚数据库。

生产迁移日志可这样查看；若一次性容器已被移除，需查看原发布终端留存的输出：

```sh
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 migration
```

后端 `/ready` 仅检查关闭状态与数据库 `select 1`，返回 200 不能证明迁移完成、结构一致或业务查询成功。

## 请求返回 429

先查看该请求的 `Retry-After` 响应头，等待指定秒数后再试，并查找重复请求、轮询或批量加载来源；不要立即循环重试或轮换访客标识。

当前普通运行环境采用固定 60 秒窗口，每 IP 的公开业务读取、公开媒体读取、管理读取分别为 120、600、300 次，三个桶独立。认证、写入、上传及浏览计数使用各自额度，具体规则见[限流守卫](../src/backend/server-main/src/common/guards/rate-limit.guard.ts)；测试环境窗口为 1 秒。IPv4 按地址计数，IPv6 按 `/64` 前缀归并。

本地与生产分别排查：

- 本地：统一启动器启动 API 时默认注入 `RATE_LIMIT_DISABLED=true`；直接 `corepack pnpm dev:api` 不注入，仍以实际后端配置为准。需要验证限流时在后端 `.env.local` 显式设置 `RATE_LIMIT_DISABLED=false` 并重启对应 API。此开关仅在 `development` / `test` 有效，生产或未设置 `NODE_ENV` 时不能关闭限流。
- 生产：多个访客很快耗尽同一额度时，核对 `WEB_TRUSTED_PROXY_CIDRS` 与 `API_TRUSTED_PROXY_CIDRS`，分别对应 Nuxt 前的 Caddy、API 前的 Nuxt。两项未设置或为空时缺省信任项目内部网络子网；仍填着旧版 `_default` 网络子网时新容器不在该网段，会按代理连接地址共享额度。需要时按真实拓扑配置精确地址或窄 CIDR，不能填写 `0.0.0.0/0` 或笼统信任全部私网。

配置代理后，用两个独立访客地址验证配额隔离，同时验证伪造转发头不能改变计数身份；存在 CDN 等额外代理时先核对最外层信任边界。完整契约见[可信代理、读取配额与媒体缓存](deployment.md#可信代理读取配额与媒体缓存)。

## SSR 页面或同源 API 返回 502

真实请求链为浏览器/SSR → Nuxt 同源 `/api/v1` → NestJS；生产入口再增加 Caddy → `frontend:3000`。多个栏目同时失败时，先定位失败在哪一层。

本地默认端口下依次检查；后端就绪和业务查询会访问数据库：

```sh
curl -i --max-time 15 http://127.0.0.1:3457/health
curl -i --max-time 15 http://127.0.0.1:3457/ready
curl -i --max-time 15 'http://127.0.0.1:3457/api/v1/posts?pageSize=1'
curl -i --max-time 15 'http://localhost:3456/api/v1/posts?pageSize=1'
```

| 检查结果                          | 下一步                                                |
| --------------------------------- | ----------------------------------------------------- |
| `/health` 也无法连接              | 核对后端进程、监听地址和启动错误                      |
| `/health` 成功，`/ready` 返回 503 | 查看后端数据库连接/认证错误或关闭状态；不要只重启前端 |
| `/ready` 成功，后端业务接口失败   | 核对迁移、业务错误与请求编号；就绪探针未覆盖全部业务  |
| 后端业务接口成功，前端同源失败    | 核对 Nuxt 服务端 API 地址、代理连接和前端日志         |
| 同源业务接口成功，页面仍失败      | 核对该页实际失败请求及 SSR 堆栈，记录路径和参数       |

本地 `NUXT_API_BASE_URL` 应类似 `http://127.0.0.1:3457/api/v1`，包含业务前缀；浏览器 `NUXT_PUBLIC_API_BASE_URL` 保持 `/api/v1`。生产 Compose 将服务端地址设为 `http://backend:3000/api/v1`，容器内的 `localhost` 不能代替另一个服务。

[同源网关](../src/frontend/web-blog/server/api/v1/%5B...path%5D.ts)在后端地址为空或不是 HTTP(S) 时返回 503“后端连接尚未配置”，连接或代理超时异常返回 502“后端暂时不可用，请稍后重试”。后端返回的业务错误应按实际响应处理，不能把所有 5xx 都归为 SSR 故障。普通代理请求超时为 10 秒；备份与媒体完整性检查为 120 秒，媒体上传及文章批量执行 POST 为 60 秒。超时先查慢请求和资源状态，不直接扩大时限。

生产先查看 `edge/frontend/backend` 日志与容器健康状态，再请求真实入口：

```sh
curl -i --max-time 15 "$origin/api/v1/posts?pageSize=1"
```

生产 API 不发布宿主端口，后端 `/ready` 由其容器健康检查访问；公开域名的 `/ready` 不等同于后端探针。恢复后同时验证页面和同源 API，空列表必须是成功响应中的真实结果，不用 Mock 或假零值掩盖故障。

## 图片或媒体返回 404

先在浏览器网络面板确认失败的是受管媒体、静态文件还是外部图片。受管媒体路径为 `/api/v1/media/<UUID v4>.webp`；将变量替换为实际 URL 后查看响应：

```sh
media_url='https://blog.example.com/api/v1/media/实际媒体UUID.webp'
curl -I --max-time 15 "$media_url"
```

| 响应                  | 当前受管媒体行为与排查方向                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| 404                   | 路径格式错误、没有登记或资源已软删除；核对 URL 与后台 `/admin/media` 的记录 |
| 503“媒体文件暂不可用” | 登记存在但原文件缺失、不可读或读取失败；核对卷、目录和权限                  |
| 400                   | 检查参数；`?w=` 只支持 `320/640/960/1280`                                   |
| 200 / 304             | 核对浏览器实际请求与显示错误；成功受管媒体使用 ETag 和一年 `immutable` 缓存 |

服务端处理条件请求时仍先检查未删除与文件可读，返回 304 不能绕过这些检查；浏览器已有的新鲜缓存未必发起请求，排查时结合上述直接请求观察。具体实现见[媒体服务](../src/backend/server-main/src/modules/media/media.service.ts)。

生产编排设置 `MEDIA_DIRECTORY=/app/var/media`，API 可读写 `media` 卷，worker 只读挂载同一卷。核对 `RELEASE_PROJECT` 是否变化、卷是否挂错及运行用户权限；更换数据库或恢复时，原文件与数据库登记必须一起匹配。不要通过重新上传同名文件或删除卷猜测修复。

后台 `/admin/maintenance` 的“核验现有媒体文件”会列出缺失、损坏或不可读的资源，不自动恢复；“刷新运行诊断”包含临时文件写入、读取和清理探测，不是完全只读检查。原文件丢失时按[备份与恢复](backup-and-recovery.md)从已校验备份恢复；`.media-variants/` 是派生缓存，不能代替原图。

图库和图片提示词中的外链图片由浏览器访问，服务器不主动抓取；检查远端状态、地址有效性及浏览器的 HTTPS/CSP 拦截。外链文件不在本项目媒体卷或完整备份内，不能用数据库迁移修复远端 404。

## HTTPS 证书错误或无法签发

1. 核对 `SITE_HOST`、`SITE_URL` 与实际访问域名一致，并核对域名 DNS、服务器时间、入口防火墙及端口映射。当前生产模板默认 `HTTPS_BIND_ADDRESS=127.0.0.1`，HTTP/HTTPS 宿主端口为 `80/443`，不会自动开放公网入口。
2. 查看 `edge` 日志中的签发、续期或上游连接错误，再检查外部实际收到的证书：

   ```sh
   docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge
   curl -vI --max-time 15 "$origin/"
   ```

3. 核对证书域名、有效期与信任链；若前面有 CDN/负载均衡，确认报错证书属于哪个入口。TLS 成功后才继续排查 HTTP 502。不要用 `curl -k` 或关闭浏览器校验作为修复结果。
4. Caddy 的证书保存在 `certificates:/data`，配置数据保存在 `caddy-config:/config`。确认卷归属和权限，保留已有证书数据，不删卷反复申请。修复入口或配置后，通过正常 HTTPS 请求复查并观察续期日志。

隔离生产式验证使用内部 CA，不能据此证明真实 DNS 或公网证书签发正常。配置入口见[镜像与环境](deployment.md#镜像与环境)，实际模板见 [Caddyfile](../deploy/Caddyfile)。

## HSTS 导致浏览器强制 HTTPS

当前 Caddy 配置发送 `Strict-Transport-Security: max-age=86400`，没有 `includeSubDomains` 或 `preload`。浏览器接收后会在有效期内强制 HTTPS；证书错误时不能通过临时访问 HTTP 恢复服务。

先修复证书和 HTTPS 入口，再查看响应头：

```sh
curl -I --max-time 15 "$origin/"
```

若维护者确需撤销 HSTS，在 `deploy/Caddyfile` 中将值改为 `max-age=0` 并按部署流程使配置生效；只有再次成功通过 HTTPS 收到该头的浏览器才会撤销。仅删除响应头或改为 HTTP 不会清除浏览器已保存的有效策略；本机浏览器状态也不能代表其他访客。延长期限或启用子域策略前按[运行观察中的 HSTS 说明](deployment.md#可选-worker-与运行观察)核对证书续期与各子域条件。

## 内存不足、进程退出或持续重启

先区分构建期、开发服务和生产运行期。保存退出前日志：`JavaScript heap out of memory` 指向 Node 堆耗尽；容器退出、137 退出码或重启次数本身不足以证明内存不足，需结合 OOM 状态与主机资源记录。

生产可先取得已核对的目标容器 ID，例如前端；API 或 worker 问题应替换为对应服务：

```sh
docker compose --env-file "$release_env" -f compose.production.yaml ps -a
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 frontend backend
docker compose --env-file "$release_env" -f compose.production.yaml ps -a -q frontend
```

将实际 ID 填入下列变量；`stats` 用于运行中的容器，退出原因用 `inspect` 核对：

```sh
container_id=替换为实际容器ID
docker inspect --format '{{.State.OOMKilled}} {{.State.ExitCode}} {{.State.Error}}' "$container_id"
docker stats --no-stream "$container_id"
```

本地可用活动监视器或系统进程工具对照 Node 进程、内存压力与故障时间。继续按以下方向排查：

- 先核对是否同时运行多个 worktree、重复开发服务或并发构建。只处理归属明确的任务，保留故障日志再调整并发。
- 开发性能排查保持 `NUXT_DEVTOOLS_ENABLED` 关闭，只有值为 `true` 才启用，修改后需重启前端；不要用开发调试器的开销推断生产内存需求。
- `corepack pnpm start` 会先重新构建前端，不能当作只运行已有产物的命令。生产前端镜像直接运行 `.output/server/index.mjs`；构建失败应检查构建机资源，运行期失败应检查对应容器及主机。构建入口和中间目录隔离见[构建与生成目录](development.md#构建与生成目录)。
- 图片处理已有上传 8 MiB、解码 4000 万像素和变体生成并发 2 的边界，但不构成进程总内存上限；图片操作时出错需关联具体请求和资源用量。

当前 Compose、Dockerfile 和项目脚本没有设置容器内存限额或 `NODE_OPTIONS` 堆上限，也没有声明最低内存容量。先根据主机/容器限制、实际峰值与重复复现定位原因；需要调整资源或 Node 堆时，为数据库和其他进程保留容量，变更后复测同一负载，不把盲目提高堆上限或反复重启当成解决依据。
