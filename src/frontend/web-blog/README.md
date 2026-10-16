# web-blog

TixXinBlog 的 Nuxt 4 / Vue 3 / TypeScript 前端，同时承载公开网站和 `/admin` 后台，没有独立的后台应用。首次安装、数据库和账号准备见[根 README](../../../README.md)。

## 目录职责

| 目录                              | 用途                                   |
| --------------------------------- | -------------------------------------- |
| `app/pages`、`app/layouts`        | 路由、页面组织与布局                   |
| `app/components`                  | 按领域组织的展示组件和编辑界面         |
| `app/features`、`app/composables` | 领域契约、查询/编辑工具与复用状态      |
| `themes`、`theme-contracts`       | Nexus、Aurora、Dock 的布局实现与契约   |
| `server`                          | 同源 API 网关、订阅与 sitemap 数据入口 |
| `tests`                           | Vitest 与 Playwright 回归源码          |

架构约定见[架构文档](../../../docs/architecture.md)，主题开发见[主题指南](../../../docs/themes.md)。

## 接口与配置

本地配置使用本目录的 [.env.example](.env.example)，复制到 `.env` 后按需修改，保留已有配置。

- 浏览器访问 `NUXT_PUBLIC_API_BASE_URL=/api/v1`。
- Nuxt 服务端通过 `NUXT_API_BASE_URL` 连接 API；本机模板指向 `http://127.0.0.1:3457/api/v1`。
- `NUXT_PUBLIC_SITE_URL` 用于订阅、canonical 和 sitemap，应与实际访问地址一致。
- 文章和闪念只有显式启用 Mock 开关才使用演示仓库；真实 API 失败不会回退样本。书签明确使用 LocalStorage。

环境配置修改后重启服务；后台站点资料属于数据库内容，保存后由页面重新读取。详见[开发指南](../../../docs/development.md)和[内容管理](../../../docs/content.md)。

## 静态素材来源

`public/` 下的素材不含任何真实人物身份，fork 后可直接替换为自己的资源。

| 文件                | 来源                                                                                                                                            | 用途                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `avatar-photo.webp` | 由种子素材 `gallery-assets/portrait.webp`（[Unsplash 人像](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d)）裁剪为 200 × 200 WebP | 演示数据中的博主头像           |
| `avatar.svg`        | 本仓库绘制的中性头像                                                                                                                            | 站点资料未设置头像时的默认占位 |

按 [Unsplash License](https://unsplash.com/license) 使用。博主本人的头像属于数据库内容，在 `/admin/site` 上传后由受管媒体提供，不进入仓库。

## 命令

从仓库根目录执行：

```sh
corepack pnpm dev:all
corepack pnpm dev:blog
corepack pnpm lint
corepack pnpm --filter web-blog exec nuxt typecheck
corepack pnpm --filter web-blog test
corepack pnpm build
corepack pnpm preview
```

`dev:all` 启动或复用前后端；`dev:blog` 只启动前端，真实模式仍需可用 API。开发地址为 `http://localhost:3456`。开发中间目录是 `.nuxt`，生产构建使用 `.nuxt-production`，输出为 `.output`。

浏览器回归使用根目录 `test:e2e` / `test:e2e:run` 隔离 runner，运行前按[贡献指南](../../../CONTRIBUTING.md)准备依赖。部署和运行时地址配置见[部署指南](../../../docs/deployment.md)。
