# TixXinBlog

个人博客系统。前台基于 Nuxt 4 + Vue 3，支持文章、归档、画廊、留言板、友链等模块，当前处于 UI 打磨阶段，使用 mock 数据驱动。

![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/01.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/02.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/03.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/04.png?raw=true)
![image](https://github.com/TixXin/TixXinBlog/blob/main/docs/img/05.png?raw=true)

**在线预览**：[https://tix.xin](https://tix.xin)

## 技术栈

- **前端**：Nuxt 4、Vue 3、TypeScript、SCSS
- **图标**：@nuxt/icon + Lucide
- **主题引擎**：@tixxin/nuxt-theme-engine
- **色彩模式**：@nuxtjs/color-mode
- **字体**：@nuxt/fonts (Inter)
- **图片**：@nuxt/image
- **SEO**：@nuxtjs/sitemap、@nuxtjs/robots、JSON-LD
- **代码规范**：@nuxt/eslint、Prettier、Husky + lint-staged
- **测试**：Vitest + @nuxt/test-utils
- **CI/CD**：GitHub Actions

## 环境要求

- Node.js >= 20
- pnpm >= 9

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/TixXin/TixXinBlog.git
cd TixXinBlog

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3456 查看本地效果。

## 构建与部署

```bash
# 生产构建
pnpm build

# 本地预览生产构建
pnpm --filter web-blog preview

# Docker 构建
docker build -t tixxin-blog .
docker run -p 3000:3000 tixxin-blog
```

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

```bash
cp .env.example .env
```

详见 [.env.example](.env.example)。

## 代码规范

```bash
# ESLint 检查
pnpm lint

# ESLint 自动修复
pnpm lint:fix

# Prettier 格式化
pnpm format
```

提交代码时 Husky + lint-staged 会自动运行检查。

## 测试

```bash
pnpm --filter web-blog test
```

## 项目结构

```
src/
├── frontend/web-blog/    # 博客前台
└── backend/              # 后端（规划中）
docs/                     # 架构与目录说明
```

详见 [project-architecture.md](docs/project-architecture.md) 与 [directory-structure.md](docs/directory-structure.md)。

## 开源协议

本项目采用 [GPL-3.0](LICENSE) 协议。

### 第三方许可

本项目使用的 [@tixxin/nuxt-theme-engine](https://github.com/TixXin/nuxt-theme-engine) 主题引擎采用 [MIT License](https://github.com/TixXin/nuxt-theme-engine/LICENSE) 许可。
