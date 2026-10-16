新年第一篇，写一个我在跨年那几天折腾的东西。起因是公司内部一个组件库的文档站，原来用 Nuxt 搭的，页面全是静态内容，却要加载一整套 Vue 运行时和路由，首页 JS 有 180KB 多。有同事抱怨在公司 VPN 下打开要三四秒。我早就想试 Astro，正好拿这个站练手，用了三天把文档站整体迁了过去。

Astro 5.0 是去年 12 月初发布的，带来了新的 Content Layer 和 Server Islands，我这次用的就是 5.0。下面说说它到底好在哪，以及哪些地方不适合。

## 它的核心想法只有一个

Astro 的默认立场是：网页默认不需要 JavaScript。一个 `.astro` 文件在构建时跑一遍，输出纯 HTML，浏览器拿到的就是 HTML 加 CSS，零 JS。只有当你明确说“这块需要交互”的时候，它才会把那一块对应的框架代码打包进去，这就是所谓的 Islands Architecture：页面是一片静态的海，交互组件是海里的岛。

对比 Nuxt 的思路：Nuxt 默认整页都是应用，SSR 输出 HTML 之后还要在客户端把整棵组件树重新激活，哪怕页面上只有一个按钮需要点击。Nuxt 有办法减轻这件事，但那是“做减法”；Astro 是从零开始“做加法”。对于内容为主的站点，加法的起点显然更合适。

## 组件写法

`.astro` 文件上半部分是一段用 `---` 包起来的服务端代码，下半部分是模板，语法像 JSX 但更宽松，可以直接写 HTML：

```astro
---
// src/components/DocHeader.astro
interface Props {
  title: string
  updated: Date
}
const { title, updated } = Astro.props
const formatted = updated.toLocaleDateString('zh-CN')
---

<header class="doc-header">
  <h1>{title}</h1>
  <p class="meta">最后更新于 {formatted}</p>
</header>

<style>
  .doc-header { border-bottom: 1px solid var(--line); padding-bottom: 1rem; }
  .meta { color: var(--muted); font-size: 0.875rem; }
</style>
```

`<style>` 默认是作用域的，和 Vue 的 scoped 一样。`---` 里的代码只在构建时或者服务端执行，永远不会到浏览器，所以可以放心读文件、查数据库、调内部接口。

## 把 Vue 组件放进岛里

这是我选 Astro 而不是其他静态站生成器的主要原因：它不要求你放弃现有框架。装上 `@astrojs/vue` 之后，原来文档站里的 Vue 组件可以直接拿过来用，只是加载时机要你自己决定：

```astro
---
import ColorPicker from '@/components/ColorPicker.vue'
import LiveDemo from '@/components/LiveDemo.vue'
---

<!-- 页面一加载就激活 -->
<ColorPicker client:load />

<!-- 滚动到可视区域才激活 -->
<LiveDemo client:visible code={demoCode} />
```

`client:load`、`client:idle`、`client:visible`、`client:media` 这几个指令决定了岛什么时候水合。不加指令的 Vue 组件会被当作静态模板渲染成 HTML，不带任何 JS。文档站里大部分组件演示只是展示样子，加 `client:visible` 之后滚到那里才加载，首页完全没有 Vue 运行时。

迁移时我数了一下，原来 46 个 Vue 组件里只有 9 个真的需要交互，其余 37 个全部变成了纯静态输出。这个比例让我有点意外，但想想也合理：文档站的大部分“组件”其实只是带样式的内容块。

## Content Layer：内容就是数据

5.0 的 Content Layer 是我这次最喜欢的部分。文档的 Markdown 文件通过 `glob` 加载器变成一个有类型的集合，frontmatter 用 Zod 定义 schema，字段写错了构建时就报错：

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['guide', 'component', 'pattern']),
    order: z.number().default(0),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
})

export const collections = { docs }
```

页面里用 `getCollection('docs')` 拿到的数据是有完整 TypeScript 类型的，`entry.data.category` 的提示里直接列出三个枚举值。以前在 Nuxt Content 里 frontmatter 是 `any`，拼错一个字段要到页面渲染出来才发现。

加载器不限于本地文件。我试着写了一个从内部 API 拉组件元数据的加载器，就是一个 `async` 函数返回数组，Astro 负责缓存和增量更新。文档站现在每个组件页面顶部的 props 表格就是从源码的类型定义自动生成的，不用手动维护。

迁移本身花的时间比我预想的少。三天里第一天搭骨架和内容集合，第二天把 Vue 组件逐个分类——哪些保留交互、哪些降级成静态，第三天处理样式和部署。原来的 Markdown 文档几乎没有改动，只是把 frontmatter 里几个随手写的字段按 schema 规整了一遍，这一步顺手抓出了四篇 `updated` 字段格式不统一的文档。

## 数据

迁移前后用 Lighthouse 在同一台机器上各跑五次取中位数，都是生产构建：

| 指标               | Nuxt 版本 | Astro 版本 |
| ------------------ | --------- | ---------- |
| 首页 JS 传输量     | 183KB     | 0KB        |
| 组件页 JS 传输量   | 196KB     | 24KB       |
| LCP                | 1.9s      | 0.6s       |
| TBT                | 210ms     | 0ms        |
| 构建时间（214 页） | 48s       | 19s        |

组件页那 24KB 是一个带 `client:visible` 的演示组件加 Vue 运行时的体积。首页零 JS 不是我做了什么优化，是默认状态。

同事在 VPN 下打开的时间从三四秒变成了一秒出头，这是最直接的反馈。

**构建产物是纯静态的，部署极其简单。** 整个站就是一个 `dist` 目录，扔到任何静态托管上就能跑，不需要 Node 进程，也就没有内存、重启、进程守护这些事。这一点对内部工具来说是实打实的运维减负。

## 不适合的地方

Astro 不是万能的，这三天也碰到了它的边界。

**页面之间没有共享状态。** 每个页面是独立的 HTML，岛和岛之间不在一棵组件树里，想共享状态要用 nanostores 这类框架无关的方案，或者干脆用 URL 和 localStorage。文档站无所谓，后台管理这种重交互的应用就别用了。

**路由切换是整页跳转。** 默认没有客户端路由，点链接就是浏览器正常导航。Astro 提供了 View Transitions 来做平滑过渡，效果不错，但本质还是整页换，有些习惯了 SPA 的人会觉得“闪了一下”。

**Vue 生态里的部分东西用不了。** 比如依赖全局 `app` 实例的插件、依赖 Vue Router 的组件，在岛里没有这些上下文。我有两个用了 `useRoute` 的组件改成了从 props 传路径。

**服务端能力有限。** Astro 5 有 Server Islands 和 SSR 适配器，可以做动态内容，但它的服务端层比 Nitro 简单得多，没有那套中间件、缓存、存储抽象。文档站用不着，要做真正的应用后端还是 Nuxt 顺手。

## 什么时候选它

我的判断标准现在很简单：页面上“只读内容”和“交互组件”的比例。如果一个站点大部分页面打开就是看的，像博客、文档、产品介绍、作品集，Astro 几乎没有对手，默认零 JS 的起点太有吸引力了。如果页面本身就是一个应用，登录态、全局状态、复杂路由，Nuxt 这类全栈框架仍然是对的选择。

至于我自己的博客要不要迁？想了想暂时不会。博客后台和公开站共用一套 Nuxt 代码，拆开成本不小。但公司那个文档站已经切过去了，三天的投入换来首页 JS 从 183KB 到零，这笔账算得过来。
