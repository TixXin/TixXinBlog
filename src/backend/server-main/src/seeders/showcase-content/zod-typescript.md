博客后台有一个很老的 bug：编辑文章的时候如果把“阅读时长”这个字段清空，保存会成功，但列表页上会显示“NaN 分钟”。原因不复杂，前端把空字符串发了过去，后端的 DTO 是用 class-validator 装饰器校验的，而那个字段漏了装饰器。这类问题在类型层面是看不出来的，TypeScript 只能保证编译时的形状，运行时从网络过来的东西它一概不管。

这个月我把后台所有表单和接口的校验都换成了 Zod，顺便把前后端共用的那部分 schema 抽成了一个包。写这篇的时候 Zod 4 已经发布快一年，和 3 的差别不小，文中代码都是 4 的写法。

## 为什么是运行时校验

TypeScript 的类型在编译后会被完全抹掉，所以 `function save(post: Post)` 这个签名对运行时没有任何约束。来自 HTTP 请求体、`localStorage`、第三方 API 响应、URL 查询参数的数据，全部是 `unknown`，需要有人在边界处验证一遍再放进来。

验证的方式有几种：手写 if 判断，用 JSON Schema 加 Ajv，用装饰器式的 class-validator，或者用 Zod 这类 schema-first 的库。手写的问题是类型和校验逻辑是两份代码，改一处忘另一处。JSON Schema 的问题是它是 JSON，不是 TypeScript，类型要靠生成。class-validator 要写类，和 Vue 这边的纯对象风格不太搭，而且装饰器漏一个就是开头那个 bug。

Zod 的做法是反过来：先写 schema，类型从 schema 推出来。只有一份真相。

```ts
import { z } from 'zod'

export const postSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/, '只能包含小写字母、数字和连字符'),
  summary: z.string().trim().max(300).optional(),
  readTime: z.coerce.number().int().positive().max(120),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  publishedOn: z.iso.date().nullable().default(null),
  status: z.enum(['draft', 'published', 'archived']),
})

export type PostInput = z.input<typeof postSchema>
export type Post = z.output<typeof postSchema>
```

开头那个 bug 在这里直接被 `readTime` 这一行解决了：`z.coerce.number()` 会把空字符串转成 `0`，然后 `.positive()` 拒绝它，返回一条清楚的错误。注意 `z.input` 和 `z.output` 是两个不同的类型，前者是校验前的形状（`readTime` 可以是字符串，`tags` 可以不传），后者是校验后的（`readTime` 一定是数字，`tags` 一定是数组）。表单组件用 `PostInput`，业务逻辑用 `Post`。

Zod 4 把字符串格式从方法改成了顶层函数，`z.string().email()` 变成了 `z.email()`，日期是 `z.iso.date()`。老写法还能用但会有弃用提示，新项目直接用新的。

## 前后端共用一份 schema

这个仓库前端是 Nuxt，后端是 NestJS，都是 TypeScript，所以 schema 可以放在一个共享目录里两边 import。前端在表单提交之前跑一次 `safeParse`，把错误显示在对应的字段旁边；后端在控制器入口再跑一次，不信任任何客户端。

后端这边我写了一个很薄的 NestJS 管道，替换掉原来的 `ValidationPipe`：

```ts
import { BadRequestException, type PipeTransform } from '@nestjs/common'
import { z, type ZodType } from 'zod'

export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        message: '请求参数不合法',
        errors: z.flattenError(result.error).fieldErrors,
      })
    }
    return result.data
  }
}
```

控制器里 `@Body(new ZodPipe(postSchema)) body: Post` 就行。`z.flattenError` 是 Zod 4 新加的顶层函数，把错误整理成 `{ fieldErrors: { title: ['标题不能为空'] } }` 这种形状，前端拿到之后直接按字段名显示。如果嵌套比较深，`z.treeifyError` 会给出树形结构，不过我们的表单都比较平，`flattenError` 够用。

前端表单组件里的用法：

```ts
const errors = ref<Record<string, string[]>>({})

function validate(form: PostInput) {
  const result = postSchema.safeParse(form)
  errors.value = result.success ? {} : z.flattenError(result.error).fieldErrors
  return result.success ? result.data : null
}
```

同一个 `postSchema`，同一套错误文案，前端提示和后端拒绝的理由一字不差。以前两边各写一套的时候，经常出现前端放过去、后端打回来，用户看到一个不知所云的“参数错误”。

## 几个用得顺手的细节

**`z.discriminatedUnion`。** 图库的媒体来源分受管上传和外链两种，字段完全不同。用普通 `z.union` 校验失败时错误信息会把两个分支的错误全列出来，很难读。`discriminatedUnion('kind', [...])` 按 `kind` 字段先分流，错误只报对应分支的，而且 TypeScript 的类型收窄也更准。

**`.transform()` 和 `.pipe()`。** 查询参数全是字符串，`?page=2&tags=a,b` 这种，用 `z.string().transform((s) => s.split(',')).pipe(z.array(z.string()).max(10))` 先转换再校验，比手写解析清爽。

**`.brand()`。** 文章 ID 和用户 ID 都是字符串，以前有过传错的 bug。`z.string().uuid().brand<'PostId'>()` 推出来的类型带品牌标记，两种 ID 在类型层面不再兼容，传错直接编译报错。

**Zod 4 的性能。** 升级后我顺手测了一下，后台的内容包导入会对几千条记录逐条校验，3 的时候大概 420 毫秒，4 降到了 110 毫秒左右。官方说的提升幅度比这个还大，我的数据量小，差异没那么夸张，但确实能感觉到。

## 不只是校验请求，也校验响应

一开始我只把 Zod 用在请求入口，后来发现另一个方向同样有价值：校验从外面来的响应。博客有一个订阅费统计的功能，会去调博主开通的几个平台的接口拿账单数据，这些接口的返回格式三天两头变，字段改名、数字变成字符串、某个嵌套对象突然变成 `null`，每次都是上线之后才发现页面空了。

现在每个外部接口的响应都对应一个 schema，拿到数据先 `safeParse`，失败就记一条带平台名和错误详情的日志然后跳过这条记录，而不是让整个统计任务挂掉。上个月有一个平台把金额字段从数字改成了字符串，日志当天就报出来了，我加了一个 `z.coerce.number()` 十分钟修好。换成以前，大概率是用户发现图表少了一块才有人知道。

前端这边也一样，`useFetch` 拿到的数据我现在习惯过一遍 schema 再放进状态里。多花几毫秒，换来的是状态里的数据形状百分之百可信，组件里不用再写一堆 `?.` 和 `??`。

## 从 class-validator 迁移的过程

迁移花了大概两个周末，没有一次性全换，而是按模块来。先挑了文章和图库这两个表单最多、bug 最多的模块，剩下的模块两套校验并存了两个星期，确认没问题后再逐个替换。中间最花时间的不是写 schema，是把原来散落在各处的校验规则找出来：有的在装饰器里，有的在 service 的 if 判断里，有的只在前端做了。收拢到一份 schema 之后，这些隐性规则第一次有了一个能看全的地方，顺手还发现了三处前后端规则不一致。

## 用下来的保留意见

Zod 不是没有代价。schema 本身的 TypeScript 推导比较重，一个大 schema 文件能让编辑器的类型提示明显变慢，4 比 3 好了不少但还是有感觉。我的做法是大 schema 拆小，然后用 `z.object({...}).extend()` 组合。

另一个是错误文案。Zod 默认的错误信息是英文的，而且比较技术化，比如“Invalid input: expected string, received number”。给用户看的文案得每条自己写，或者用 `z.config()` 配一个全局的中文 locale。Zod 4 内置了 `zh-CN` 的 locale，`z.config(z.locales.zhCN())` 一行就能切换，比 3 的时候要自己写 errorMap 省事很多。

还有一个取舍是，共享 schema 意味着前后端对同一个字段的要求必须一致。有时候前端想宽松一点（允许草稿只填标题），后端想严格一点。我们的解法是 schema 分两层，`postDraftSchema` 大部分字段 `optional`，`postSchema` 用 `.required()` 收紧，发布动作用后者。

把校验这件事从“每个接口各管各的”变成“一份 schema 两边跑”之后，开头那种 NaN 分钟的 bug 一个月没有再出现过。更明显的变化是写新接口的流程变了：先写 schema，类型自然就有了，然后再写逻辑。这个顺序比以前先写类型再补校验要顺得多，因为校验这一步再也不会被忘掉。
