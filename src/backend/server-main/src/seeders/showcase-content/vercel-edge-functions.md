十一月底我把一个给朋友做的小工具站部署到了 Vercel，功能很简单：输入一个网址，返回它的 Open Graph 信息做成卡片。本来用普通的 Serverless Function 就够了，但第一次打开接口时那 600 多毫秒的冷启动让我很不爽，于是把它改成了 Edge Function。改完之后冷启动变成了二三十毫秒，但随之而来的是一堆以前没遇到过的限制。这篇把这两周的体验写下来，包括它快在哪、不能做什么、以及我最后怎么安排的。

## 它和普通 Serverless Function 的区别

Vercel 上的函数有两种运行时。默认的 Node.js 运行时跑在 AWS Lambda 上，每个函数是一个完整的 Node 进程，有冷启动，部署在你选的某一个区域（默认是美东）。Edge 运行时跑在 Vercel 自己的边缘网络上，基于 V8 isolate，不是完整的 Node，启动极快，而且在离用户最近的节点执行。

isolate 这个词是关键。它和 Cloudflare Workers 是同一类东西：一个 V8 实例里跑很多个隔离的上下文，不需要为每个请求起进程，所以冷启动的开销基本只是加载你的代码。代价是你拿不到 Node 的 API，没有 `fs`、没有 `net`、没有 `child_process`，只有 Web 标准那一套：`fetch`、`Request`、`Response`、`URL`、`crypto.subtle`、`TextEncoder`，再加上 Vercel 提供的少量扩展。

## 写一个 Edge Function

最简单的形式是在项目根目录的 `api` 文件夹下放一个文件，导出一个处理 `Request` 返回 `Response` 的函数，并声明运行时：

```ts
// api/og.ts
export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const target = new URL(req.url).searchParams.get('url')
  if (!target) {
    return Response.json({ error: '缺少 url 参数' }, { status: 400 })
  }

  const res = await fetch(target, {
    headers: { 'user-agent': 'og-card-bot/1.0' },
    signal: AbortSignal.timeout(5000),
  })
  const html = await res.text()
  const pick = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+property="og:${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1] ?? ''

  return Response.json(
    { title: pick('title'), description: pick('description'), image: pick('image') },
    { headers: { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
```

整个文件就是标准的 Web API，没有任何 Vercel 特有的东西，除了那行 `config`。这意味着同一段代码理论上可以搬到 Cloudflare Workers 或者 Deno Deploy。`s-maxage` 这个头会让 Vercel 的边缘缓存把响应存一小时，第二次请求同一个网址直接命中缓存，连函数都不跑。

## 在 Nuxt 里用

我的工具站是 Nuxt 写的，不需要手写 `api` 目录，Nitro 有现成的预设：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'vercel-edge',
  },
})
```

设置之后整个服务端，包括 SSR 和 `server/api` 下所有接口，都会编译成一个 Edge Function。这里有个要注意的地方：是整个应用，不是某几个接口。只要你的 `server` 目录里有任何一处用了 Node 专有 API，构建会直接失败，或者更糟，构建通过了但运行时报 `fs is not defined`。我的项目里有个用 `sharp` 处理图片的接口，就是这样被拦下来的。

Nitro 还有一个 `vercel` 预设对应 Node 运行时。两个预设不能混用，一个项目要么全部跑在 Edge 上，要么全部跑在 Node 上。想一部分接口走 Edge 一部分走 Node，得拆成两个项目。

## 和 Edge Middleware 的区别

Vercel 还有一个叫 Edge Middleware 的东西，和 Edge Function 跑在同一个运行时，但角色不一样：中间件在请求到达任何页面或函数之前执行，适合做重定向、地域判断、A/B 分流、给请求加头这类轻量操作，它不应该产生完整的响应体。我在工具站上用它做了一件小事：根据请求头里的地理信息，把中文地区的用户重定向到中文界面。

```ts
// middleware.ts
import { next } from '@vercel/edge'

export const config = { matcher: '/' }

export default function middleware(req: Request) {
  const country = req.headers.get('x-vercel-ip-country') ?? ''
  const lang = new URL(req.url).searchParams.get('lang')
  if (!lang && ['CN', 'HK', 'TW', 'SG'].includes(country)) {
    return Response.redirect(new URL('/?lang=zh', req.url), 307)
  }
  return next()
}
```

`x-vercel-ip-country` 这类头是 Vercel 在边缘节点注入的，不需要自己查 IP 库。中间件执行在每个请求上，所以要特别克制，我给它定的规矩是不发任何外部请求，只做头部和 URL 层面的判断。

## 实测数据

我用同一个接口分别以两种运行时部署，从深圳的家里用 `curl` 测量，每种情况跑 30 次：

| 场景                     | Node 运行时（美东） | Edge 运行时 |
| ------------------------ | ------------------- | ----------- |
| 冷启动首次响应           | 640ms               | 85ms        |
| 热状态响应               | 310ms               | 70ms        |
| 函数内部执行时间（日志） | 12ms                | 9ms         |

函数本身的执行时间几乎一样，差距全在冷启动和网络往返上。Edge 的 70ms 里大部分是深圳到最近边缘节点的延迟，函数几乎是瞬间的。Node 版本的 310ms 则有 200 多毫秒花在跨太平洋的往返上。

不过这个数据有个前提：我的接口不访问数据库。一旦要查数据库，边缘函数的位置优势就可能变成劣势，这是下面要说的。

## 限制和坑

**代码体积。** Edge Function 压缩后的体积上限是 1MB（Hobby）到 4MB（Enterprise），我的 Nuxt 应用编译出来压缩后 890KB，离 Hobby 的上限已经很近了。多装一个带 polyfill 的依赖就可能超。查体积用 `vercel build` 之后看 `.vercel/output/functions` 下的文件大小。

**没有 Node API。** 上面已经说过。实际碰到的具体问题：`Buffer` 没有（要用 `Uint8Array` 和 `TextEncoder`），`process.env` 可以读但 `process.cwd()` 不行，`crypto.randomUUID()` 有但 `crypto.createHash` 没有，要用 `crypto.subtle.digest`。很多 npm 包在 `import` 的时候就会因为引用这些东西而挂掉。

**数据库连接。** 边缘节点分布在全球几十个地方，而数据库通常只在一个区域。一个在东京边缘节点执行的函数去连美东的 PostgreSQL，光往返就要 150ms 以上，还不如直接把函数放在美东。而且 Edge 没有 TCP socket，传统的数据库驱动根本跑不起来，只能用走 HTTP 的方案，比如 Neon 的 serverless 驱动或者 Upstash 的 Redis。

**环境变量和密钥。** `process.env` 在 Edge 里能读，但只有构建时就存在的变量会被注入，在 Vercel 面板上新加一个变量之后必须重新部署才生效，这和 Node 运行时不一样。我因为这个对着一个一直返回空值的 token 查了二十分钟。

**执行时间。** 函数必须在 25 秒内开始返回响应，之后流式输出可以更长。对我的场景够用，但做长任务处理不行。

**调试。** 本地 `vercel dev` 对 Edge 运行时的模拟不完全，有些在本地能跑的代码上线就报错。我养成了每次改完先部署到 preview 环境再测的习惯，而不是信任本地。

## 最后怎么安排的

工具站最终拆成了两部分：抓取 OG 信息、生成卡片这些纯计算的接口留在 Edge，它们只依赖 `fetch`，而且用户在哪就在哪跑，配合边缘缓存效果极好；需要处理图片和写数据库的部分单独做成一个 Node 运行时的项目，部署在新加坡区域，前者通过 `fetch` 调用后者。

两个项目的拆分带来一些维护成本，但各自都在最合适的地方跑。如果你的服务端逻辑是“接收请求、调几个 HTTP 接口、组装返回”这种形态，Edge 是明显的赢家；一旦涉及数据库、文件、重计算，老老实实用 Node 运行时，把区域选在离数据库最近的地方。

边缘计算的宣传经常让人觉得它是未来，什么都该往上搬。两周用下来我的感受是，它是一个特定形状的工具，形状对了非常好用，形状不对就是在给自己找麻烦。
