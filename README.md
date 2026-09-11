# TixXinBlog

面向单博主持续写作与维护的个人博客系统。Nuxt 4 同时提供公开网站和 `/admin` 后台，NestJS + PostgreSQL 保存文章、评论、闪念、朋友圈、留言、图库、项目、友链、站点资料及运行记录。当前能力、使用入口和维护契约从[文档导航](docs/README.md)与[能力清单](docs/capability-map.md)进入。

书签仍保存在当前浏览器 LocalStorage，友链公开申请和访客邮件订阅尚未开放。开发样本与用户真实内容分开管理；部署配置可执行，不代表已完成生产部署、真实邮件/异地上传或长期任务启用。

<p align="center">
  <img alt="Nuxt 4" src="https://img.shields.io/badge/Nuxt_4-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="SCSS" src="https://img.shields.io/badge/SCSS-CC6699?style=for-the-badge&logo=sass&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
  <img alt="ESLint" src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" />
  <img alt="Prettier" src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black" />
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" />
  <img alt="Node" src="https://img.shields.io/badge/Node-24-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-9.15.0-F69220?style=flat-square&logo=pnpm&logoColor=white" />
  <a href="https://tix.xin"><img alt="项目关联站点" src="https://img.shields.io/badge/项目站点-tix.xin-brightgreen?style=flat-square" /></a>
</p>

![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/01.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/02.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/03.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/04.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/05.png?raw=true)

项目关联站点：[tix.xin](https://tix.xin)。以上为既有界面素材；未据此核实该站点当前运行的提交或宣称本轮版本已对外部署。

## 当前使用入口

| 用途       | 入口与能力                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 写作与阅读 | `/`、`/archive`、`/articles/:id`；文章历史地址兼容、正文检索、相关文章、RSS 与 sitemap                                                            |
| 跨内容发现 | `/search` 和站内搜索弹窗；文章、项目、友链、图库、闪念、朋友圈六类公开内容，分组、筛选和分页                                                      |
| 个人资料   | `/about`；姓名、简介、联系方式复用站点资料，详细介绍与可选栏目由 `/admin/site` 维护，未填写或隐藏资料不公开                                       |
| 日常运营   | `/admin`；六类内容草稿、五类真实互动待办、最近编辑、快捷创作、通知与维护摘要                                                                      |
| 创作与素材 | `/admin/posts`、`/admin/projects`、`/admin/gallery`、`/admin/media`；长文章章节定位、有序内容关联、素材说明/替代文本、构图/使用状态筛选及引用跳转 |
| 互动处理   | `/admin/comments`、`/admin/moment-comments`、`/admin/guestbook`；审核/回复规则以各域真实能力为准；`/admin/notifications` 单独维护已读状态         |
| 运行与维护 | `/admin/operations`、`/admin/maintenance`；持久任务、备份与投递结果、内容包预览迁入及运行诊断                                                     |

内容包当前导出 **v9**，兼容 v1–v8；涵盖关于资料、媒体说明以及文章/项目/图库的编号映射关联。完整备份另外保存数据库历史、身份与运行数据；恢复后撤销旧授权、轮换内容上下文并暂停外部投递。具体操作见[备份与恢复](docs/backup-and-recovery.md)、[运营工作台](docs/operations-workbench.md)和[运行任务与通知](docs/operations-and-notifications.md)。

## 技术栈

- **前端**：Nuxt 4、Vue 3、TypeScript、SCSS
- **后端**：NestJS 11、MikroORM 6、PostgreSQL 16
- **图标**：@nuxt/icon + Lucide
- **主题引擎**：@tixxin/nuxt-theme-engine
- **色彩模式**：@nuxtjs/color-mode
- **字体**：@nuxt/fonts (Inter)
- **图片**：@nuxt/image
- **SEO**：@nuxtjs/sitemap、@nuxtjs/robots、JSON-LD
- **代码规范**：@nuxt/eslint、Prettier、Husky + lint-staged
- **测试**：Vitest + @nuxt/test-utils、Jest、隔离 HTTP/Playwright 与容器验收
- **运行**：Docker Compose、独立迁移与可选任务 worker、Caddy HTTPS 入口；GitHub Actions 执行 CI 检查

## 环境要求

- Node.js >= 24 < 25
- pnpm 9.15.0（推荐 `corepack pnpm`）

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog

# 安装依赖
corepack pnpm install

# 数据库、迁移和环境变量准备好后，统一启动或复用服务
corepack pnpm dev:all
```

首次启动前按[后端说明](src/backend/server-main/README.md)准备数据库、配置并显式执行迁移，前端环境模板见 `src/frontend/web-blog/.env.example`。已有环境文件、数据库、账号与媒体应保留。`dev:all` 启动或复用本项目已有服务；访问 [本地网站](http://localhost:3456) 和 [运营工作台](http://localhost:3456/admin)。启动不会执行迁移、seed、reset 或对外发送。

`dev:check` 检查当前链路，`dev:all` 统一启动；`dev` / `dev:blog` 仅启动前端，`dev:api` 仅启动后端。配置、进程归属和清理规则见[开发启动说明](docs/development-runtime.md)。多个栏目同时加载失败时，也可按[服务恢复记录](docs/service-recovery.md)检查后端就绪与前端同源接口。

## 构建与部署

```bash
# 生产构建：前端与后端分别准备
corepack pnpm build
corepack pnpm --filter server-main build

# 本地预览生产构建
corepack pnpm --filter web-blog preview
```

`compose.yaml` 用于独立本地生产式编排；`compose.production.yaml`、`deploy/` 和 `scripts/release/release.mjs` 提供固定镜像版本、HTTPS、日志/重启、发布预检及版本切换。后端 Dockerfile 分为 `runtime`、`migration` 和 `worker` 目标。发布脚本默认预览，`--apply` 才执行；应用回退、数据库向前修复与备份恢复分别处理。使用步骤见[发布与回退](docs/release-operations.md)和[本地生产式验收](docs/local-production-validation.md)。

邮件与自动备份默认关闭。取得对应授权后，才配置并启用 worker、真实收件目标或异地接收器；本机隔离验收通过不等于已经投产。

## 环境变量

开发环境分服务配置：前端参考 [前端模板](src/frontend/web-blog/.env.example)，配置放在该目录 `.env`；后端参考 [后端模板](src/backend/server-main/.env.example)，配置放在该目录 `.env.local`。已有文件保留并按需补充；环境优先级见[开发启动说明](docs/development-runtime.md)。根目录 `.env.example` 不是统一开发链路的配置来源。

朋友圈阅读入口为 `/moments`，登录后通过 `/admin/moments` 发布、编辑、置顶和管理评论。真实模式不会回退演示数据，使用方式与输入恢复见[朋友圈业务说明](docs/moment-business.md)。`corepack pnpm db:dev status` 可检查数据库，显式开发样本和清空工具见[开发数据库说明](docs/development-database.md)。

留言入口为 `/guestbook`，博主通过 `/admin/guestbook` 回复、审核、置顶和管理内容。日常开发数据检查使用 `corepack pnpm db:dev check-data`，增量补齐预览使用 `corepack pnpm db:dev seed-data --dataset all`；核对目标后加上 `--apply --confirm 数据库名` 执行。新功能必须同批交付日常样本与隔离测试，具体归属、数量及安全清理见[开发数据目录](docs/development-data-catalog.md)。

## 代码规范

```bash
# ESLint 检查
corepack pnpm lint

# ESLint 自动修复
corepack pnpm lint:fix

# Prettier 格式化
corepack pnpm format
```

提交代码时 Husky + lint-staged 会自动运行检查。

## 测试

```bash
corepack pnpm --filter web-blog test
corepack pnpm --filter server-main test
corepack pnpm --filter server-main typecheck
corepack pnpm --filter server-main test:integration

# 已准备前后端生产构建后，按 spec 启动隔离浏览器验收
node src/backend/server-main/tests/browser-runner.mjs sustainable-admin.spec.ts --browser=all --max-failures=1
```

测试写入、故障注入、投递和恢复使用隔离数据库、媒体、账号与本机捕获服务；原始产物只留在 `.artifacts/` 或 `.playwright-mcp/`。验证边界见[验收产物管理](docs/verification-artifacts.md)。已实施的性能改进为公开文章列表按需取字段，测试保持正文检索与最终业务响应不变，复核方法见[性能与维护](docs/performance-maintenance.md)，不以局部采样推断线上性能。

## 项目结构

```
src/
├── frontend/web-blog/    # 公开网站与内置 /admin 后台
└── backend/server-main/  # NestJS API、数据库迁移和维护工具
docs/                     # 架构与目录说明
```

当前没有独立的 `web-admin` 应用。模块职责与代码入口见[架构基线](docs/project-architecture.md)、[目录地图](docs/directory-structure.md)；早期规划与历史交付单独收录在[文档导航](docs/README.md)，不作为当前能力声明。

## 开源协议

本项目采用 [GPL-3.0](LICENSE) 协议。

### 第三方许可

本项目使用的 [@tixxin/nuxt-theme-engine](https://github.com/TixXin/nuxt-theme-engine) 主题引擎采用 [MIT License](https://github.com/TixXin/nuxt-theme-engine/LICENSE) 许可。
