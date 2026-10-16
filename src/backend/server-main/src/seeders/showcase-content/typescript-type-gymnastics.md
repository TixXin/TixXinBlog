上个月给博客的后台写表单校验，想做一个东西：传入一个对象的类型，自动推导出每个字段对应的校验规则类型，字符串字段只能配字符串规则，数字字段只能配数字规则。写到一半发现自己在 TypeScript 的类型系统里绕了三层，终于理解了为什么大家管这个叫“体操”。

这篇不打算从语法讲起，而是用几个我实际写过的类型来串，每个都从一个具体的需求出发。看的时候建议开一个 TS Playground 跟着敲，类型编程这东西光看不敲是学不会的。环境是 TypeScript 5.9，文中的写法在 5.0 之后应该都能跑。

## 从一个路径类型开始

博客的 API 封装里有个函数 `request(path, params)`，我希望 `path` 的参数能从路径字符串里推出来：传 `/posts/:slug/comments/:id` 就要求 `params` 有 `slug` 和 `id` 两个字段。这是模板字面量类型最典型的用武之地。

```ts
type ExtractParams<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ExtractParams<Rest>]: string }
  : Path extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<never, never>

type P = ExtractParams<'/posts/:slug/comments/:id'>
// { slug: string; id: string }
```

逐层拆：第一个条件匹配“冒号开头的一段，后面还有斜杠”，`infer Param` 把冒号到斜杠之间的部分抓出来，`infer Rest` 抓剩下的，然后递归处理 `Rest`。第二个条件处理最后一段没有斜杠的情况。两个都不匹配就返回空对象。

有两个细节值得说。`${string}:${infer Param}` 里第一个 `${string}` 是贪婪还是惰性的？答案是惰性的，它会匹配到第一个冒号为止，这是模板字面量类型推断的规则，和正则不一样。另一个是 `Record<never, never>` 而不是 `{}`，因为 `{}` 在 TypeScript 里表示“任何非空值”，拿来当空对象会让后面的交叉类型行为很奇怪。

## 条件类型的分发

条件类型里最容易踩的坑是分发。当泛型参数是“裸类型参数”时，联合类型会被拆开逐个判断再合并。这个特性有时候是你想要的，有时候不是。

```ts
type ToArray<T> = T extends unknown ? T[] : never
type A = ToArray<string | number> // string[] | number[]

type ToArrayNoDist<T> = [T] extends [unknown] ? T[] : never
type B = ToArrayNoDist<string | number> // (string | number)[]
```

用元组包一层就能关掉分发。我在写“判断一个类型是不是联合类型”的工具时用过这个技巧：把 `T` 分发一次再和原来的 `T` 比，如果分发后的每一项都能赋给原 `T` 但反过来不行，那它就是联合。

我在博客里真正用到分发的地方是评论状态。评论有 `pending`、`approved`、`spam` 三种状态，前台只展示 `approved`，后台要全部展示。我把状态定义成联合，再用一个分发的条件类型把“前台可见的状态”从联合里筛出来，这样后端加一个新状态时，前台的类型会自动把它排除在外，不会误显示。这比手写两份状态列表要可靠，因为两份列表迟早会有一份忘了更新。

分发还有一个常被忽略的后果：`never` 作为空联合，分发之后什么都不剩，结果就是 `never`。所以 `IsNever<T> = T extends never ? true : false` 永远返回 `never` 而不是 `true`，正确写法是 `[T] extends [never]`。

## 回到开头的表单校验

有了上面两样工具，开头的需求就能写了。目标是这样的：

```ts
interface SiteSettings {
  title: string
  postsPerPage: number
  showStats: boolean
}

type RuleFor<T> = T extends string
  ? { minLength?: number; maxLength?: number; pattern?: RegExp }
  : T extends number
    ? { min?: number; max?: number; integer?: boolean }
    : T extends boolean
      ? { required?: boolean }
      : never

type Rules<T> = { [K in keyof T]?: RuleFor<T[K]> }

const rules: Rules<SiteSettings> = {
  title: { maxLength: 60 },
  postsPerPage: { min: 1, max: 50, integer: true },
  showStats: { required: true },
}
```

写错字段类型，比如给 `title` 配 `min`，编辑器会直接标红。这里 `RuleFor` 本身会分发，但在映射类型里每个 `T[K]` 都是单一类型，分发反而刚好。如果某个字段是 `string | null`，分发会给出 `RuleFor<string> | RuleFor<null>`，后者是 `never`，联合之后又回到 `RuleFor<string>`，结果仍然正确。

真正让我卡住的是可选字段。`postsPerPage?: number` 的 `T[K]` 是 `number | undefined`，`undefined` 分发出来是 `never`，看起来没问题，但如果规则对象本身要区分“字段可选”和“字段必填”，就得用 `-?` 和 `+?` 修饰符先把可选性剥掉再处理。这块的代码就不贴了，比上面长一倍，思路是先用 `{ [K in keyof T]-?: ... }` 去掉可选，再用一个辅助类型把可选键挑出来单独加规则。

## 键重映射和 satisfies

映射类型里的 `as` 子句是 4.1 加的，但我直到去年才真正用上。需求是把一个事件表 `{ click: MouseEvent; keydown: KeyboardEvent }` 变成监听器对象 `{ onClick: (e: MouseEvent) => void; onKeydown: ... }`。以前要手写两份，现在一个映射就够：

```ts
type Listeners<E> = {
  [K in keyof E as `on${Capitalize<K & string>}`]?: (event: E[K]) => void
}
```

`K & string` 是为了把 `symbol` 和 `number` 类型的键排除掉，`Capitalize` 是内置的字符串工具类型，和 `Uppercase`、`Lowercase`、`Uncapitalize` 一组。`as` 后面返回 `never` 的键会被整个过滤掉，所以它也能当筛选器用，比如只保留以 `on` 开头的键。

另一个值得单独说的是 `satisfies`。它解决的是“我想检查一个字面量符合某个类型，但又不想让它的类型被拓宽成那个类型”的问题。博客的主题配置就是这样：

```ts
const themes = {
  nexus: { primary: '#2563eb', radius: 8 },
  paper: { primary: '#b45309', radius: 2 },
} satisfies Record<string, { primary: string; radius: number }>

themes.nexus.radius // 类型是 number，而且 themes 的键是 'nexus' | 'paper'
```

如果写成 `const themes: Record<string, ...>`，键的信息就丢了，`themes.foo` 不会报错。用 `satisfies` 既校验了结构，又保留了字面量的精确类型。这个关键字出现之后，我项目里大概一半的 `as const` 都被它替代了。

## 几个常用的工具

写多了会积累一些自己的工具类型，我放在 `shared/types.ts` 里反复用的有这几个：

```ts
// 展开交叉类型，让编辑器提示更可读
type Prettify<T> = { [K in keyof T]: T[K] } & {}

// 深层只读
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

// 从联合类型里挑出带某个 kind 的成员
type PickByKind<U, K extends string> = U extends { kind: K } ? U : never
```

`Prettify` 看起来什么都没做，但把 `A & B & C` 变成一个扁平的对象类型，鼠标悬停时能看到所有字段，这对排查类型错误帮助很大。`DeepReadonly` 里那个函数判断是必须的，不然函数类型也会被当成对象递归展开，结果是一堆 `readonly` 的 `apply`、`call` 属性。

## 体操该停在哪里

类型编程有一种魔力，写顺手之后会想把所有约束都塞进类型里。我后来给自己定了两条线。

一条是编译时间。博客的前端 `tsc --noEmit` 本来 8 秒，我有一次把一个递归类型写得太深，涨到 40 多秒，`vue-tsc` 在编辑器里的提示也开始卡顿。递归类型要有明确的终止条件，深度最好不超过 10 层，TypeScript 对递归有上限，而且接近上限时性能会急剧下降。

另一条是可读性。一个类型如果需要三行以上的注释才能解释清楚，它多半应该拆成几个小类型，或者干脆退回到运行时校验。类型是给人看的，不是用来炫技的。上面那个表单校验的类型，我最终版本比文中的多了一倍长，因为要处理可选字段和嵌套对象，但我给每一段都起了名字，`OptionalKeys`、`RequiredRules`、`OptionalRules`，拼起来的时候一眼能看懂。

类型体操这个词听起来像是花活，但对我来说它的价值很实际：那个校验规则对象在重构 `SiteSettings` 的时候拦住了三处漏改的字段。花一个下午写的类型，省下的是以后每一次改动时的担心。
