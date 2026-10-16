三月初我把自己博客的样式层从 TailwindCSS 3 换成了 UnoCSS，用了一个月，到现在算是有资格说点体会了。换的起因不是 Tailwind 不好用，而是我想在一个项目里同时用三套主题，每套主题的设计 token 不一样，用 Tailwind 的 `theme.extend` 配得越来越别扭，于是想试试那个一直听说“更灵活”的方案。

这篇不是教程，是体验报告。我会尽量写清楚哪些地方 UnoCSS 确实比 Tailwind 好，哪些地方只是不一样，哪些地方让我想换回去。

## 先说它是什么

UnoCSS 的定位是“即时原子化 CSS 引擎”，关键词是引擎而不是框架。它本身不带任何预设的工具类，`text-red-500`、`flex`、`p-4` 这些全部来自预设。你装 `presetWind3`（v66 之前叫 `presetUno`）就得到一套和 Tailwind 几乎兼容的类名；装 `presetAttributify` 就可以把类名写成属性；装 `presetIcons` 就可以用 `i-lucide-github` 这种类名直接渲染图标。

这意味着它的核心非常小，所有东西都是可插拔的。Tailwind 是一个带着自己世界观的完整产品，UnoCSS 更像一把工具箱，预设就是里面的工具。

在 Nuxt 里接入很简单：

```bash
pnpm add -D unocss @unocss/nuxt
```

```ts
// uno.config.ts
import {
  defineConfig,
  presetWind3,
  presetAttributify,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [presetWind3(), presetAttributify(), presetIcons({ scale: 1.2, warn: true })],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      brand: {
        DEFAULT: 'var(--color-brand)',
        soft: 'var(--color-brand-soft)',
      },
    },
  },
  shortcuts: {
    btn: 'inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
    'btn-primary': 'btn bg-brand text-white hover:bg-brand/90',
    card: 'rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900',
  },
})
```

然后在 `nuxt.config.ts` 的 `modules` 里加 `@unocss/nuxt`，就完了。迁移现有的 Tailwind 类名基本不用改，我扫了一遍整个项目，只有 `space-x-*` 和几个 `divide-*` 的行为有细微差别，其余的直接通过。

## 真正好用的三个地方

### 规则可以自己写

这是我换过来的主要原因。Tailwind 想加一个自定义工具类要写插件，走 `addUtilities` 那套 API；UnoCSS 直接在配置里写一条正则：

```ts
rules: [
  [/^text-fluid-(\d+)-(\d+)$/, ([, min, max]) => ({
    'font-size': `clamp(${min}px, ${(Number(min) / 16).toFixed(2)}rem + 1vw, ${max}px)`,
  })],
  ['content-auto', { 'content-visibility': 'auto' }],
],
```

写完立刻就能用 `text-fluid-16-24`，而且 VS Code 插件能正确提示和预览。我给博客的三套主题写了十几条这样的规则，每条两三行，比在 Tailwind 里写插件轻松太多。

### 预设机制让多主题变简单

我的三个主题各有一套颜色和间距，之前在 Tailwind 里靠 CSS 变量硬撑。换到 UnoCSS 之后，我把每个主题做成一个小预设，导出各自的 `theme` 和 `shortcuts`，主配置里按环境变量决定加载哪个。预设就是一个返回配置对象的普通函数，没有任何魔法：

```ts
// themes/nexus/uno.preset.ts
import type { Preset } from 'unocss'

export function presetNexus(): Preset {
  return {
    name: 'theme-nexus',
    theme: {
      colors: { surface: '#0b0f19', accent: '#7c9cff' },
      borderRadius: { card: '1.25rem' },
    },
    shortcuts: {
      card: 'rounded-card bg-surface/80 backdrop-blur border border-white/10 p-6',
    },
  }
}
```

同名的 `card` 快捷方式在不同主题下展开成不同的类，页面组件完全不用知道现在是哪个主题。这件事用 Tailwind 也能做，但需要在构建层面动手脚；UnoCSS 里它就是配置的一部分。

### 图标预设

`presetIcons` 是我用过最省心的图标方案。它读的是 Iconify 的数据集，装一个 `@iconify-json/lucide`，然后 `<span class="i-lucide-search" />` 就是一个 SVG 图标，按需打包，不需要任何图标组件。我博客里的 Lucide 图标统一走项目封装的 `Icon` 组件，但一些纯装饰性的小图标直接用类名，省掉了一层组件调用。

## 只是不一样的地方

属性化模式是 UnoCSS 的招牌特性之一，可以把 `class="flex items-center gap-2"` 写成 `flex items-center gap-2` 直接挂在标签上，或者按类别分组：`<div p="4 md:6" text="sm gray-500" />`。我试了两周之后把它关了。不是它不好，而是和团队里其他人共用代码时，两种写法混在一起阅读成本反而更高，而且 Vue 模板里属性一多，和真正的 props 混在一起，眼睛会累。单人项目可以玩，多人项目我不推荐。

`transformerVariantGroup` 让你把 `hover:bg-gray-100 hover:text-black` 写成 `hover:(bg-gray-100 text-black)`，这个我留着了，模板里确实清爽一些。

## 让我犹豫的地方

**生态比 Tailwind 小一圈。** 大部分第三方组件库的文档都是按 Tailwind 写的，复制过来基本能用，但遇到 `@apply` 以外的 Tailwind 插件语法就要自己翻译。Tailwind 4 出来之后两边的差异还会再变，这是个持续成本。

**运行时没有类名校验。** Tailwind 写错类名会在 IDE 里标红，UnoCSS 写错了就是没有样式，安安静静的。`presetIcons` 的 `warn: true` 能对图标报警，但普通类名没有对应机制。我靠 VS Code 插件的高亮来补，没高亮的类名就是写错了，习惯之后还行。

**构建速度的提升没有宣传的那么夸张。** 我的博客开发服务器冷启动从 Tailwind 的 2.4 秒降到 1.9 秒，生产构建 CSS 处理阶段从 1.1 秒降到 0.4 秒，确实快了，但项目本来就不大，体感差别不明显。真正有感知的是热更新：改一个类名几乎是瞬间生效，Tailwind 3 偶尔会卡一下。

**最终产物大小几乎一样。** 两边都是按需生成，我这边 Tailwind 产出的 CSS 是 38KB，UnoCSS 是 36KB，gzip 之后差不到 1KB。不要指望换引擎能减肥。

## 迁移过程中的几件小事

整个迁移我花了一个周六下午加周日上午。顺序是先装 UnoCSS 和 Tailwind 并存，确认页面没有明显错乱之后再把 Tailwind 卸掉。中间有几个值得记一下的细节。

第一是 `@apply`。我的 SCSS 里有几十处 `@apply`，装了 `transformerDirectives` 之后它们原样可用，连 `@screen md` 这种指令也支持。唯一要改的是把 `tailwind.css` 里的 `@tailwind base` 换成 UnoCSS 的 `@unocss preflights` 或者直接在配置里开 `presetWind3({ preflight: true })`，不然浏览器默认样式会跑出来，按钮突然有了边框，第一眼还以为哪里坏了。

第二是暗色模式。Tailwind 的 `darkMode: 'class'` 对应 UnoCSS 里的 `presetWind3({ dark: 'class' })`，默认值就是 `class`，但我的主题切换是靠 `data-theme` 属性，所以要写成 `dark: { dark: '[data-theme="dark"]', light: '[data-theme="light"]' }`。这段在文档里藏得比较深，找了一会儿。

第三是检查遗漏。我写了一个很笨的脚本，把模板里所有 class 里的词提取出来，用 UnoCSS 的 `createGenerator` 逐个生成，没有产出的就打印出来，最后抓到了七个写错或者不被支持的类名，其中四个在 Tailwind 时代就已经是错的，只是一直没人发现。

还有一个意外收获：UnoCSS 的 inspector 面板（开发时访问 `/__unocss`）可以看到每个类名被哪些文件用到、生成了什么 CSS，排查“这个样式到底从哪来”比翻 DevTools 快多了。

## 一个月之后的结论

我会继续用下去，主要是因为自定义规则和预设机制解决了多主题这个真实问题，这是我在 Tailwind 里一直没找到舒服解法的事。如果你的项目只有一套设计系统、团队都熟悉 Tailwind、依赖了很多基于 Tailwind 的组件库，那换过来的收益不大，老老实实等 Tailwind 4 稳定就好。

如果你像我一样有“想按自己的方式生成类名”的需求，UnoCSS 值得花一个下午试一下。它最吸引我的其实是心态上的变化：原子化 CSS 不再是“别人定义好的一套词汇表”，而是你自己可以随时扩展的语言。
