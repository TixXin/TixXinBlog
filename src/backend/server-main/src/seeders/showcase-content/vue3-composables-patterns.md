上个月给团队做了一次 code review 回顾，把近一年项目里的 `composables/` 目录翻了一遍，一共 63 个文件。看完的感受是：大家都会写 composable，但每个人写出来的东西长得完全不一样。有的接收 ref，有的接收普通值，有的返回对象，有的返回数组，有的在里面偷偷发请求，有的把清理工作留给调用方自己记。单个看都没问题，放在一起就变成了一座需要导游的迷宫。

这篇把我这一年踩过的坑和整理出来的几条约定写下来。不是什么权威规范，是我们团队在 Vue 3.5 和 Nuxt 4 的项目里实际用下来觉得顺手的做法。

## 参数：统一接收 MaybeRefOrGetter

最常见的分歧是参数类型。一个 `useUser(id)`，调用方可能传一个字符串，可能传一个 `ref`，也可能想传一个 `computed`。早期我们的做法是写三个重载，或者在函数里用 `isRef` 判断，代码很快就乱了。

Vue 3.3 之后有了 `MaybeRefOrGetter` 和 `toValue`，这个问题就有了标准答案：参数一律声明为 `MaybeRefOrGetter<T>`，内部需要取值的地方用 `toValue()`，需要响应的地方用 `watch(() => toValue(x))` 或者直接把 getter 丢给 `watch`。

```ts
import { ref, watch, toValue, type MaybeRefOrGetter } from 'vue'

interface UseUserOptions {
  immediate?: boolean
}

export function useUser(id: MaybeRefOrGetter<string | null>, options: UseUserOptions = {}) {
  const { immediate = true } = options
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function load() {
    const current = toValue(id)
    if (!current) {
      user.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      user.value = await $fetch<User>(`/api/users/${current}`)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  watch(() => toValue(id), load, { immediate })

  return { user, loading, error, reload: load }
}
```

这样调用方可以写 `useUser('42')`、`useUser(userId)`、`useUser(() => route.params.id as string)`，三种写法行为完全一致。我们把这条写进了 lint 规则的注释里：composable 的输入参数不接收裸 `Ref` 类型，统一用 `MaybeRefOrGetter`。

## 返回值：对象优先，只在“一对”的时候用数组

返回值的争论比参数更久。数组解构可以随意改名，`const [count, setCount] = useCounter()` 看起来很像 React，但一旦返回超过两个值，位置就变成了需要记忆的东西。我们最后定的规则是：默认返回普通对象，字段都是 `ref` 或 `computed`，调用方自己解构；只有当返回值天然是“值 + 操作”这种一对关系，并且总共就两项时，才允许返回元组。

还有一个细节是返回的对象不要用 `reactive` 包一层。`reactive` 对象解构之后会丢失响应性，调用方很容易踩坑。返回普通对象，里面每个字段单独是 `ref`，解构出去各自保持响应。如果调用方确实想要一个整体，自己 `reactive()` 一下就好。

另外，返回的 `ref` 如果不希望外部修改，用 `readonly()` 包一下。比如上面的 `loading` 和 `error`，调用方没理由去改它们，暴露成可写的只会给未来的自己埋雷。

## 副作用：谁创建，谁清理

63 个文件里有 11 个注册了事件监听、定时器或者 `ResizeObserver`，其中 4 个没有在组件卸载时清理。这个数字说明清理不是“知不知道”的问题，是“记不记得”的问题。

我们的约定是，composable 内部所有副作用必须在同一个函数里自己处理清理，不能把这个责任交给调用方。Vue 3.5 的 `onWatcherCleanup` 让 `watch` 里的清理也能就地写，比以前用 `watch` 回调的第三个参数 `onCleanup` 顺眼一些。

```ts
import { ref, watch, onWatcherCleanup, onScopeDispose, toValue, type MaybeRefOrGetter } from 'vue'

export function useElementSize(target: MaybeRefOrGetter<HTMLElement | null>) {
  const width = ref(0)
  const height = ref(0)

  watch(
    () => toValue(target),
    (el) => {
      if (!el) return
      const observer = new ResizeObserver(([entry]) => {
        width.value = entry.contentRect.width
        height.value = entry.contentRect.height
      })
      observer.observe(el)
      onWatcherCleanup(() => observer.disconnect())
    },
    { immediate: true, flush: 'post' },
  )

  onScopeDispose(() => {
    width.value = 0
    height.value = 0
  })

  return { width, height }
}
```

注意这里用的是 `onScopeDispose` 而不是 `onUnmounted`。两者在组件 `setup` 里行为一样，但 `onScopeDispose` 在 `effectScope` 里也能工作，这意味着这个 composable 可以在组件外被复用，比如在一个 Pinia store 里或者在测试里用 `effectScope()` 包起来。而 `onUnmounted` 在组件外调用会直接警告。

`flush: 'post'` 也值得说一句。`useElementSize` 接的 `target` 通常是一个 `useTemplateRef` 返回的模板引用，它要等 DOM 渲染完才有值，`post` 能保证回调在 DOM 更新之后跑。

## 异步状态：不要每个 composable 都发明一套 loading

翻完目录发现我们有七种不同的 loading 表示方式：`loading`、`isLoading`、`pending`、`status === 'loading'`、还有两个直接用 `user.value === null` 来判断。这种事情没有对错，但有成本，每个页面都要先搞清楚这个 composable 的 loading 叫什么。

我们最后统一成了一个小的内部工具 `useAsyncState`，所有发请求的 composable 都基于它。它返回 `data`、`error`、`status`（`'idle' | 'pending' | 'success' | 'error'`）和一个 `execute`。`loading` 作为一个 `computed(() => status.value === 'pending')` 顺带提供，兼容老习惯。这个东西和 VueUse 里的同名函数思路差不多，我们之所以自己写了一个不到 60 行的版本，是因为想控制它和 Nuxt 的 `useAsyncData` 之间的关系：页面级数据走 `useAsyncData` 享受 SSR 和 payload，组件内的交互型请求走 `useAsyncState`，两者不混用。

## 隐式依赖：别在 composable 里偷偷读全局

这是 review 里争议最大的一条。有不少 composable 在函数体里直接调用 `useRoute()`、`useRouter()` 或者某个 Pinia store，调用方看签名完全不知道它依赖了什么。好处是调用的时候少传参数，坏处是这个函数只能在特定的上下文里用，而且单测时必须把整个路由和 store 都模拟出来。

我们最后的规则是分两档。真正的“页面级”composable，比如 `usePostListPage`，本身就是给某个页面专用的，允许它直接读 route 和 store，因为它不打算被复用。而所有放在根 `composables/` 下的通用函数，依赖必须通过参数显式传入，哪怕只是一个 `ref<string>`。判断标准很简单：如果你想不出第二个会调用它的地方，它就是页面级的，可以偷懒；想得出，就老老实实把依赖写进签名。

还有一个相关的坑是 `useFetch`、`useAsyncData` 这类需要 Nuxt 上下文的东西，在 `await` 之后再调用会丢失实例，SSR 时直接报“nuxt instance unavailable”。我们统一要求 composable 里所有需要上下文的调用都放在第一个 `await` 之前，或者干脆不在 composable 里 `await`，把异步留给返回的 `execute` 函数去做。上面的 `useUser` 就是这样写的，`load` 本身是异步的，但 `useUser` 自己是同步返回的。

### 选项对象的默认值

参数超过两个就改用选项对象，这条大家都同意。有分歧的是默认值怎么给。我们见过 `options?.immediate ?? true` 散落在函数各处的写法，也见过在函数开头 `Object.assign({}, defaults, options)` 的写法。前者一眼看不出这个 composable 一共有哪些选项，后者会把 `undefined` 也当成有效值覆盖默认。最后统一成了解构加默认值，就像前面 `useUser` 里那样，所有选项在函数头部一行列清楚，`undefined` 自然落到默认值上，类型推导也最干净。

## 命名和文件组织

几条小约定，列出来省得以后翻聊天记录：

- 文件名和导出函数名一致，一个文件一个主 composable，`useFoo.ts` 导出 `useFoo`。
- 只在特定 feature 里用的 composable 放在 `features/<domain>/composables/`，跨 feature 的才放根 `composables/`。我们清理之后根目录从 63 个减到了 19 个。
- 不以 `use` 开头的纯函数不算 composable，不放这个目录，放 `utils/`。判断标准是“里面有没有用到响应式 API 或生命周期钩子”。
- 类型定义放在 `features/<domain>/types.ts`，composable 文件里只 import 不声明。

| 情况           | 位置                             | 例子                              |
| -------------- | -------------------------------- | --------------------------------- |
| 跨业务通用     | `app/composables/`               | `useElementSize`、`useAsyncState` |
| 业务专属       | `app/features/post/composables/` | `usePostEditor`                   |
| 无响应式的工具 | `app/utils/`                     | `formatDate`                      |

## 测试：用 effectScope 包起来跑

composable 的单测以前要么挂一个空组件，要么干脆不测。现在统一用 `effectScope` 加 Vitest，不依赖 Vue Test Utils：

```ts
import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useUser } from '~/composables/useUser'

describe('useUser', () => {
  it('在 id 变化时重新加载', async () => {
    const id = ref<string | null>('1')
    const scope = effectScope()
    const result = scope.run(() => useUser(id, { immediate: false }))!

    id.value = '2'
    await nextTick()
    expect(result.loading.value).toBe(true)

    scope.stop()
  })
})
```

`scope.stop()` 会触发 `onScopeDispose`，所以清理逻辑也能在测试里验证。这也是前面坚持用 `onScopeDispose` 的另一个原因。

这些约定定下来之后，新同事写的第一个 composable 直接就和老代码长得一样了，review 的时候不用再讨论“这个参数应该收 ref 还是值”这种问题。规范最大的价值不是让代码更好看，是把那些每次都要重新决定一遍的小事变成不用决定的事。63 个文件的清理花了我们两个下午，值。
