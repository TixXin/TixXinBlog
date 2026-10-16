国庆假期前最后一个工作日，同事在群里丢了一张 Lighthouse 截图，问我博客首页为什么能跑到 97 分而公司的后台只有 41。我回了一句“因为博客小”，但其实这个回答不诚实。博客两年前也只有 60 出头，中间做过四五轮优化，每一轮都有记录。借着假期有空，把这些记录按“架构”和“性能”两条线整理一下，顺便回答那个问题。

先说结论：性能问题大多数不是写法问题，是边界问题。模块边界划清楚了，构建产物自然干净，运行时指标自然好看。反过来，边界乱的项目，再怎么调 `v-memo` 和图片懒加载也只能治标。

## 模块边界：按领域切，不按类型切

博客的前端目录是按领域组织的，`features/post`、`features/guestbook`、`features/gallery`，每个目录里有自己的 `types.ts`、`api.ts` 和 composable。页面只负责把这些领域组合起来，展示组件只接 props 和事件，不碰 API。

这样做最直接的好处是依赖方向固定。`features` 之间不互相引用，公共的东西上提到 `shared`。我在 ESLint 里加了一条 `no-restricted-imports` 规则，`features/*` 不允许 import 另一个 `features/*`，违反了直接报错。规则上线那天修了 14 处交叉引用，其中有 3 处是循环依赖，之前能跑只是因为 ESM 对循环引用比较宽容。

类型也跟着边界走。每个领域的 `types.ts` 是对外契约，内部实现随便改，只要契约不变，其他地方不用动。一个让我受益很大的习惯是把后端 DTO 和前端类型对齐，但不共享文件，中间用一层转换：

```ts
// features/post/types.ts
export interface PostSummary {
  slug: string
  title: string
  publishedAt: Date
  readMinutes: number
}

// features/post/api.ts
interface PostSummaryDto {
  slug: string
  title: string
  published_on: string
  read_time: number
}

export function toPostSummary(dto: PostSummaryDto): PostSummary {
  return {
    slug: dto.slug,
    title: dto.title,
    publishedAt: new Date(dto.published_on),
    readMinutes: dto.read_time,
  }
}
```

转换层看起来是多余的代码，但后端去年把 `published_on` 从日期字符串改成 ISO 时间戳的时候，前端只改了这一个函数，二十几个用到 `publishedAt` 的组件一行没动。

## 构建产物：先看清楚，再动手

优化之前我先在构建里接了 `rollup-plugin-visualizer`，把产物按模块画成树图。第一次看的时候很意外：首屏的 JS 有 2.1MB，其中 640KB 是一个 Markdown 渲染器连同它的全部语法高亮语言包，而首页根本不渲染 Markdown。原因是 `useMarkdown` 这个 composable 被一个首页也用到的工具函数顺带引入了，静态 import 让打包器没法把它拆出去。

修法是把渲染器改成动态引入，只在文章页才加载：

```ts
export async function renderMarkdown(source: string) {
  const { createRenderer } = await import('./markdown-renderer')
  return createRenderer().render(source)
}
```

加上把高亮语言包改成按需注册，首屏 JS 从 2.1MB 降到 340KB。这是四轮优化里收益最大的一次，而它只改了两个文件。

之后几轮是零碎的：把三套主题的样式从 JS 里抽成独立 CSS 文件，由 `<link>` 加载而不是运行时注入，去掉了 90KB 的内联样式字符串；字体只保留正体，粗体用浏览器合成，字体文件从 4 个减到 1 个；图标从整包引入改成按名字引入。每一项的收益都不大，但加起来首屏请求数从 38 个降到 19 个。

这里有一条经验：每次改动都看一次树图，而不是改完一堆再看。单次改动的收益很容易验证，攒在一起就说不清是哪一项起了作用。

## 运行时指标：盯着三个数

我只盯 LCP、INP 和 hydration 耗时。前两个是 Core Web Vitals，第三个是 SSR 应用特有的，指服务端渲染的 HTML 到前端接管完成的时间。

LCP 的大头是首屏图片。博客的封面图走的是服务端按宽度裁切的缩略图，`<img>` 上写明 `width` 和 `height` 避免布局抖动，首屏那一张加 `fetchpriority="high"`，其余加 `loading="lazy"`。这几项做完 LCP 从 2.8 秒降到 1.3 秒，再往下就是服务器带宽的问题了。

INP 的问题主要出在评论区。每条评论的时间都用 `dayjs` 格式化成相对时间，一百条评论就是一百次格式化，而且在 `computed` 里，任何输入都会触发重算。改成在数据进来时格式化一次、存成普通字符串，输入框的 INP 从 180 毫秒降到 40 毫秒。

hydration 这个数我是用 Playwright 打点测的，在 `app:mounted` 钩子里记一个 `performance.mark`，和导航开始的时间相减。生产环境平均 39 毫秒，主要的改善来自上面提到的 JS 体积减小，另外右侧栏改成了延迟水合，首屏不需要交互的部分先不接管。

## 类型是架构的一部分

写这篇之前我犹豫过要不要单独讲 TypeScript，后来觉得必须讲，因为上面每一条边界最终都是靠类型守住的。转换层靠类型保证字段不漏，`features` 的对外契约靠 `types.ts` 的导出列表定义，动态引入的模块靠返回类型约束调用方。

我现在的习惯是先写类型再写实现。一个新领域开始时先建 `types.ts`，把页面需要什么、接口返回什么、两者之间差在哪里写清楚，这一步做完实现往往很顺。反过来先写实现再补类型，补出来的类型通常是 `any` 的变体，守不住任何东西。

另一个对性能有帮助的习惯是用 `import type` 把类型引入和值引入分开。打包器会把纯类型引入整个擦掉，但如果一个模块同时导出类型和值，而你只需要类型却写了普通 import，那个模块的运行时代码也会被带进来。我在树图里找到过一个 60KB 的日期工具库，首页唯一用到它的地方是一个类型注解。`verbatimModuleSyntax` 打开之后这类错误会在编译期暴露，建议一开始就开。

## 衡量的时候别骗自己

几个我吃过亏的地方：

- 本地 dev 模式的数字没有意义，Vite 的开发服务器不打包，模块数量和生产完全不同。所有数字都要在 `build` 之后的产物上测。
- 一次测量不算数。我现在的做法是跑 5 次取中位数，网络条件用 Chrome 的 Fast 3G 预设，不然服务器在深圳、我也在深圳，什么都快。
- Lighthouse 分数是综合指标，适合汇报，不适合定位问题。定位问题要看具体的瀑布图和火焰图。
- 把数字记下来。我在仓库里有一个 `.artifacts/perf` 目录，每轮优化前后各一份 JSON，一年后回头看才知道哪些改动值得。

回到开头那个问题。公司后台 41 分，我后来看了一眼，首屏加载了一个 1.8MB 的图表库和一整套富文本编辑器，而登录页既没有图表也没有编辑器。这不是写法的问题，是没有人画过那张树图。先看清楚，再决定改什么，大部分性能工作其实就这一句话。
