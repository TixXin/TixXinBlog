上周面一个候选人，问他 `setTimeout(fn, 0)` 和 `setImmediate(fn)` 谁先执行，他说 `setTimeout`，我说不一定，他愣了一下。这个问题其实我自己也是两年前才真正搞清楚的，之前的理解都停留在“宏任务微任务”这种浏览器语境的说法上，而 Node 的事件循环和浏览器的根本不是一回事。这篇把我理解的版本写下来，顺便把几个经典的顺序题跑一遍。

先划清边界：这篇说的是 Node.js 的事件循环，也就是 libuv 实现的那一套，和浏览器 HTML 规范里的 event loop 是两套独立的东西，只是概念上相似。文中代码在 Node 22 和 24 上跑过，更老的版本（11 之前）在 timers 阶段的行为不一样，后面会提。

## 两个引擎，各管一摊

Node 的运行时主要由两个部分组成。V8 负责执行 JavaScript，它只管单线程跑代码，不知道什么叫文件、网络、定时器。libuv 负责和操作系统打交道，提供异步 I/O、定时器、线程池，并且实现了事件循环。两者之间通过 Node 的 C++ 绑定层连接。

一个关键的认知是：事件循环不在 V8 里，在 libuv 里。V8 只提供了一个东西和异步相关，就是 microtask 队列（Promise 的回调放在这里）。而 `process.nextTick` 既不是 V8 的也不是 libuv 的，它是 Node 自己在 JavaScript 层实现的一个队列。所以严格来说 Node 里有三类“队列”：libuv 的各阶段回调队列、Node 的 nextTick 队列、V8 的 microtask 队列。搞清楚这三者的关系，顺序题就都能推出来。

## 六个阶段

libuv 的一轮循环（一个 tick）按固定顺序走六个阶段，每个阶段有自己的回调队列，进入该阶段就把队列里的回调依次执行完（或者执行到上限）再进下一个阶段：

| 阶段              | 做什么                                                    |
| ----------------- | --------------------------------------------------------- |
| timers            | 执行到期的 `setTimeout` 和 `setInterval` 回调             |
| pending callbacks | 执行上一轮推迟到这一轮的 I/O 回调，主要是一些系统错误回调 |
| idle, prepare     | libuv 内部用，JavaScript 层接触不到                       |
| poll              | 计算要阻塞多久，然后等待并处理 I/O 事件，执行 I/O 回调    |
| check             | 执行 `setImmediate` 回调                                  |
| close callbacks   | 执行 `socket.on('close')` 这类关闭回调                    |

日常写代码真正会接触的是 timers、poll 和 check 这三个。poll 阶段是循环的心脏：如果没有到期的定时器也没有 `setImmediate`，它会在这里阻塞等待 I/O，直到有事件来或者最近的定时器到期。这就是为什么一个空闲的 Node 服务 CPU 占用接近零，它在 poll 阶段睡着。

timers 阶段有一个容易误解的地方：`setTimeout(fn, 0)` 实际上是 `setTimeout(fn, 1)`，Node 会把小于 1 的延迟强制改成 1 毫秒。而且 timers 阶段只是“检查有没有到期的”，到期了才执行，所以定时器的回调时间只是一个下限，不是精确值。

## nextTick 和 microtask 插在哪里

这是整个话题最核心的一点。nextTick 队列和 microtask 队列不属于六个阶段中的任何一个，它们在每一次从 C++ 层回到 JavaScript 层之后被清空。具体规则是：

1. 当前的 JavaScript 执行栈清空后（比如主模块执行完，或者某个阶段的一个回调执行完）。
2. 先把 nextTick 队列全部清空。
3. 再把 microtask 队列全部清空。
4. 如果清空过程中又产生了新的 nextTick 或 microtask，继续清，直到两个队列都为空。
5. 然后才继续事件循环的下一个回调或下一个阶段。

所以 `process.nextTick` 比 Promise 回调还要早，而且两者都在任何定时器、I/O、`setImmediate` 之前。写个例子验证：

```js
setTimeout(() => console.log('timeout'), 0)
setImmediate(() => console.log('immediate'))
Promise.resolve().then(() => console.log('promise'))
process.nextTick(() => console.log('nextTick'))
console.log('sync')
```

输出固定是：

```text
sync
nextTick
promise
timeout
immediate
```

前三行没有任何悬念。最后两行在主模块里理论上是不确定的，因为主模块执行完进入事件循环时，1 毫秒的定时器可能到期也可能没到期，取决于进程启动的耗时。实际在我的机器上跑一百次，`timeout` 先出来的概率在九成以上，但偶尔会反过来。这就是开头那个面试题的答案：不一定。

## I/O 回调里的顺序是确定的

把同样的两行放进一个 I/O 回调里，结果就确定了：

```js
const fs = require('node:fs')

fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0)
  setImmediate(() => console.log('immediate'))
})
```

这里 `immediate` 一定先于 `timeout`。原因是 `readFile` 的回调在 poll 阶段执行，poll 之后紧接着就是 check 阶段，`setImmediate` 在这里被执行；而 `setTimeout` 要等到下一轮循环的 timers 阶段。这个特性在实际代码里很有用：如果你想在 I/O 回调之后“尽快但不是同步地”做一件事，`setImmediate` 比 `setTimeout(fn, 0)` 更可靠也更便宜。

## Node 11 之前和之后

一个历史细节。在 Node 11 之前，timers 阶段和 check 阶段是把队列里的所有回调执行完才清一次 nextTick 和 microtask。从 11 开始改成了每执行完一个回调就清一次，和浏览器的行为对齐。看这段代码：

```js
setTimeout(() => {
  console.log('timeout 1')
  Promise.resolve().then(() => console.log('promise 1'))
}, 0)
setTimeout(() => {
  console.log('timeout 2')
  Promise.resolve().then(() => console.log('promise 2'))
}, 0)
```

现在的输出是 `timeout 1、promise 1、timeout 2、promise 2`。Node 10 会输出 `timeout 1、timeout 2、promise 1、promise 2`。网上不少文章还是老版本的说法，看到的时候注意一下日期。

## 线程池：异步不等于多线程，但有些是

还有一个常见的误解是“Node 是单线程的”。JavaScript 的执行确实是单线程，但 libuv 后面有一个默认 4 个线程的线程池，`fs` 模块的大部分操作、`dns.lookup`、`crypto.pbkdf2` 这类 CPU 密集的加密函数，还有 `zlib`，都是丢给线程池做的。而网络 I/O 不走线程池，直接用操作系统的 epoll、kqueue 或者 IOCP。

这个区别在实际中的影响是：如果你在一个请求里调用了四次 `crypto.pbkdf2`，线程池就满了，第五个文件读取要排队。线程池大小可以通过 `UV_THREADPOOL_SIZE` 环境变量调，上限 1024，但要在任何 libuv 操作发生之前设置。我们生产环境有一个服务因为密码哈希并发量大，把它调到了 16，p99 延迟从 480 毫秒降到了 90 毫秒左右。

## 一个实际的坑：nextTick 饿死循环

`process.nextTick` 的回调会在进入下一个阶段之前被清空，而且如果 nextTick 回调里又注册了 nextTick，会继续清。这意味着递归调用 `nextTick` 会让事件循环永远进不了 poll 阶段，所有 I/O 都被饿死：

```js
function spin() {
  process.nextTick(spin)
}
spin()
setTimeout(() => console.log('永远不会打印'), 100)
```

同样的递归换成 `setImmediate` 就没问题，因为 `setImmediate` 回调在 check 阶段执行，每轮只执行当前已经注册的那些，新注册的留到下一轮，poll 阶段仍然有机会跑。这也是官方文档建议“大多数情况下用 `setImmediate`，`nextTick` 只在确实需要在当前操作完成后、任何 I/O 之前执行时才用”的原因。实际工作里我用 `nextTick` 的场景只有一种：在构造函数或者同步代码里需要触发一个事件，但要保证监听者有机会先注册上。

把这些串起来，再看任何顺序题就都有了推导的路径：先同步代码，然后 nextTick，然后 microtask，然后看当前在哪个阶段，按六个阶段的顺序往下走，每个回调执行完再清一次 nextTick 和 microtask。候选人那道题我后来给他讲了一遍，他问为什么不干脆把 `setTimeout(fn, 0)` 也设计成确定的，我说这就是 libuv 的设计，定时器永远是下限，想要确定就用 `setImmediate`。这个回答我觉得比背出“宏任务微任务”更有用一些。
