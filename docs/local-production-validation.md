# 本地生产式部署与验收

运行基线：Node 24、pnpm 9.15.0（推荐 `corepack pnpm`）、Docker。

## 独立编排

在仓库根创建不提交的 `.env.production.local`，填写下面变量。数据库密码建议使用随机十六进制字符串，避免连接 URL 的保留字符需要编码。

```dotenv
POSTGRES_PASSWORD=<随机数据库密码>
JWT_ACCESS_SECRET=<至少32位随机签名密钥>
SITE_URL=http://localhost:3457
WEB_PORT=3457
```

```sh
docker compose --env-file .env.production.local up --build -d
docker compose --env-file .env.production.local ps
```

此编排使用独立 `blog-data` 卷，不复用开发数据库。先启动 PostgreSQL，迁移成功后才启动后端，后端就绪后启动前端。访问 `http://localhost:3457`。生产需由 HTTPS 反向代理提供浏览器入口，并将 `SITE_URL` 设置为该入口地址；刷新 Cookie 带 Secure 属性。

## 初始化管理员

先在当前终端环境设置 `ADMIN_DEFAULT_USERNAME` 与至少 12 位随机 `ADMIN_DEFAULT_PASSWORD`，不要在命令参数或聊天中填写密码。运行：

```sh
docker compose --env-file .env.production.local run --rm --no-deps -e ADMIN_DEFAULT_USERNAME -e ADMIN_DEFAULT_PASSWORD backend node dist/admin-bootstrap.js
```

此命令只创建账号，不插入演示文章；同名账号已存在时拒绝覆盖。创建后从终端环境移除密码，访问 `/admin/login` 登录。开发用 `seed:dev` 会插入演示文章与闪念，不用于生产初始化。

## 自动验收

```sh
docker build -t tixxin-blog-web:remediation .
docker build -f src/backend/server-main/Dockerfile -t tixxin-blog-api:remediation .
docker build -f src/backend/server-main/Dockerfile --target migration -t tixxin-blog-migration:remediation .
node scripts/container-smoke.mjs
```

验收脚本创建独立网络、随机凭据和临时数据卷，验证非 root、秘密隔离、迁移、认证、同源网关、CSP、公开路由和数据库故障恢复；结束后只清理本次创建的资源。生产数据不参与测试。

浏览器回归使用 `corepack pnpm test:e2e`，要求本机 PostgreSQL 可连接且当前数据库用户有创建临时数据库权限。测试不会重置开发库。`corepack pnpm --filter server-main test:integration` 验证真实 HTTP、并发和迁移计数校正。


## 媒体存储

开发后端默认使用 `./var/media`（相对后端工作目录），可通过 `MEDIA_DIRECTORY` 指定独立绝对路径。目录已排除 Git 和 Docker 构建上下文。更换存储目录需重启后端，并先复制原有文件；数据库记录不会自动迁移文件。

生产 compose 将 `media-data` 卷挂载到 `/app/var/media`，运行用户为 node。不要通过 `down -v` 删除持久化卷。数据库和媒体目录需要一并备份；数据库备份不能代替图片文件备份。

存储逻辑通过 MediaStorage 接口与业务解耦，当前提供本地目录实现，不依赖付费服务。上传资源会转换为 WebP，原始上传文件不会保存到媒体目录；本机原文件不受影响。

容器 smoke 增加真实图片上传、Linux 解码、非 root 文件所有权和移除/重建后端容器后仍能读取媒体的检查。验收只操作专用临时网络和卷。
