# 5 分钟部署

面向第一次部署的用户：准备一台装好 Docker 的 Linux 服务器和一个域名，用 GitHub Release 发布的预构建镜像（以 v0.2.0 为例）搭起带 HTTPS 的站点。这里只给首次安装的最短路径，各项配置的完整说明、自行构建镜像、PowerShell 写法和本机预览见[部署与版本切换](deployment.md)。

## 前提条件

- 一台 amd64 或 arm64 的 Linux 服务器，已安装 Docker Engine 和 Docker Compose v2 插件（`docker compose`）。
- 服务器上有 Node.js 25（`>=25 <26`）、`git` 和 `openssl`。发布脚本在宿主机上运行，不需要安装项目依赖。
- 域名的 A/AAAA 记录已指向这台服务器，公网可以访问服务器的 80 和 443 端口，且这两个端口没有被其他程序占用。Caddy 首次启动时会申请证书，发布脚本最后会通过真实 HTTPS 地址验收。

下文以 `blog.example.com` 为例，请替换为自己的域名。

## 1. 获取部署文件

不需要构建源码，但发布脚本、`compose.production.yaml` 和 `deploy/Caddyfile` 都从仓库检出读取，所以要检出与镜像同版本的标签。浅克隆只下载这一个版本：

```sh
git clone --depth 1 --branch v0.2.0 https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog
```

后面的命令都在这个目录中执行。实际用到的文件：

| 文件                            | 作用                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `compose.production.yaml`       | 生产编排：PostgreSQL、迁移、API、前端、Caddy、worker |
| `deploy/Caddyfile`              | HTTPS 入口，自动申请证书并转发到前端                 |
| `deploy/production.env.example` | 生产环境变量模板                                     |
| `scripts/release/release.mjs`   | 预检、首次安装、升级与回退脚本                       |

## 2. 填写环境变量

把模板复制到仓库外的私有目录。命令不会覆盖已有文件：

```sh
install -d -m 700 ../tixxin-private
cp -n deploy/production.env.example ../tixxin-private/production.env
chmod 600 ../tixxin-private/production.env
```

生成两个密钥，各运行一次，把输出分别填入下表对应的变量：

```sh
openssl rand -hex 32
openssl rand -hex 32
```

然后编辑 `../tixxin-private/production.env`，只需改以下几项，其他保持模板值：

| 变量                         | 填写                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `RELEASE_VERSION`            | `0.2.0`（去掉 `v` 的版本号）                                                   |
| `WEB_IMAGE_REPOSITORY`       | `ghcr.io/tixxin/tixxinblog-web`                                                |
| `API_IMAGE_REPOSITORY`       | `ghcr.io/tixxin/tixxinblog-api`                                                |
| `MIGRATION_IMAGE_REPOSITORY` | `ghcr.io/tixxin/tixxinblog-migration`                                          |
| `WORKER_IMAGE_REPOSITORY`    | `ghcr.io/tixxin/tixxinblog-worker`                                             |
| `POSTGRES_PASSWORD`          | 第一个 `openssl rand -hex 32` 的输出（必须是至少 32 位的十六进制）             |
| `JWT_ACCESS_SECRET`          | 第二个 `openssl rand -hex 32` 的输出（至少 32 个字符）                         |
| `SITE_HOST`                  | 域名，如 `blog.example.com`                                                    |
| `SITE_URL`                   | 对应的 HTTPS 地址，如 `https://blog.example.com`，不带路径和结尾斜杠           |
| `HTTPS_BIND_ADDRESS`         | `0.0.0.0` 或服务器公网网卡地址；模板默认 `127.0.0.1`，只监听本机，外网访问不到 |

注意：

- `RELEASE_PROJECT` 保持 `tixxin-production` 即可。它决定数据卷的名字，安装后不要再改。
- 站点默认界面语言由 `NUXT_PUBLIC_DEFAULT_LOCALE` 决定，模板为 `zh-CN`，面向英文读者可改为 `en`；只影响界面文案与尚未编辑的初始站点资料，不翻译文章等内容。
- 使用 fork 的镜像时，把 `tixxin/tixxinblog` 换成自己的 `<所有者>/<仓库名>`（全小写）。
- 环境文件包含数据库密码和签名密钥，不要提交到 Git，另外妥善保存一份；丢失后无法连接已有数据库。

## 3. 拉取镜像并启动

发布脚本只使用本机已有的镜像（以 `--pull never` 启动），所以先拉取四个应用镜像和 PostgreSQL、Caddy 两个依赖镜像。`origin` 改为自己的 `SITE_URL`：

```sh
release_env=../tixxin-private/production.env
release_version=0.2.0
origin=https://blog.example.com
for name in web api migration worker; do
  docker pull "ghcr.io/tixxin/tixxinblog-$name:$release_version"
done
docker pull postgres:16-alpine
docker pull caddy:2-alpine
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize
node scripts/release/release.mjs --env-file "$release_env" --version "$release_version" --origin "$origin" --initialize --apply
```

- 第一条 `release.mjs`（不带 `--apply`）是预检：解析配置，核对 `SITE_HOST`、`SITE_URL` 与 `--origin` 一致、密码和密钥格式、镜像已在本机，并确认这是一个没有容器和数据卷的全新项目。它不创建任何服务或卷，输出 JSON 报告。
- 第二条执行安装：启动空数据库，运行一次性 `migration` 容器完成正式迁移，再启动 API、前端和 Caddy，最后通过 `https://<域名>/api/v1/posts?pageSize=1` 验证 HTTPS、同源 API 和版本头。输出中 `"status": "ready"` 表示成功。
- 迁移包含在第二条命令里，不需要单独执行；也不会写入开发样本，新站点没有任何文章。
- 失败时脚本保留数据卷和现场，报告写在 `.artifacts/release/` 下。按下文常见问题排查，不要反复使用 `--initialize` 绕过检查，详见[预检与首次安装](deployment.md#预检与首次安装)。

## 4. 创建博主账号

在同一个终端执行。登录名和至少 12 位的密码通过隐藏输入传入，不出现在命令参数里：

```sh
read -rp '登录名：' ADMIN_DEFAULT_USERNAME && export ADMIN_DEFAULT_USERNAME
read -rsp '密码：' ADMIN_DEFAULT_PASSWORD && echo && export ADMIN_DEFAULT_PASSWORD
docker compose --env-file "$release_env" -f compose.production.yaml run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
unset ADMIN_DEFAULT_USERNAME ADMIN_DEFAULT_PASSWORD
```

该命令只创建账号，同名账号已存在时拒绝覆盖。完成后打开 `https://<域名>/admin/login` 登录，在站点设置里维护资料，再开始写作。忘记密码时见[重置管理员密码](deployment.md#重置管理员密码)。

## 5. 上线检查清单

- [ ] **HTTPS 正常**：下面的命令不加 `-k` 也能成功，响应头里有 `x-tixxin-release: 0.2.0`。浏览器访问首页和 `/admin/login` 没有证书警告。

  ```sh
  curl -I --max-time 15 "$origin/"
  curl -i --max-time 15 "$origin/api/v1/posts?pageSize=1"
  ```

- [ ] **了解 HSTS**：Caddy 模板发送 `Strict-Transport-Security: max-age=86400`（不含子域和 preload）。浏览器收到后一天内只用 HTTPS 访问本站，证书出错时无法临时退回 HTTP。先观察证书自动续期，稳定一两周后再按[运行观察](deployment.md#可选-worker-与运行观察)在 `deploy/Caddyfile` 中加长期限。
- [ ] **`/ready` 健康检查**：API 不发布宿主端口，它的容器健康检查请求的就是 `/ready`。`backend` 显示 `healthy` 即表示探针通过，也可以在容器内直接请求，输出 `200`。公开域名下的 `/ready` 不等同于后端探针。

  ```sh
  docker compose --env-file "$release_env" -f compose.production.yaml ps -a
  docker compose --env-file "$release_env" -f compose.production.yaml exec backend node -e "fetch('http://127.0.0.1:3000/ready').then((r) => console.log(r.status))"
  ```

- [ ] **访客限流按真实 IP 计数**：两个 `*_TRUSTED_PROXY_CIDRS` 未设置或为空时，缺省信任本项目固定的内部网络子网（`TIXXIN_NETWORK_SUBNET`，缺省 `172.31.250.0/24`），无需手工查子网。若仍填着旧版查得的 `<RELEASE_PROJECT>_default` 子网，新容器不在该网段，所有访客会按 Caddy 的地址共享一份读取额度（每分钟 120 次公开读取），清空这两项后重建前端和 API 即可。不要填 `0.0.0.0/0` 或笼统的全部私网；Caddy 前另有 CDN 时先按[可信代理](deployment.md#可信代理读取配额与媒体缓存)核对拓扑。

  ```sh
  docker compose --env-file "$release_env" -f compose.production.yaml up -d --no-deps --no-build --pull never --wait backend frontend
  ```

- [ ] **备份**：写下第一篇内容后，在 `/admin/maintenance` 下载附带受管图片的内容包，作为最低限度的备份。升级前需要一份已校验的完整备份（数据库加媒体），定时完整备份要单独启用 worker，见[自动完整备份](operations.md#自动完整备份)和[备份与恢复](backup-and-recovery.md)。同时保存好环境文件。任何时候都不要用 `docker compose down -v` 处理故障，它会删除数据卷。

## 升级与回滚

- 升级：先做完整备份，拉取新版本的四个镜像，检出对应标签，再用 `--backup-directory` 运行发布脚本，见[已有站点发布](deployment.md#已有站点发布)。
- 回滚：确认旧版本兼容当前数据库后，用 `--action rollback --database-compatible` 只切换应用镜像，不回退数据，见[应用回退与数据恢复](deployment.md#应用回退与数据恢复)。

## 常见问题

**证书无法签发或浏览器提示证书错误。** 先核对 DNS 已指向本机、`SITE_HOST`/`SITE_URL` 与访问域名一致、`HTTPS_BIND_ADDRESS` 不是 `127.0.0.1`、防火墙放行 80/443，再查看 `edge` 日志。不要删除证书卷反复申请。详见[HTTPS 证书错误或无法签发](troubleshooting.md#https-证书错误或无法签发)。

```sh
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge
```

**发布脚本提示「镜像未在本机就绪」。** 六个镜像（四个应用镜像和 `postgres:16-alpine`、`caddy:2-alpine`）都要先 `docker pull`，且环境文件里的镜像仓库和 `--version` 与拉取的标签一致。GHCR 包为私有时（例如自己的 fork），先用具有 `read:packages` 权限的令牌执行 `docker login ghcr.io`。

**页面或 `/api/v1` 返回 502。** 依次看 `edge`、`frontend`、`backend` 的日志和健康状态；`backend` 不是 `healthy` 时先查数据库连接错误，不要只重启前端。详见[SSR 页面或同源 API 返回 502](troubleshooting.md#ssr-页面或同源-api-返回-502)。

```sh
docker compose --env-file "$release_env" -f compose.production.yaml logs --tail=100 edge frontend backend
```

**多个访客频繁收到 429。** 通常是没有配置可信代理，所有访客共享同一份额度，按上线检查清单中的步骤配置。详见[请求返回 429](troubleshooting.md#请求返回-429)。

**修好证书后浏览器仍强制 HTTPS 或报错。** 这是 HSTS 的正常行为，只能先修复 HTTPS；改为 HTTP 或删掉响应头都不能清除浏览器已保存的策略。详见[HSTS 导致浏览器强制 HTTPS](troubleshooting.md#hsts-导致浏览器强制-https)。
