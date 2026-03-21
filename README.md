# TixXinBlog

个人博客系统。前台基于 Nuxt 4 + Vue 3，支持文章、归档、画廊、留言板、友链等模块，当前处于 UI 打磨阶段，使用 mock 数据驱动。

**在线预览**：[https://tix.xin](https://tix.xin)

## 技术栈

- **前端**：Nuxt 4、Vue 3、TypeScript、SCSS
- **图标**：@nuxt/icon + Lucide
- **主题**：@nuxtjs/color-mode

## 快速开始

```bash
cd src/frontend/web-blog
pnpm install
pnpm dev
```

访问 http://localhost:3456 查看本地效果。

## 项目结构

```
src/
├── frontend/web-blog/    # 博客前台
└── backend/              # 后端（规划中）
docs/                     # 架构与目录说明
```

详见 [project-architecture.md](docs/project-architecture.md) 与 [directory-structure.md](docs/directory-structure.md)。

## 开源协议

[GPL-3.0](LICENSE)
