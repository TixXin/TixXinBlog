去年 Q4 给博客后台加了一个小功能：留言和友链申请进来的时候，管理页面右上角实时弹一个提醒，不用刷新。需求很简单，但选型的时候我在 WebSocket、SSE 和长轮询之间来回犹豫了好几天，最后用的方案跟我一开始想的完全不一样。借着这个机会把三种方案的差别认真梳理了一遍，这篇文章就是梳理的结果，顺带说说我为什么最后选了 SSE。

## 三种方案到底在解决什么

所谓“实时通信”，本质上是要解决 HTTP 请求—响应模型的一个限制：服务端没法主动给客户端发消息。三种方案是三种不同程度的“绕过”：

- **长轮询（Long Polling）**：客户端发一个请求，服务端有数据才响应，没数据就挂着，直到超时。客户端收到响应（或超时）后立刻再发下一个。本质上还是请求—响应，只是把“等待”放在了服务端。
- **SSE（Server-Sent Events）**：客户端发一个请求，服务端用 `text/event-stream` 响应，连接不关闭，持续往里写数据。单向，只能服务端推给客户端。
- **WebSocket**：通过 HTTP 握手升级成一个独立的全双工协议，之后双方随时可以互发消息，帧格式和 HTTP 没有关系。

很多人（包括之前的我）的直觉是“WebSocket 最先进，无脑选它”。但选型要看的是场景，不是先进程度。

## 一张表对比

|                  | 长轮询                   | SSE                             | WebSocket                      |
| ---------------- | ------------------------ | ------------------------------- | ------------------------------ |
| 方向             | 服务端到客户端           | 服务端到客户端                  | 双向                           |
| 协议             | 普通 HTTP                | 普通 HTTP                       | 独立协议（ws/wss）             |
| 自动重连         | 要自己写                 | 浏览器内置                      | 要自己写                       |
| 断点续传         | 要自己写                 | 内置 `Last-Event-ID`            | 要自己写                       |
| 经过代理/CDN     | 没问题                   | 大多数没问题，注意缓冲          | 需要代理支持 Upgrade           |
| HTTP/2 复用      | 可以                     | 可以                            | 不行（走的是 HTTP/1.1 升级）   |
| 消息格式         | 任意                     | 文本（UTF-8）                   | 文本或二进制                   |
| 服务端实现复杂度 | 低                       | 低                              | 中                             |
| 适合的场景       | 兼容性要求极高、消息稀疏 | 通知、日志流、进度、AI 流式输出 | 聊天、协作编辑、游戏、高频双向 |

表里有两行是我以前不知道、这次才搞清楚的。

一是 **HTTP/2 复用**。SSE 走的是普通 HTTP 请求，在 HTTP/2 下多个 SSE 连接可以复用同一个 TCP 连接，浏览器那个“同域名最多 6 个连接”的限制也不存在了。WebSocket 的握手依赖 HTTP/1.1 的 `Upgrade` 头，HTTP/2 上要用 RFC 8441 的扩展 CONNECT，Node 的 `ws` 库到现在也没有正式支持。

二是 **自动重连和断点续传**。浏览器的 `EventSource` 断线后会自动重连，并且带上最后收到的事件 ID，服务端据此补发漏掉的消息。这两件事用 WebSocket 都要自己实现，而且很容易写出有 bug 的版本。

## SSE：比想象中好用

先看服务端。NestJS 对 SSE 有原生支持，一个装饰器加一个 RxJS 的 Observable 就行：

```ts
import { Controller, Sse, MessageEvent } from '@nestjs/common'
import { Observable, fromEvent, map } from 'rxjs'
import { EventEmitter } from 'node:events'

@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly bus: EventEmitter) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return fromEvent(this.bus, 'admin:notify').pipe(
      map((payload: { id: number; type: string; title: string }) => ({
        id: String(payload.id),
        type: payload.type,
        data: payload,
      })),
    )
  }
}
```

客户端更简单：

```ts
const source = new EventSource('/api/admin/events/stream', { withCredentials: true })

source.addEventListener('guestbook', (event) => {
  const message = JSON.parse(event.data)
  toast.info(`新留言：${message.title}`)
})

source.onerror = () => {
  // 浏览器会自动重连，这里只记录状态
  connectionState.value = source.readyState === EventSource.CONNECTING ? 'reconnecting' : 'closed'
}
```

就这么多，没有心跳、没有重连逻辑、没有消息队列。断网再恢复，`EventSource` 自己带着 `Last-Event-ID` 重连上来，服务端查一下这个 ID 之后有没有漏掉的通知，有就补发。

但 SSE 有三个坑要注意：

1. **代理缓冲**。Nginx 默认会缓冲响应，SSE 的消息可能攒着不发。要在对应的 location 里加 `proxy_buffering off`，或者在响应头里加 `X-Accel-Buffering: no`。
2. **连接超时**。Nginx 的 `proxy_read_timeout` 默认 60 秒，没有消息的话连接会被掐断。虽然客户端会自动重连，但每分钟断一次不太好看。我的做法是服务端每 30 秒发一条注释行（以冒号开头的行，客户端会忽略）当心跳。
3. **单向**。客户端要发消息还是得走普通的 HTTP 请求。对于通知场景这完全不是问题，对于聊天就有点别扭。

## WebSocket：什么时候真的需要它

如果你的场景是这样的，WebSocket 才是正确的选择：

- 客户端要高频往服务端发消息（协作编辑的光标位置、游戏的操作）；
- 需要传二进制（音视频帧、文件分片）；
- 消息延迟要求在几十毫秒以内，HTTP 的头部开销也要省掉。

用 `ws` 库写一个最小可用的服务端，心跳和清理是必须的，不然断网的客户端会一直占着连接：

```ts
import { WebSocketServer, WebSocket } from 'ws'

const wss = new WebSocketServer({ port: 8081 })
const alive = new WeakMap<WebSocket, boolean>()

wss.on('connection', (socket) => {
  alive.set(socket, true)
  socket.on('pong', () => alive.set(socket, true))
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString())
    // 按 message.type 分发
  })
})

const timer = setInterval(() => {
  for (const socket of wss.clients) {
    if (!alive.get(socket)) {
      socket.terminate()
      continue
    }
    alive.set(socket, false)
    socket.ping()
  }
}, 30_000)

wss.on('close', () => clearInterval(timer))
```

客户端的重连要自己写指数退避，还要处理“重连后状态怎么同步”——这是 WebSocket 方案里最容易被低估的部分。连接断开期间丢的消息，服务端要不要存？存多久？重连后客户端要不要先拉一次全量？这些问题 SSE 用 `Last-Event-ID` 帮你解决了一半，WebSocket 得从头设计。

另外一个经常被忽视的点是**扩展到多实例**。两台后端实例，用户 A 连在实例 1 上，给用户 B 的消息从实例 2 发出，怎么送到？需要一个 Redis Pub/Sub 之类的中间层把消息广播到所有实例。SSE 也有同样的问题，但 SSE 的连接是普通 HTTP 请求，负载均衡和粘性会话都不需要特殊配置。

## 长轮询还有用吗

有，但用得越来越少。它的优势是“任何地方都能跑”：老旧的企业代理、某些会掐长连接的运营商网络、甚至 IE 时代的浏览器。如果你的用户环境不可控，长轮询是兜底方案。

我的看法是：现在做新项目，长轮询不应该作为首选，但可以作为 SSE 或 WebSocket 不可用时的降级方案。很多成熟的实时库（比如 Socket.IO）就是这么干的——先试 WebSocket，不行就退到长轮询。

## 我最后怎么选的

回到开头那个需求：后台通知。消息方向只有服务端到客户端，频率很低（一天几十条），用户只有我一个人，部署在一台机器上，经过 Nginx。

逐条对照：不需要双向，不需要二进制，不需要低延迟，需要自动重连（我经常合上笔记本再打开）。SSE 全中。

实现用了半天，其中一半时间花在 Nginx 的 `proxy_buffering` 上——我一开始没关，在本地直连后端测得好好的，上了服务器消息就一直不出来，排查了一个多小时才想起来有代理在中间。

如果以后要做访客之间的实时互动（比如在线人数、弹幕），我会再评估 WebSocket。但以现在的博客定位来看，大概率用不上。

选型的时候，先把场景的约束列出来，再去对照方案，而不是反过来先选一个喜欢的技术再找理由。这句话说起来简单，但我在选 SSE 之前确实已经把 `ws` 装好、代码写了一半了。
