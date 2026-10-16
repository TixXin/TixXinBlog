四月底我给博客做了一个小功能：统计每篇文章在不同国家的阅读量，结果展示在后台。这个需求的难点不在统计本身，而在于它要跑在离用户最近的地方。博客部署在边缘节点上，每次访问都去主库写一条记录的话，一次往返几十到上百毫秒，不划算。当时的第一反应是上 Redis 或者 KV，但用了几天发现查询需求越来越复杂，KV 做不了聚合。

最后用的是 SQLite。准确地说，是 Cloudflare D1，一个跑在边缘上的 SQLite。这篇想聊聊这件事背后的变化：一个三十多年前为嵌入式场景设计的数据库，为什么这两年突然在 Web 开发里又热起来了。

## SQLite 一直都在，变的是部署方式

先说一个容易被忽略的事实：SQLite 从来没有过时。它在每一台手机、每一个浏览器、每一份 macOS 里都跑着，大概是世界上部署最广的数据库。Web 后端不用它，不是因为它不好，而是因为传统的 Web 架构是“多个无状态应用服务器连一个数据库服务器”，SQLite 是单文件嵌入式的，天然不适合这种拓扑。

这两年变的是架构本身。边缘计算把代码推到了离用户几十毫秒的地方，而传统的中心化数据库还在某一个机房里。代码跑得再快，每次查询都要跨半个地球回主库，边缘的优势就被抵消了。这时候大家发现：如果数据库也能像代码一样复制到边缘，SQLite 这种“一个文件就是一个库”的形态反而成了最适合的。

于是出现了这几个产品：

- **Cloudflare D1**：Workers 平台上的托管 SQLite，2024 年正式可用，每个数据库有一个主位置，读可以通过副本加速。
- **Turso**：基于 libSQL（SQLite 的一个分支），主打多地域副本，本地读副本、远程写主库。
- **Fly.io 上的 LiteFS**：把 SQLite 文件在多个节点间做流式复制。
- **Node 22 的 `node:sqlite`**：Node 自带的 SQLite 绑定，今年初在 22.13 里去掉了实验标记，不用再装原生依赖。

它们解决的是同一个问题：怎么让 SQLite 在分布式环境里跑起来。

## 在 D1 上做阅读统计

回到我那个需求。用 D1 的话，统计表的结构很直接：

```sql
CREATE TABLE IF NOT EXISTS post_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_key TEXT NOT NULL,
  country TEXT NOT NULL,
  viewed_on TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (post_key, country, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_post_views_key ON post_views (post_key);
```

写入用 `ON CONFLICT` 做累加，一天一个国家一篇文章只有一行，避免表膨胀：

```ts
export default {
  async fetch(request: Request, env: { VIEWS: D1Database }) {
    const url = new URL(request.url)
    const postKey = url.searchParams.get('post')
    if (!postKey) return new Response('missing post', { status: 400 })

    const country = request.headers.get('cf-ipcountry') ?? 'XX'
    const today = new Date().toISOString().slice(0, 10)

    await env.VIEWS.prepare(
      `INSERT INTO post_views (post_key, country, viewed_on)
       VALUES (?1, ?2, ?3)
       ON CONFLICT (post_key, country, viewed_on)
       DO UPDATE SET count = count + 1`,
    )
      .bind(postKey, country, today)
      .run()

    return new Response(null, { status: 204 })
  },
}
```

后台的聚合查询就是普通 SQL，`GROUP BY country` 再按 `count` 排序，几毫秒出结果。这是 KV 怎么都做不到的。

表结构的变更我用 wrangler 的迁移命令管理，每个迁移是一个带序号的 SQL 文件，本地先对着 `.sqlite` 文件跑一遍，没问题再应用到线上。D1 的迁移记录存在库里一张专门的表中，重复执行会跳过已经应用的，这一点和我在 Postgres 上用惯的迁移工具体验差不多，上手没花什么时间。

顺便说一下之前用 KV 失败的原因。KV 是键值存储，要做“按国家聚合”就得自己维护一个 `post:country` 的键，每次访问先读再写回，并发一上来就会丢计数。我试过用 Durable Objects 做串行化，能解决丢计数，但复杂度一下子上去了，而且“最近七天哪篇文章在哪个国家涨得最快”这种问题还是答不了。换成 SQL 之后，这些问题变成了一条 `GROUP BY` 加一个日期范围，几分钟就写完了。

实测下来，写入延迟中位数大概 30 毫秒出头，因为写必须回到 D1 的主位置；读走的是就近副本，中位数不到 10 毫秒。对一个阅读统计来说，写入慢一点无所谓，读快才重要。

## 本地开发：`node:sqlite` 让事情变简单

以前在 Node 里用 SQLite 要装 `better-sqlite3`，它是原生模块，换 Node 版本要重新编译，在 CI 里偶尔会因为缺少构建工具链失败。今年 Node 22.13 把 `node:sqlite` 转正之后，这个麻烦没有了：

```ts
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('./dev-views.sqlite')

db.exec(`
  CREATE TABLE IF NOT EXISTS post_views (
    post_key TEXT NOT NULL,
    country TEXT NOT NULL,
    viewed_on TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    UNIQUE (post_key, country, viewed_on)
  )
`)

const insert = db.prepare(`
  INSERT INTO post_views (post_key, country, viewed_on) VALUES (?, ?, ?)
  ON CONFLICT (post_key, country, viewed_on) DO UPDATE SET count = count + 1
`)
insert.run('sqlite-renaissance', 'CN', '2025-06-06')

const top = db.prepare(`
  SELECT country, SUM(count) AS total FROM post_views
  WHERE post_key = ? GROUP BY country ORDER BY total DESC LIMIT 5
`)
console.log(top.all('sqlite-renaissance'))
```

它是同步 API，这在 SQLite 的语境下反而是优点，本地文件读写本来就快，异步包装只会增加复杂度。我现在本地开发时用这个跑一个 `.sqlite` 文件，部署时切到 D1，两边 SQL 完全一致，只是执行方式不同。

## SQLite 不适合的地方

热归热，边界还是要说清楚。我这半年踩到的几个限制：

**写入是单点的。**不管 D1 还是 Turso，写都得回主位置，多地域的优势只在读上。写多读少的场景，比如高频日志或者实时协作，边缘 SQLite 没有优势，甚至不如一个靠近写入方的 Postgres。

**没有真正的并发写。**SQLite 的写锁是数据库级的，一次只能有一个写事务。托管服务在上面做了排队，但如果你的业务有大量并发写，排队延迟会很明显。我的阅读统计每秒几次写，完全没问题；换成一个活跃的评论区可能就要重新考虑了。

**数据库大小有上限。**D1 目前单库上限是 10GB，Turso 的免费层更小。对博客这种量级绰绰有余，对一个持续增长的业务库就要提前规划分库。

**类型系统很松。**SQLite 的列类型是“亲和性”而不是约束，`INTEGER` 列可以存进去一个字符串。从 Postgres 过来的人要注意在应用层做校验，别指望数据库帮你拦。

**事务跨请求不可用。**在 Workers 这类环境里，一个请求结束连接就释放了，没法开一个事务跨多个请求。需要多步操作的话，要么在一个请求里用 `batch()` 一起提交，要么重新设计流程。

## 我现在怎么选

博客的主库还是 Postgres，文章、评论、媒体这些核心数据都在那里，没有打算动。SQLite 在我这里的定位是**边缘侧的从属数据**：阅读统计、访问来源、缓存的聚合结果，这类“丢了能重算、读多写少、离用户越近越好”的东西。

这个分工我觉得会是未来一段时间的常态。SQLite 的复兴不是要取代谁，而是补上了“边缘需要一个会 SQL 的存储”这个空缺。它从嵌入式设备走到浏览器，再走到边缘节点，形态变了三次，内核还是那一个 C 文件。

如果你也在边缘上做东西，又被 KV 的查询能力限制过，不妨试试。至少阅读统计这个功能，我从调研到上线一共花了一个周末，大部分时间是在写后台的图表，而不是在跟数据库较劲。
