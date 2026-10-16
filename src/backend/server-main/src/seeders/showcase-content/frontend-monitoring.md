去年底公司一个 to C 的活动页出了事故：安卓某个品牌的内置浏览器上，页面白屏了整整一个晚上，直到第二天早上客服反馈才有人发现。回看日志，服务端一切正常，CDN 命中率也漂亮，问题出在一段依赖 `structuredClone` 的代码上——那个浏览器内核太老，直接抛了 ReferenceError。这件事之后我被拉去牵头做前端监控，花了大概三个月，把采集、上报、聚合、告警这一整条链路搭了起来。

这篇文章把这三个月的设计思路和踩过的坑整理一下。不是教科书式的“监控体系应该包含什么”，而是我们实际怎么做的、为什么这么做、哪些地方后来返工了。

## 先想清楚要回答什么问题

一开始我犯的错是先调研工具：Sentry 要不要自建、是不是上 OpenTelemetry、要不要买商业 APM。后来停下来想了想，监控的本质是回答几个问题，工具只是手段：

1. 用户此刻打开页面是不是正常的？（可用性）
2. 页面打开有多慢，慢在哪一段？（性能）
3. 哪些错误在发生，影响了多少人，是新引入的还是一直存在的？（错误）
4. 用户在页面上做了什么，关键流程在哪一步流失？（行为）
5. 以上任何指标出现异常，谁、多久之内会知道？（告警）

把这五个问题写在白板上之后，设计就清晰了很多。前四个是数据采集和存储的问题，第五个是消费侧的问题，中间需要一个聚合层把原始事件变成可以判断“正常或异常”的指标。

## 采集层：一个 SDK，三类事件

我们把所有上报的东西统一成一个事件结构，不区分“性能事件”和“错误事件”走不同通道。统一结构的好处是后端只需要一个接收端点，聚合时也可以按同一套维度（页面、版本、设备、地区）做切分。

```ts
export type MonitorEventType = 'perf' | 'error' | 'behavior'

export interface MonitorEvent {
  type: MonitorEventType
  name: string
  ts: number
  sessionId: string
  page: string
  release: string
  payload: Record<string, unknown>
}

const queue: MonitorEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

export function track(event: Omit<MonitorEvent, 'ts' | 'sessionId' | 'release'>) {
  queue.push({
    ...event,
    ts: Date.now(),
    sessionId: getSessionId(),
    release: __APP_RELEASE__,
  })
  if (queue.length >= 20) flush()
  else if (!flushTimer) flushTimer = setTimeout(flush, 3000)
}

function flush() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (!queue.length) return
  const body = JSON.stringify(queue.splice(0, queue.length))
  if (!navigator.sendBeacon?.('/api/monitor/collect', body)) {
    fetch('/api/monitor/collect', { method: 'POST', body, keepalive: true }).catch(() => {})
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush()
})
```

几个细节值得说：

- `release` 字段是构建时注入的 Git 短 hash，没有它就没法回答“这个错误是哪个版本引入的”。
- 批量上报用 `sendBeacon`，页面关闭时也能发出去；它失败（比如 body 超过 64KB 限制）再退回 `fetch` 加 `keepalive`。
- 攒 20 条或 3 秒就发一次。一开始我设的是 10 秒，结果发现移动端用户停留时间短，很多数据没发出去就关页了。

### 性能指标

性能部分不自己算，直接用 `PerformanceObserver` 拿浏览器给的 LCP、CLS、INP 和长任务，再加上 `performance.getEntriesByType('navigation')` 里的 TTFB 和 DOM 解析时间。

```ts
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      track({ type: 'perf', name: 'lcp', page: location.pathname, payload: { value: entry.startTime } })
    }
    if (entry.entryType === 'layout-shift' && !(entry as LayoutShift).hadRecentInput) {
      clsValue += (entry as LayoutShift).value
    }
    if (entry.entryType === 'longtask' && entry.duration > 100) {
      track({ type: 'perf', name: 'longtask', page: location.pathname, payload: { duration: entry.duration } })
    }
  }
})

observer.observe({ type: 'largest-contentful-paint', buffered: true })
observer.observe({ type: 'layout-shift', buffered: true })
observer.observe({ type: 'longtask', buffered: true })
```

CLS 要累加到页面隐藏时再上报一次最终值，不能每次 shift 都上报，否则后端拿到的是一堆碎片。INP 的计算比较绕，我们最后直接引了 `web-vitals` 这个库来算，自己算容易出错。

### 错误捕获

错误分四类：同步异常（`window.onerror`）、未处理的 Promise 拒绝（`unhandledrejection`）、资源加载失败（捕获阶段的 `error` 事件）、以及框架层的错误（Vue 的 `app.config.errorHandler`）。前两类大家都会写，容易漏的是后两类。资源加载失败在我们这里占了错误总量的四成，大部分是 CDN 某个节点抽风，这个信息对运维非常有用。

另一个坑是 sourcemap。线上代码是压缩过的，错误栈里全是 `a.b.c` 这种名字。我们在 CI 里构建完成后把 sourcemap 上传到内部服务，并且从产物目录里删掉，后端收到错误之后按 `release` 找到对应的 sourcemap 做还原。这一步做完之前，错误日志基本没法看。

### 行为追踪

行为追踪我们克制得很，只记三件事：页面进入和离开、关键按钮的点击（用 `data-track` 属性声明，不做全埋点）、以及接口请求的耗时和状态码。全埋点听起来很美，但数据量大十倍，真正用到的不到 5%。

## 聚合层：原始事件到指标

后端是 NestJS，收到事件先写入 ClickHouse，然后每分钟跑一次聚合任务，把原始事件按页面、版本、分钟汇总成指标表。为什么不直接查原始表？因为告警规则需要每分钟评估，直接在上亿行原始数据上算 P75 太慢了。

聚合出来的核心指标有这些：

| 指标       | 计算方式                         | 告警阈值             |
| ---------- | -------------------------------- | -------------------- |
| 错误率     | 有错误的会话数 ÷ 总会话数        | 连续 3 分钟 > 2%     |
| 新错误     | 指纹在过去 7 天没出现过的错误    | 出现即告警           |
| LCP P75    | 按页面分组的 75 分位             | 连续 5 分钟 > 2500ms |
| 接口失败率 | 状态码 ≥ 500 的请求占比          | 连续 3 分钟 > 1%     |
| 白屏率     | 进入页面 5 秒内无 LCP 的会话占比 | 连续 3 分钟 > 0.5%   |

“白屏率”这个指标是事故之后专门加的。开头那个事故如果有它，10 分钟内就能发现。

错误指纹是个值得单独说的点。同一个错误在不同用户那里栈的行号可能不一样（因为版本不同），所以我们用“错误类型 + 消息去掉数字和路径 + 栈的前三帧函数名”做 hash。这样既能把同一个 bug 归到一起，又不会把所有 TypeError 混成一团。

## 告警：少而准

告警这块我们返工了两次。第一版把所有阈值都设得很敏感，结果上线第一周群里每天几十条告警，三天之后就没人看了。第二版加了三条规则：

- **连续窗口**：单分钟超过阈值不算，要连续 N 分钟才触发，过滤抖动。
- **流量下限**：某个页面一分钟只有 3 个会话，其中 1 个报错，错误率 33% 没有意义。会话数低于 50 的窗口不参与评估。
- **收敛**：同一规则触发后 30 分钟内不重复发，恢复时发一条恢复通知。

规则用 YAML 配置，变更走代码审查，而不是在某个后台界面里点来点去：

```yaml
rules:
  - id: error-rate-high
    metric: error_rate
    groupBy: [page]
    condition: '> 0.02'
    for: 3m
    minSessions: 50
    severity: critical
    notify: [oncall-frontend]
  - id: new-error
    metric: new_error_count
    condition: '> 0'
    for: 1m
    severity: warning
    notify: [frontend-channel]
```

通知渠道分两级：critical 走电话和企业微信应用消息，warning 只进群。电话这一级一开始很多人反对，但有了那次夜间白屏事故的教训，大家都认了。

## 上线三个月之后

一些实际的数字：SDK 压缩后 6.8KB，对首屏基本没影响；每天接收大约 4000 万条事件，ClickHouse 存 30 天原始数据占了 1.2TB；聚合后的指标表保留一年。告警平均每周 4 到 6 条，其中真正需要处理的占七成左右，这个信噪比我觉得可以接受。

最有价值的不是某次抓到大事故，而是日常发版之后的那 15 分钟——看着错误率和 LCP 曲线稳住，心里才踏实。以前发版靠的是“发完去群里问问有没有人反馈”，现在是看数据说话。

还有几件没做完的事：会话回放目前只记了 DOM 快照没做回放工具，用户反馈和错误事件的关联还得人工对时间，性能预算还没接进 CI 做卡点。等下一个季度做完再写续篇。
