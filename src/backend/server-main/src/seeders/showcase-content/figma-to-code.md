上个月我们团队接了一个后台改版的活，设计师在 Figma 里画了 60 多个页面，我负责把它们变成 Vue 组件。前两周过得很狼狈：设计稿里同一个“主按钮”出现了三种蓝，间距一会儿 12px 一会儿 14px，我每做一个页面都要回头问设计师“这个到底是哪个”。做到第十几个页面的时候我停下来想，这事不能再靠肉眼对照了，得把设计和代码之间的映射关系固定下来。

这篇文章记录的就是这一个多月里我们摸索出来的做法。不算什么高深的方法论，但确实把还原效率拉上去了：改版后期一个中等复杂度的页面，从设计稿到可以提测的组件，平均用时从一天半压到了半天以内。

## 先对齐“词汇表”，再谈还原

设计稿还原慢，根子上是设计和代码说的不是一种语言。设计师脑子里是“主色”“次要文字”“卡片间距”，我拿到的却是 `#2563EB`、`rgba(0,0,0,0.65)`、`14px`。中间缺一层翻译，所以每次都得现场猜。

我们做的第一件事是让设计师在 Figma 里把 Variables 整理出来。Figma 这两年的变量功能已经比较成熟了，颜色、数字、字符串都能定义，而且可以分 Collection 和 Mode。我们约定了三层结构：

- **基础层**：`blue/500`、`gray/700`、`space/4` 这类原始值，只有设计系统维护者会碰。
- **语义层**：`color/primary`、`color/text-secondary`、`space/card-gap`，引用基础层，这是设计师日常画图用的。
- **组件层**：`button/bg-primary`、`input/border-focus`，引用语义层，数量不多，只给真正有必要单独调的组件用。

前端这边照着同样的三层写 CSS 自定义属性。语义层的名字和 Figma 里一模一样，只是把斜杠换成横线：

```css
:root {
  /* 基础层 */
  --blue-500: #2563eb;
  --blue-600: #1d4ed8;
  --gray-700: #374151;
  --space-4: 16px;

  /* 语义层，名字与 Figma Variables 一致 */
  --color-primary: var(--blue-500);
  --color-primary-hover: var(--blue-600);
  --color-text-secondary: var(--gray-700);
  --space-card-gap: var(--space-4);
}

:root[data-theme='dark'] {
  --color-primary: #3b82f6;
  --color-text-secondary: #9ca3af;
}
```

有了这层对应，设计师在 Figma 里选的是 `color/text-secondary`，我在代码里写的就是 `var(--color-text-secondary)`，谁也不用再记十六进制。更重要的是，暗色模式在 Figma 里是一个 Mode，在代码里是一个 `data-theme` 属性，两边的切换逻辑是对称的。

## 让 Token 自动流过来

名字对齐之后，下一个问题是值怎么同步。手抄肯定不行，设计师调一次主色，我这边要跟着改一次，迟早漏掉。

我们用 Figma 的 REST API 把 Variables 拉下来，经过一个很小的脚本转成 JSON，再交给 Style Dictionary 生成 CSS 文件。整个流程跑在 CI 里，设计师发布了新版本，前端仓库会自动收到一个 PR。核心脚本大概长这样：

```ts
// scripts/sync-tokens.ts
import { writeFile } from 'node:fs/promises'

const FILE_KEY = process.env.FIGMA_FILE_KEY!
const TOKEN = process.env.FIGMA_TOKEN!

interface FigmaVariable {
  name: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, unknown>
}

function toCssName(name: string) {
  return name.replace(/\//g, '-').toLowerCase()
}

function rgbaToHex({ r, g, b, a }: { r: number; g: number; b: number; a: number }) {
  const hex = [r, g, b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
  return a < 1
    ? `#${hex}${Math.round(a * 255)
        .toString(16)
        .padStart(2, '0')}`
    : `#${hex}`
}

async function main() {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/variables/local`, {
    headers: { 'X-Figma-Token': TOKEN },
  })
  const { meta } = (await res.json()) as {
    meta: { variables: Record<string, FigmaVariable>; variableCollections: Record<string, { defaultModeId: string }> }
  }

  const tokens: Record<string, { value: string | number }> = {}
  for (const variable of Object.values(meta.variables)) {
    const modeId = Object.keys(variable.valuesByMode)[0]
    const raw = variable.valuesByMode[modeId]
    const value =
      variable.resolvedType === 'COLOR'
        ? rgbaToHex(raw as { r: number; g: number; b: number; a: number })
        : (raw as string | number)
    tokens[toCssName(variable.name)] = { value }
  }

  await writeFile('tokens/figma.json', JSON.stringify(tokens, null, 2))
}

main()
```

这段代码只处理了默认 Mode，暗色模式我们是单独跑一遍再合并的，这里就不展开了。有一个细节值得提一下：Figma 里引用型的变量（比如 `color/primary` 指向 `blue/500`）在 API 返回里是 `VARIABLE_ALIAS` 类型，需要递归解析，第一版脚本我没处理，生成的 CSS 里全是 `[object Object]`，排查了半小时。

## 组件映射：一个 Figma 组件对应一个 Vue 组件

Token 解决的是“颜色和间距对不对”，还原真正费时间的是组件。我们定了一条硬规矩：**Figma 里的每个组件，在代码库里必须有且只有一个同名 Vue 组件，Figma 的 Variant 属性直接映射成 props。**

举个例子，设计稿里的 `Button` 有三个属性：`variant`（primary / secondary / ghost）、`size`（sm / md / lg）、`disabled`。代码里就是这样：

```vue
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}
withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})
</script>

<template>
  <button class="btn" :class="[`btn--${variant}`, `btn--${size}`]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  border-radius: var(--radius-md);
  padding-inline: var(--space-button-x);
  transition: background-color 0.15s;
}
.btn--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.btn--sm {
  height: 28px;
  font-size: 13px;
}
.btn--md {
  height: 36px;
  font-size: 14px;
}
.btn--lg {
  height: 44px;
  font-size: 16px;
}
</style>
```

这样做的好处是，设计师在 Figma 的属性面板里选 `variant=ghost, size=sm`，我看一眼就知道该写 `<Button variant="ghost" size="sm">`，中间不需要任何翻译。我们还在 Figma 的组件描述里直接写上了对应的组件路径，用 Dev Mode 查看的时候一眼就能看到。

## 哪些地方不值得自动化

这一个月里我也试过几个 Figma 转代码的插件，结论是：**生成布局可以，生成组件不行**。插件吐出来的是一堆绝对定位和写死的像素值，看起来像那么回事，但没有任何语义，改一个字号就要重新生成。最后我们只用它干一件事：复杂的营销页插画区域，直接导出 SVG，省得手写。

另一个不值得自动化的是“设计稿里没有的状态”。设计师画的通常是理想态，加载中、空列表、报错、超长文本这些，稿子里要么没有要么只有一个。与其等设计补，不如在组件里先把这些状态按设计系统的既有规则做出来，再回头让设计师确认。我们改版期间大概有三分之一的组件状态是这样反向补上去的。

还有字体和行高。Figma 里的文字样式和 CSS 的对应关系看起来简单，实际上行高最容易出问题：设计师习惯用固定像素的行高，比如 14px 字号配 22px 行高，而我们代码里之前到处是 `line-height: 1.5`。两种写法在单行时看不出差别，一旦文字换行或者中英文混排，高度就对不上。最后我们把字体也做成了 Token，`text/body` 对应一组字号、行高和字重，CSS 里用一个自定义属性组来承接，设计师改行高，代码跟着变，不再有人手写 1.5 了。

## 交付流程上的小调整

工具链搭好之后，我们还改了一下交付节奏。以前是设计师画完全部页面再一次性丢给前端，现在改成先交付组件，再交付页面。设计师先把 Figma 组件库里新增和改动的组件列出来，前端照着把组件做完并在 Storybook 里过一遍，然后才开始拼页面。这样拼页面的时候基本不用再写样式，就是在组合已有的组件，速度自然就快了。顺序上这一个小调整，比任何插件带来的提升都大。

## 几个数字

改版做完后我回头算了一下：

| 指标                   | 改版前        | 改版后             |
| ---------------------- | ------------- | ------------------ |
| 项目里的颜色值种类     | 47 种         | 18 个语义 Token    |
| 中等页面还原耗时       | 约 1.5 天     | 约 0.5 天          |
| 设计走查提出的视觉问题 | 平均每页 6 条 | 平均每页 1 到 2 条 |
| 暗色模式适配           | 逐页补        | 改 Token 一次生效  |

视觉问题那一栏下降得最明显，因为大部分“颜色不对”“间距差 2px”的问题在 Token 层已经被消灭了，剩下的多是交互细节。

最后想说的是，这套东西真正起作用的前提不是脚本写得多好，而是设计师愿意一起维护变量和组件。我们改版前专门开了两次会，一次是我给设计师讲 CSS 变量是怎么回事，一次是设计师给我讲 Figma 的 Variables 和 Mode 怎么用。两边都懂一点对方的工具之后，很多讨论就从“你这里为什么又不一样”变成了“这个 Token 要不要加一层”。工程化这个词听起来很重，落到设计稿还原上，其实就是让两边说同一种话。
