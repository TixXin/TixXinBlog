博客的书签功能一直是用 localStorage 存的，一个 JSON 字符串，读的时候 `JSON.parse`，写的时候 `JSON.stringify` 整个覆盖。几百条书签的时候没问题，上个月我自己的书签涨到两千多条、再加上每条带了一段摘录之后，localStorage 开始报 `QuotaExceededError`——Chrome 给每个源的配额是 5MB 左右，按 UTF-16 算，两千多条带摘录的书签真的能顶到。

于是花了一周把书签存储迁到了 IndexedDB。这篇文章把 IndexedDB 的核心概念、用 TypeScript 封装的方式、以及迁移时踩的坑整理一下。它的 API 风格确实有点老（回调加事件，不是 Promise），但搞清楚几个核心概念之后并不难用。

## 它跟 localStorage 到底差在哪

|               | localStorage     | IndexedDB                                      |
| ------------- | ---------------- | ---------------------------------------------- |
| 容量          | 约 5MB           | 通常是磁盘可用空间的一定比例，几百 MB 到几 GB  |
| 读写方式      | 同步，阻塞主线程 | 异步，基于事件和请求                           |
| 数据类型      | 只有字符串       | 结构化克隆支持的任意对象，包括 Blob、Date、Map |
| 查询          | 只能按 key 取    | 主键、索引、范围查询、游标遍历                 |
| 事务          | 没有             | 有，读写隔离                                   |
| Worker 里可用 | 不行             | 可以                                           |

最关键的两条是**异步**和**索引**。书签这种数据，“按添加时间倒序取最近 50 条”“按标签筛选”“按文章 slug 查找”都是高频操作，localStorage 只能全量读出来再在内存里过滤，IndexedDB 可以直接走索引。

## 核心概念

把这几个词理清楚，后面的代码就都能看懂了：

- **数据库（Database）**：一个源下可以有多个，按名字区分，有版本号。
- **对象仓库（Object Store）**：类似表，存的是 JS 对象。每个 store 有一个主键（keyPath），可以自增。
- **索引（Index）**：对 store 里对象的某个字段建的索引，可以是唯一的，也可以对数组字段建多值索引（multiEntry）。
- **事务（Transaction）**：所有读写都在事务里进行。事务声明要访问哪些 store 和模式（`readonly` 或 `readwrite`），在事件循环的当前任务结束、没有新请求时自动提交。
- **请求（Request）**：每个操作返回一个 `IDBRequest`，用 `onsuccess`/`onerror` 拿结果。

结构变更（建 store、建索引）只能在 `onupgradeneeded` 里做，这个事件在打开数据库时如果版本号比现有的大才会触发。这是 IndexedDB 的迁移机制，所以版本号要认真管理。

## 打开数据库和迁移

先把打开和迁移封成一个 Promise：

```ts
const DB_NAME = 'myblog'
const DB_VERSION = 2

export interface BookmarkRecord {
  id?: number
  slug: string
  title: string
  excerpt: string
  tags: string[]
  createdAt: number
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      if (oldVersion < 1) {
        const store = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true })
        store.createIndex('bySlug', 'slug', { unique: true })
        store.createIndex('byCreatedAt', 'createdAt')
      }
      if (oldVersion < 2) {
        const store = request.transaction!.objectStore('bookmarks')
        store.createIndex('byTag', 'tags', { multiEntry: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => console.warn('数据库升级被其他标签页阻塞')
  })
}
```

几个值得说的点：

- 迁移按 `oldVersion` 逐级写，不要用 `if (oldVersion === 1)` 这种精确匹配，否则从版本 0 直接升到 2 的用户会漏掉中间步骤。
- `onupgradeneeded` 里拿到的 `request.transaction` 是一个 `versionchange` 事务，建索引要用它，不能自己再开。
- `onblocked` 的情况是其他标签页还开着旧版本的连接。处理方式是在旧连接上监听 `versionchange` 事件并主动关闭，不然新标签页会一直卡着。

`tags` 字段建了 `multiEntry: true` 的索引，意思是数组里每个元素都会成为一条索引记录，这样“查有某个标签的所有书签”就是一次索引查询。

## 把请求包成 Promise

IndexedDB 的原始 API 全是事件回调，直接用很啰嗦。写一个小助手把 `IDBRequest` 转成 Promise：

```ts
function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function addBookmark(db: IDBDatabase, record: Omit<BookmarkRecord, 'id'>) {
  const tx = db.transaction('bookmarks', 'readwrite')
  const id = await toPromise(tx.objectStore('bookmarks').add(record))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return id as number
}

export async function getBookmarkBySlug(db: IDBDatabase, slug: string) {
  const tx = db.transaction('bookmarks', 'readonly')
  return toPromise(tx.objectStore('bookmarks').index('bySlug').get(slug)) as Promise<BookmarkRecord | undefined>
}

export async function listRecent(db: IDBDatabase, limit = 50) {
  const tx = db.transaction('bookmarks', 'readonly')
  const index = tx.objectStore('bookmarks').index('byCreatedAt')
  const results: BookmarkRecord[] = []
  return new Promise<BookmarkRecord[]>((resolve, reject) => {
    const cursorRequest = index.openCursor(null, 'prev')
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor || results.length >= limit) return resolve(results)
      results.push(cursor.value)
      cursor.continue()
    }
    cursorRequest.onerror = () => reject(cursorRequest.error)
  })
}
```

`listRecent` 用了游标：`openCursor(null, 'prev')` 表示不限范围、倒序遍历，取够 `limit` 条就停。相比 `getAll()` 再 `slice`，游标在数据量大时能省很多内存。

这里有个**事务自动提交**的坑，是 IndexedDB 最容易让人困惑的地方：事务在当前任务里没有未完成的请求时就会提交。如果你在事务里 `await` 了一个跟 IndexedDB 无关的东西（比如一个 `fetch`），再回来用这个事务，就会报 `TransactionInactiveError`。规则是：事务里只 `await` IndexedDB 自己的请求。

### 范围查询

索引查询不只有精确匹配。`IDBKeyRange` 可以表达“大于某个值”“在两个值之间”这样的范围条件，配合索引就能做出“最近七天添加的书签”这种查询，而且不用把全部数据读进内存。比如 `IDBKeyRange.lowerBound(Date.now() - 7 * 86400_000)` 传给 `byCreatedAt` 索引的 `getAll`，拿到的就是这一周的记录。字符串键也支持范围，用 `IDBKeyRange.bound(a, a￿)` 可以做前缀匹配，这个技巧在按标题首字母筛选的时候用过一次。

需要注意的是范围查询只能针对单个索引，不能像 SQL 那样在两个字段上同时加条件。如果既要按标签筛又要按时间排，常见做法是建一个复合索引，keyPath 写成数组 `[tag, createdAt]`，不过复合索引不支持 multiEntry，所以标签是数组的情况要先把数据拆平。我最后没有这么做，而是按标签取出来之后在内存里排序，因为单个标签下的书签通常不超过两百条，排序的开销可以忽略。

## 实际项目里我用的是 idb

上面的封装够用，但真实项目里我最后还是换成了 Jake Archibald 的 `idb` 库。它只有 1KB 多，把所有 API 转成了 Promise，还带 TypeScript 的 schema 类型：

```ts
import { openDB, type DBSchema } from 'idb'

interface BlogDB extends DBSchema {
  bookmarks: {
    key: number
    value: BookmarkRecord
    indexes: { bySlug: string; byCreatedAt: number; byTag: string }
  }
}

const db = await openDB<BlogDB>('myblog', 2, {
  upgrade(db, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
      const store = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true })
      store.createIndex('bySlug', 'slug', { unique: true })
      store.createIndex('byCreatedAt', 'createdAt')
    }
    if (oldVersion < 2) {
      tx.objectStore('bookmarks').createIndex('byTag', 'tags', { multiEntry: true })
    }
  },
})

const recent = await db.getAllFromIndex('bookmarks', 'byCreatedAt', null, 50)
const tagged = await db.getAllFromIndex('bookmarks', 'byTag', 'vue')
```

有了 schema 类型，store 名字、索引名字、返回值类型都能推断，写错了编译期就报错。这个体验比手写封装好太多。

## 从 localStorage 迁移

迁移逻辑写在首次打开数据库之后：读旧的 localStorage 数据，批量写入 IndexedDB，成功后删掉旧 key。批量写入要在一个事务里做，两千多条分开写每条开一个事务要七八秒，一个事务里完成只要 200ms 左右。

迁移时还顺便处理了一个历史问题：旧数据里有一些重复的 slug（早期没做去重），`bySlug` 索引是唯一的，直接写会报 `ConstraintError`。处理方式是迁移前先按 slug 去重，保留 `createdAt` 最早的那条。

迁移完的效果：书签列表页首次渲染从读取整个 JSON 的 90ms 降到走索引的 12ms，而且不再阻塞主线程；配额问题彻底消失；按标签筛选从全量过滤变成索引查询。

## 几个边界问题

- **隐私模式**：Safari 的无痕模式下 IndexedDB 可用但配额很小，Firefox 早期版本直接不可用。打开失败时要有降级，我的做法是退回内存存储并提示“当前浏览器不支持持久化”。
- **配额查询**：`navigator.storage.estimate()` 能拿到当前源的已用量和配额上限，我在设置页里加了一行显示，方便自己判断还能存多少。Chrome 上我这个站点的配额显示是 60GB 左右，基本不用担心。
- **存储驱逐**：浏览器在磁盘紧张时可能清掉某个源的数据。重要数据可以调 `navigator.storage.persist()` 申请持久化，Chrome 会根据站点的互动程度决定是否批准。
- **多标签页**：两个标签页同时写同一条记录，后提交的赢。书签场景无所谓，但如果是有冲突语义的数据，要用 `BroadcastChannel` 通知其他标签页刷新。
- **Safari 的 Bug**：Safari 曾经在页面刚加载时第一次 `open` 会挂住不响应，现在的版本已经修了，但如果要兼容老版本，可以加一个超时重试。

IndexedDB 的 API 设计确实不讨喜，但它解决的问题是实实在在的。如果你的数据超过几百 KB、需要按字段查询、或者要在 Worker 里访问，就别再往 localStorage 里塞了。
