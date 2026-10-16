去年给博客的编辑器加撤销栈的时候，我被一个诡异的现象卡了一下午：往 `reactive` 数组里 `push` 一条记录，依赖它的计算属性更新了，但另一个只读 `length` 的 `watch` 却没触发。最后翻源码才发现是自己对“依赖收集到底收集了什么”理解有偏差。那次之后我把 `@vue/reactivity` 这个包从头到尾读了一遍，这篇文章算是把当时的笔记整理出来。

Vue 3 的响应式系统本质上就三件事：拦截读写、记录谁读了什么、写的时候通知谁。听起来简单，但每一步里都有不少取舍。下面我按这三步来拆。

## 为什么是 Proxy 而不是 defineProperty

Vue 2 用 `Object.defineProperty` 把对象的每个属性都改写成 getter/setter，这带来几个绕不开的限制：新增属性没法被监听（所以有 `Vue.set`），数组下标赋值监听不到（所以要重写 7 个数组方法），初始化时还得递归遍历整个对象，大对象的开销不小。

`Proxy` 是在对象外面套一层代理，拦截的是“操作”而不是“属性”。`get`、`set`、`has`、`deleteProperty`、`ownKeys` 这些 trap 覆盖了几乎所有访问方式，`for...in`、`in` 操作符、`delete` 都能感知。更关键的是它是惰性的：只有真正访问到某个嵌套属性，才会把那个嵌套对象也包一层。

```ts
import { reactive, effect } from '@vue/reactivity'

const state = reactive({ todos: [] as string[], meta: { draft: true } })

effect(() => {
  console.log('count:', state.todos.length)
})

state.todos.push('写文章') // count: 1，新增下标和 length 都被捕获
```

这段在 Vue 2 里是行不通的，`push` 能工作只是因为数组方法被打了补丁。Vue 3 里它天然成立，因为 `push` 内部会读 `length`、写下标、再写 `length`，每一步都走 trap。

和 `Proxy` 搭配的是 `Reflect`。源码里几乎所有 trap 都用 `Reflect.get(target, key, receiver)` 而不是直接 `target[key]`，原因是 `receiver` 参数能保证 getter 里的 `this` 指向代理对象而不是原始对象。不传 `receiver`，访问器属性内部读到的 `this.xxx` 就不会被收集，依赖就断了。

## 依赖收集：从 targetMap 到 Dep

全局有一张 `WeakMap`，键是原始对象，值是另一张 `Map`，键是属性名，值是一个 `Dep`。`Dep` 里挂着所有订阅它的副作用。用 `WeakMap` 是为了对象被回收时不用手动清理。

`effect` 执行时会把当前副作用放到一个全局变量 `activeSub` 上，然后运行传入的函数。函数内部每次触发 `get` trap，`track` 就把 `activeSub` 挂到对应的 `Dep` 上。这就是“读的时候知道谁在读”的全部秘密。

3.5 之前的实现是双向的 `Set`：`Dep` 持有一组 `effect`，`effect` 也持有一组 `Dep`，每次重新运行前先清空自己在所有 `Dep` 里的记录，再重新收集。这种做法正确但浪费，大多数时候依赖根本没变。3.5 把这部分换成了双向链表加版本号的结构，每个 `effect` 到 `Dep` 的连接是一个 `Link` 节点，重新执行时只比较版本号，没变的链接直接复用。官方公布的数字是内存占用降低约 56%，我在博客的管理后台用 Chrome 的内存快照对比过，一个有四百来行表格的页面，响应式相关对象从 3.1MB 降到了 1.4MB，和官方数字基本对得上。

```ts
// 简化后的 track，去掉了 __DEV__ 分支
function track(target: object, key: unknown) {
  if (!activeSub || !shouldTrack) return
  let depsMap = targetMap.get(target)
  if (!depsMap) targetMap.set(target, (depsMap = new Map()))
  let dep = depsMap.get(key)
  if (!dep) depsMap.set(key, (dep = new Dep()))
  dep.track()
}
```

回到开头那个 bug：我当时的 `watch` 写的是 `watch(() => list, ...)`，`list` 本身是一个 `reactive` 对象，访问它不会触发任何属性的 `get`，自然没有依赖。要么访问 `list.length`，要么加 `{ deep: true }`。这是“收集的是属性访问而不是对象”这条规则最常见的坑。

## 触发更新：trigger 的几种情况

写操作比读复杂，因为要判断“哪些依赖受影响”。`set` trap 里会先比较新旧值，相同就直接返回，避免无意义的更新。然后区分是新增属性还是修改属性：新增会额外触发 `ITERATE_KEY`，让 `for...in` 和 `Object.keys` 这类遍历重新执行；数组还要特殊处理 `length`，比如 `arr.length = 0` 要触发所有下标大于等于新长度的依赖。

`Map` 和 `Set` 走的是另一套 `collectionHandlers`，因为它们的 `get`、`has`、`size` 都是原型方法而不是属性访问，必须把方法本身替换掉，在替换版本里手动调用 `track` 和 `trigger`。

触发时并不是立刻执行副作用，而是先推进一个队列，等本轮同步代码结束后批量跑。这就是 `nextTick` 的由来，也是为什么连续改十次状态只会渲染一次。3.5 之后批处理用的是 `startBatch`/`endBatch` 这一对函数，在同一个批次里被多次标脏的副作用只会跑一次，而且会按依赖关系排序，保证 `computed` 在依赖它的 `effect` 之前重算。

## computed 为什么是“懒”的

`computed` 本身既是订阅者又是被订阅者。它订阅自己的依赖，又被模板或其他副作用订阅。它不会在依赖变化时立刻重算，只是把自己标成脏，等下次有人读它的 `.value` 才真正执行。这对 Vue 2 用户不陌生，但 3.4 之后有一个重要改进：重算完如果结果和上次相同，就不会继续向下通知。

我用这个特性优化过文章列表的筛选。筛选条件是一个响应式对象，列表是一个 `computed`，以前只要条件对象的任何字段改动都会导致列表组件重渲染，哪怕筛出来的结果一模一样。升级到 3.4 之后，相同结果不再往下传，列表组件的渲染次数从每次输入一次变成只在结果真正变化时渲染，输入框打字的卡顿感直接消失了。

```ts
const filtered = computed(() => posts.value.filter((p) => p.title.includes(keyword.value.trim())))
// keyword 从 'vue' 变成 'vue ' 时，trim 后一样，filtered 不会通知下游
```

要注意这个判断用的是 `Object.is`，数组每次 `filter` 都是新引用，所以上面例子里还是会通知。实际做法是在 `computed` 里返回 id 列表再拼回去，或者用 `shallowRef` 加手动比较。细节不多展开了。

## 从 alien-signals 看 3.6 的方向

今年 Vue 3.6 的响应式核心又重写了一次，这次直接借鉴了 Johnson Chu 的 alien-signals，把 `Dep`、`Link`、`Subscriber` 这些结构进一步扁平化，减少了对象分配，同时把“推送脏标记”和“拉取求值”两个阶段分得更干净。我在升级后跑了一下博客首页的 hydration 耗时，从 48ms 降到 39ms，测的次数不多，但方向是对的。

读源码的时候我一直在想一个问题：响应式系统到底该不该让用户感知到？Vue 的答案是尽量不感知，`reactive` 一个对象之后像普通对象那样用就行。代价是你得知道边界在哪，比如解构会丢失响应性，`Proxy` 不能代理原始值所以才有 `ref`，`WeakMap` 的键必须是对象所以 `reactive(1)` 直接返回原值。这些“坑”其实都是设计取舍留下的痕迹，顺着取舍去理解，比死记规则要牢靠得多。

下次再遇到“为什么没更新”的问题，先问自己三句：读的时候 `activeSub` 在不在？读的是属性还是对象本身？写的时候新旧值是不是被判成相等了？大概率答案就在其中一句里。
