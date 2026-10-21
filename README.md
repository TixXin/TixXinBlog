<div align="center">

<img src="src/frontend/web-blog/public/icon.svg" width="88" alt="TixXinBlog 标志">

# TixXinBlog

**为一个人写的博客系统**

公开站点与创作后台合在一处 · 三套主题与明暗配色 · 一条命令部署到自己的服务器

[![CI](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml/badge.svg)](https://github.com/TixXin/TixXinBlog/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/TixXin/TixXinBlog?color=4f46e5)](https://github.com/TixXin/TixXinBlog/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt&logoColor=white)](https://nuxt.com/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[作者博客](https://tix.xin) · [5 分钟部署](docs/quick-start.md) · [文档](docs/README.md) · [更新日志](CHANGELOG.md) · [English](README.en.md)

</div>

<p align="center">
  <img src="docs/assets/screenshots/nexus-home.jpg" alt="默认主题 Nexus 的首页，左上为浅色、右下为深色" width="100%">
</p>
<p align="center">
  <img src="docs/assets/screenshots/nexus-moments.jpg" alt="朋友圈页面，左上为浅色、右下为深色" width="100%">
</p>
<p align="center"><sub>默认主题 Nexus 的首页与朋友圈，2560×1440 屏幕，左上浅色、右下深色，使用仓库自带的演示数据</sub></p>

## 特性

| 领域     | 能力                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| **写作** | Markdown 与版本历史、草稿预览分享、发布前检查、粘贴上传图片、长文章节定位                      |
| **内容** | 文章、闪念、朋友圈、留言板、图库、图片提示词、项目、友链、平台订阅费，内容之间可互相关联       |
| **阅读** | 全站搜索、标签与专栏、归档、相关文章、代码高亮、图片灯箱、记住阅读位置、RSS / Atom / JSON Feed |
| **外观** | Nexus、Aurora、Dock 三套主题、浅色与深色、动效预设、中英文界面                                 |
| **运营** | 评论与留言审核、站内通知与邮件、媒体库与引用查找、运行状态面板、搜索引擎收录开关               |
| **数据** | 一致快照的完整备份与独立恢复、跨版本内容包迁入、审计记录                                       |
| **部署** | 一条命令安装、浏览器初始化向导、`tixxin` 管理命令、amd64 / arm64 多架构镜像                    |

<details>
<summary><b>更多截图</b></summary>
<br>
<p align="center">
  <img src="docs/assets/screenshots/nexus-article.jpg" alt="文章详情页，左上为浅色、右下为深色" width="74%">
  <img src="docs/assets/screenshots/nexus-mobile.jpg" alt="手机端首页，左上为浅色、右下为深色" width="21%">
</p>
</details>

## 一条命令部署

准备一台 Linux 服务器（amd64 或 arm64），把域名解析到它并开放 80 / 443 端口，然后执行：

```sh
curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
sudo bash install.sh
```

脚本会询问域名和站点语言，自动生成密钥、拉取镜像、迁移数据库并申请 HTTPS 证书，最后打印一条初始化链接，在浏览器打开即可创建博主账号。之后的日常维护：

```sh
sudo tixxin status    # 服务状态、入口验收与新版本提示
sudo tixxin backup    # 完整备份（数据库一致快照与媒体）
sudo tixxin update    # 先完整备份，再升级到最新正式版本
```

> [!TIP]
> 没有服务器也能先在自己电脑上试用（macOS 或 Linux，需要 Docker）：运行 `bash install.sh --local`，完成后访问 `https://localhost:8443`。

前提条件、国内网络、非交互安装与常见问题见 [5 分钟部署](docs/quick-start.md)；需要逐项控制环境变量时，见[部署指南](docs/deployment.md)的手动发布。

## 技术栈

| 层   | 选型                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| 前端 | [Nuxt 4](https://nuxt.com/)、Vue 3、TypeScript、`@nuxtjs/i18n`、Lucide 图标        |
| 后端 | [NestJS 11](https://nestjs.com/)、[MikroORM](https://mikro-orm.io/)、PostgreSQL 16 |
| 部署 | Docker Compose、Caddy（自动 HTTPS）、GHCR 多架构镜像                               |
| 质量 | Vitest、Jest、Playwright（Chromium 全量与 WebKit 核心回归）、axe 可访问性、CodeQL  |

## 本地开发

需要 Node.js 26（`>=26 <27`）、pnpm 9.15.0（经 Corepack 调用）、PostgreSQL 16 和 Docker。

```sh
git clone https://github.com/TixXin/TixXinBlog.git && cd TixXinBlog
npm install --global corepack@0.34.6
corepack pnpm install --frozen-lockfile

# 首次：复制两份本地配置（已有文件不要覆盖）
cp -n src/frontend/web-blog/.env.example src/frontend/web-blog/.env
cp -n src/backend/server-main/.env.example src/backend/server-main/.env.local
# 编辑 .env.local，按下方说明填写签名密钥与博主账号

# 启动数据库，显式迁移并初始化博主账号
docker compose --env-file src/backend/server-main/.env.local \
  -f src/backend/server-main/docker-compose.yml up -d postgres
corepack pnpm --filter server-main migration:up
corepack pnpm --filter server-main build
corepack pnpm --filter server-main exec node dist/admin-bootstrap.js

# 启动前后端：网站 http://localhost:3456，后台 /admin
corepack pnpm dev:all
```

`.env.local` 至少需要设置：

- `JWT_ACCESS_SECRET`：32 字符以上的随机值
- `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD`：博主登录名与密码，密码至少 6 个字符

启动命令不会隐式迁移、写样本或清库。推送前运行 `corepack pnpm check:local`，它会按改动自动挑选对应的 lint、类型检查和单测。完整步骤、开发样本、`dev:setup` 初始化沙盒与 `trial` 本地构建试装，见[本地开发与测试](docs/development.md)。

## 文档

| 文档                                      | 内容                                                       |
| ----------------------------------------- | ---------------------------------------------------------- |
| [5 分钟部署](docs/quick-start.md)         | 一条命令安装、浏览器初始化、本机试用、日常管理与常见问题   |
| [部署与版本切换](docs/deployment.md)      | 两种部署方式、HTTPS、可信代理、升级回退、面板与反向代理    |
| [本地开发与测试](docs/development.md)     | 环境配置、启动与复用、开发样本、初始化预览与沙盒、验证入口 |
| [架构与代码入口](docs/architecture.md)    | 前后端分层、数据与权限边界、持久任务                       |
| [API 契约](docs/api.md)                   | 认证、响应格式、版本与幂等、主要接口                       |
| [主题开发](docs/themes.md)                | 主题契约、宿主能力、切换与动效                             |
| [备份与恢复](docs/backup-and-recovery.md) | 内容包兼容、完整快照、独立恢复                             |

全部文档见[文档导航](docs/README.md)，英文文档见 [docs/en](docs/en/README.md)。

## 参与贡献

欢迎提交 issue 和 PR。开发约定、按改动范围的验证要求与 PR 说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，参与前请先阅读[行为准则](CODE_OF_CONDUCT.md)。项目定位是单博主博客，不计划扩展为多租户或协作平台。

> [!IMPORTANT]
> 安全漏洞请通过仓库的私密漏洞报告渠道提交，不要公开发 issue，详见 [SECURITY.md](SECURITY.md)。

## 许可证

[GNU GPL v3](LICENSE)。[LICENSE_CN](LICENSE_CN) 是同一协议的中文译本，仅供参考，有歧义时以英文原文为准；第三方素材按其随附的来源与许可说明处理。
