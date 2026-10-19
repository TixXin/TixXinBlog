# 5 分钟部署

面向第一次部署的用户：在一台 Linux 服务器上运行一条安装命令，再在浏览器里创建博主账号，就能得到带 HTTPS 的站点。安装脚本使用 GitHub Release 发布的预构建镜像与部署包，不需要克隆仓库，也不需要 Node.js。

一键安装从 **v0.3.0** 起提供；更早的版本没有部署包，只能按[部署与版本切换](deployment.md)中的手动发布流程部署。下文出现的版本号 `0.3.0` 只是示例，实际版本以 [Release 页面](https://github.com/TixXin/TixXinBlog/releases)为准。需要逐项控制环境变量、自行构建镜像或使用 PowerShell 时，同样改看[部署与版本切换](deployment.md)。

## 前提条件

- 一台 amd64 或 arm64 的 Linux 服务器，可以使用 root 或 `sudo`。
- Docker Engine 与 Docker Compose v2 插件（`docker compose`）。可选：没有安装 Docker 时，脚本会询问是否运行 Docker 官方安装脚本（`get.docker.com`）；也可以自己先按 [Docker 文档](https://docs.docker.com/engine/install/)安装。
- 宿主机有 `bash`、`curl`、`tar` 和 `sha256sum`（或 `shasum`），常见发行版默认自带。
- 域名的 A/AAAA 记录已指向这台服务器。
- 公网可以访问服务器的 80 和 443 端口，且没有其他程序占用。云服务器还要在安全组里放行这两个端口。

下文以 `blog.example.com` 为例，请替换为自己的域名。

## 安装

推荐先下载脚本，看过内容后再执行：

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
less install.sh
sudo bash install.sh
```

Release 同时提供 `SHA256SUMS`，可以在执行前核对脚本：

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum --ignore-missing -c SHA256SUMS
```

也可以用管道一步执行：

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh | sudo bash
```

`latest` 指向最新正式版本，下载到的脚本默认安装它所属的那个版本。要固定版本，就从对应标签下载脚本，例如 `https://github.com/TixXin/TixXinBlog/releases/download/v0.3.0/install.sh`。

### 脚本会问什么

| 问题                         | 说明                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| 是否运行 Docker 官方安装脚本 | 只在未检测到 Docker 时询问，默认不安装                        |
| 站点域名                     | 如 `blog.example.com`，不含协议和路径                         |
| 站点语言                     | `1` 为中文 `zh-CN`（默认），`2` 为 English `en`               |
| 安装目录                     | 默认 `/opt/tixxin-blog`；普通用户本机试用默认 `~/tixxin-blog` |
| 确认开始安装                 | 显示版本、架构、目录、站点地址和语言，输入 `y` 才继续         |

通过管道运行时，问题从终端（`/dev/tty`）读取，照常回答即可。没有交互终端时请改用[非交互安装](#非交互安装)。

### 脚本会做什么

1. 预检：CPU 架构、root 权限、所需命令、Docker 与 Compose v2；核对域名解析是否指向本机网卡地址（只做提示，不阻止安装）。
2. 拒绝覆盖已有站点：安装目录非空、已有 `.env`，或同名 Compose 项目已有容器与数据卷时直接退出，并提示改用 `tixxin update`。
3. 检查 80 和 443 端口是否空闲。
4. 下载部署包 `tixxin-blog-<版本>.tar.gz` 与 `SHA256SUMS`，校验通过后才解压。
5. 写入安装目录，随机生成数据库密码、签名密钥和一次性初始化令牌，保存到 `<安装目录>/.env`（权限 600）。
6. 创建管理命令 `/usr/local/bin/tixxin`，指向 `<安装目录>/deploy/tixxin`；该位置已有其他文件时不覆盖，改用完整路径。
7. 拉取镜像、启动数据库、执行正式迁移、启动 API、前端与 Caddy，再通过真实 HTTPS 地址验收同源 API 与版本头。
8. 打印站点地址、版本、安装目录和初始化链接；安装日志写入 `<安装目录>/logs/`。

### 脚本不会做什么

- 不收集、不上报任何信息。除了下载部署包所需的 GitHub Release、拉取镜像所需的镜像仓库，以及你同意安装 Docker 时的 `get.docker.com`，不访问其他服务。核对域名解析默认只比对本机网卡地址；只有显式传入 `--check-public-ip` 时，才会访问所填地址获取出口 IP，这会把本机 IP 暴露给该服务。
- 不覆盖已有站点，不执行 `docker compose down -v`，不删除数据卷。安装失败时保留安装目录、容器与数据卷，并打印排查命令。
- 不写入开发样本，新站点没有任何文章；不启动 worker，SMTP 与自动备份保持关闭。

站点上线后，Caddy 会自行向证书颁发机构申请和续期 HTTPS 证书，这属于站点运行，不是安装脚本的行为。

## 初始化

安装完成时会打印一条初始化链接：

```text
https://blog.example.com/setup?token=…
```

在浏览器中打开它，设置登录名、密码（12–128 个字符）、站点名称和站点语言，即可创建博主账号，随后跳转到 `/admin/login` 登录。

- 令牌只能成功使用一次：账号创建后向导与接口永久关闭，再次打开链接或提交都会失败，令牌即使泄露也无法再用。
- 页面读取令牌后会立即从地址栏移除；提交受限流保护（每个地址每 10 分钟 5 次）。
- 链接丢失时见[初始化链接丢失](#初始化链接丢失)。

## 本机试用

没有服务器和域名时，可以在自己的电脑上体验（macOS 使用 Docker Desktop，Linux 使用 Docker Engine；暂不支持 Windows，脚本在 Git Bash 等环境下会直接退出）。本机试用不需要 root，普通用户默认装到 `~/tixxin-blog`：

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
bash install.sh --local --dir "$HOME/tixxin-blog"
```

- 站点固定为 `localhost`，地址为 `https://localhost:8443`，`http://localhost:8080` 会跳转到 HTTPS。两个端口只监听本机 `127.0.0.1`，被占用时用 `--http-port`、`--https-port` 改用其他端口。
- 证书由 Caddy 内部 CA 签发，不申请公网证书，也不发送 HSTS。安装脚本把根证书导出为 `<安装目录>/local-ca.crt`，自己验收时用它校验 HTTPS，不跳过证书验证。
- 浏览器首次访问会提示证书不受信任。可以确认提示后继续访问；也可以把 `local-ca.crt` 导入系统或浏览器的证书信任设置后再访问，结束试用后记得移除。macOS 可以执行：

  ```sh
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$HOME/tixxin-blog/local-ca.crt"
  ```

- 不以 root 运行时不会创建 `/usr/local/bin/tixxin`，管理命令使用完整路径，例如 `"$HOME/tixxin-blog/deploy/tixxin" status`。
- 停止试用时在安装目录执行 `docker compose stop`，数据卷保留。确认不再需要试用数据时，才在**试用目录**执行 `docker compose down -v` 删除它的容器与数据卷；不要在正式站点目录这样做。

## 日常管理

正式安装的 `.env` 只有 root 可读，管理命令需要 `sudo`。每个子命令都支持 `--help`；`update`、`rollback`、`reset-password` 会二次确认，追加 `--yes` 跳过确认。

```sh
sudo tixxin status
sudo tixxin logs backend --tail 100
sudo tixxin logs edge -f
sudo tixxin backup
sudo tixxin update
sudo tixxin rollback 0.3.0 --database-compatible
sudo tixxin restart
sudo tixxin reset-password
sudo tixxin help
```

| 命令                                    | 作用                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                | 显示安装目录、项目名、当前版本、站点地址与各服务状态，并做一次入口验收                                                                                      |
| `logs`                                  | 查看日志，默认最近 200 行，`-f` 持续输出；服务为 `postgres`、`backend`、`frontend`、`edge`、`worker`、`migration`                                           |
| `backup`                                | 在 worker 镜像内创建并校验完整备份（数据库一致快照与登记媒体），导出到 `<安装目录>/backups`，数据卷中保留同一份；备份含私人草稿与密码哈希，请转存到受控位置 |
| `update [版本]`                         | 先完整备份，再下载校验新部署包、拉取镜像、停止写入、迁移、重建服务并验收；不写版本时使用最新正式版本，写当前版本可用于修复配置或重建容器                    |
| `rollback <版本> --database-compatible` | 应用回退：先完整备份，再切回指定旧版本的镜像与编排，不执行迁移，保留数据卷；`--database-compatible` 表示你已确认该版本兼容当前数据库                        |
| `restart`                               | 重启 API、前端、入口（以及运行中的 worker），并等待健康检查                                                                                                 |
| `reset-password`                        | 在终端隐藏输入两次新密码（至少 12 位），撤销该管理员的全部登录会话；存在多个管理员时用 `--user <登录名>` 指定                                               |

示例中的 `0.3.0` 请换成实际要回退到的版本。升级或回退失败时，命令保留现场，并打印失败阶段、排查命令和对应的回退命令。应用回退不能代替数据恢复，需要回到备份时刻的数据时见[备份与恢复](backup-and-recovery.md)。任何子命令都不会执行 `docker compose down -v`。

定时完整备份需要单独启用 worker，见[自动完整备份](operations.md#自动完整备份)。

## 国内网络

服务器访问 GitHub 或 GHCR 很慢甚至无法访问时，可以把部署包和镜像换成自己准备的来源：

```sh
sudo bash install.sh --version 0.3.0 --download-base https://mirror.example.com/tixxin-blog --registry registry.example.com/tixxin/tixxinblog
```

- `--download-base`：替换部署包下载源，只接受 `https://` 或 `file://`。脚本从 `<地址>/v<版本>/` 下载 `tixxin-blog-<版本>.tar.gz` 与 `SHA256SUMS`，照常校验 SHA256。把 Release 中这两个文件按此目录结构同步到自己的源即可；`install.sh` 本身也要从你能访问的位置取得。
- `--registry`：替换四个应用镜像的前缀 `ghcr.io/tixxin/tixxinblog`，镜像名变为 `<前缀>-web`、`<前缀>-api`、`<前缀>-migration`、`<前缀>-worker`，标签仍为版本号。需要事先把 GHCR 上对应版本的四个镜像同步到该仓库。
- PostgreSQL 与 Caddy 两个依赖镜像（`.env` 中的 `POSTGRES_IMAGE`、`CADDY_IMAGE`，默认 `postgres:16-alpine`、`caddy:2-alpine`）来自 Docker Hub，不受 `--registry` 影响。需要加速时，请为 Docker 守护进程配置自己选定的镜像加速源，或预先导入全部六个镜像后使用 `--no-pull`。
- 使用 `--download-base` 时请同时用 `--version` 写明版本。两个地址都会写入 `.env`，之后 `tixxin update` 沿用它们；自定义下载源时升级也要写明版本，例如 `sudo tixxin update 0.3.0`。
- 镜像加速源或镜像同步需要自行准备并确认可信，本文档不推荐、脚本也不内置任何第三方站点。部署包始终按 `SHA256SUMS` 校验，但两者来自同一来源，来源本身必须可信。
- 中国大陆的服务器用域名对外提供网站，通常需要先完成 ICP 备案，否则 80/443 访问可能被服务商拦截，证书也无法签发。

## 非交互安装

用 `--yes` 跳过所有询问，未给出的参数取默认值；正式安装必须同时给出 `--domain`：

```sh
sudo bash install.sh --yes --domain blog.example.com --locale en --dir /opt/tixxin-blog
```

| 参数                    | 说明                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `--yes`                 | 不询问，使用参数与默认值                                                          |
| `--domain 域名`         | 站点域名                                                                          |
| `--locale zh-CN\|en`    | 站点默认语言，默认 `zh-CN`                                                        |
| `--dir 目录`            | 安装目录，默认 `/opt/tixxin-blog`；普通用户使用 `--local` 时默认 `~/tixxin-blog`  |
| `--version 版本`        | 安装的固定版本，默认为脚本所属的发布版本                                          |
| `--registry 前缀`       | 替换应用镜像前缀，见[国内网络](#国内网络)                                         |
| `--download-base 地址`  | 替换部署包下载源，见[国内网络](#国内网络)                                         |
| `--local`               | 本机试用模式                                                                      |
| `--http-port 端口`      | 宿主机 HTTP 端口（正式默认 80，本机试用默认 8080）                                |
| `--https-port 端口`     | 宿主机 HTTPS 端口（本机试用默认 8443）；正式安装必须为 443                        |
| `--project 名称`        | Compose 项目名，默认 `tixxin-production`，决定数据卷名称，安装后不可更改          |
| `--subnet CIDR`         | 内部网络子网，缺省 `172.31.250.0/24`；同机运行多套站点时各用一段                  |
| `--check-public-ip URL` | 额外访问该 https 地址获取出口 IP 核对域名解析；默认关闭，会把本机 IP 暴露给该服务 |
| `--no-pull`             | 使用本机已有镜像，不拉取                                                          |
| `--install-docker`      | 未安装 Docker 时直接运行 Docker 官方安装脚本，不再询问                            |

非交互模式下缺少 Docker 时不会自动安装，需要同时传入 `--install-docker`。完整用法以 `bash install.sh --help` 的输出为准。

## 安全须知

- **妥善保管 `.env`**：`<安装目录>/.env` 中有数据库密码、签名密钥和初始化令牌，丢失后无法连接已有数据库、无法恢复站点。另存一份到受控位置，不要提交到 Git 或发给他人。
- **初始化链接不要外泄**：创建博主账号之前，拿到链接的人都能抢先创建账号。保留链接期间不要截图、转发或粘贴到公开位置；安装日志 `<安装目录>/logs/install-*.log` 也记录了这条链接（仅 root 可读）。账号创建后令牌失效。
- **了解 HSTS**：Caddy 模板发送 `Strict-Transport-Security: max-age=86400`（不含子域和 preload）。浏览器收到后一天内只用 HTTPS 访问本站，证书出错时无法临时退回 HTTP。先观察证书自动续期，稳定一两周后再按[运行观察](deployment.md#可选-worker-与运行观察)在 `deploy/Caddyfile` 中加长期限。
- 任何时候都不要用 `docker compose down -v` 处理故障，它会删除数据卷。

## 常见问题

### 域名没有解析好

安装时提示域名「当前没有解析记录」或「与本机网卡地址不一致」，说明域名还没指向这台服务器（使用 CDN 或代理时后者可以忽略）。脚本只提示不阻止，但证书签发需要域名解析到本机。服务器在 NAT 之后、网卡上没有公网地址时脚本无法确认，请按云服务商控制台显示的公网 IP 自行核对。

修好 DNS 并等待生效后，Caddy 会自动重试签发，用 `sudo tixxin status` 复查。若安装停在验收阶段，修复后按安装输出的提示执行同版本升级继续（`0.3.0` 换成安装时的版本）：

```sh
sudo tixxin update 0.3.0
```

### 端口被占用

安装提示「端口 80 已被占用」或「端口 443 已被占用」时，先找出占用者并停止它，再重新运行安装：

```sh
sudo ss -ltnp '( sport = :80 or sport = :443 )'
```

正式安装的 HTTPS 端口必须是 443。本机试用可用 `--http-port`、`--https-port` 换端口。

### 证书申请失败

依次核对：DNS 已指向本机，防火墙与安全组放行 80/443，服务器时间正确，国内服务器已备案。再查看入口日志：

```sh
sudo tixxin logs edge --tail 200
```

不要删除证书卷反复申请，频繁失败会触发证书颁发机构的限额。修复后 Caddy 会自动重试，详见[HTTPS 证书错误或无法签发](troubleshooting.md#https-证书错误或无法签发)。

### 内部子网冲突

启动时报 `Pool overlaps with other one on this address space`，说明默认内部子网 `172.31.250.0/24` 与本机已有网络重叠。安装前已知冲突时，换一个未使用的私网段：

```sh
sudo bash install.sh --subnet 172.31.251.0/24
```

安装已因此失败时，安装目录已经写入，重新运行安装会被拒绝；改用同版本升级更换子网。首次安装还没有数据、数据库也启动不了，需要跳过升级前备份：

```sh
sudo tixxin update 0.3.0 --subnet 172.31.251.0/24 --skip-backup
```

已正常运行的站点更换子网时去掉 `--skip-backup`。命令会重建本项目网络，数据卷保留。同一台机器另装一套站点时，同时换用 `--dir`、`--project` 与 `--subnet`。

### 忘记密码

```sh
sudo tixxin reset-password
```

在终端隐藏输入两次新密码，所有已登录设备需要重新登录。存在多个管理员时追加 `--user <登录名>`。

### 初始化链接丢失

初始化令牌保存在 `.env` 的 `SETUP_TOKEN` 中。只要还没有创建管理员，就可以取出令牌，拼成 `https://<域名>/setup?token=<令牌>` 再次打开：

```sh
sudo grep '^SETUP_TOKEN=' /opt/tixxin-blog/.env
```

已经创建过账号时向导不再开放，忘记密码请用 `tixxin reset-password`。

### 提示安装目录或数据卷已存在

脚本不会覆盖已有站点。已有站点请用 `sudo tixxin update` 升级；确实要在同一台机器另装一套，换用 `--dir` 与 `--project`。

更多故障（502、429、迁移、内存）见[常见问题与故障排查](troubleshooting.md)。
