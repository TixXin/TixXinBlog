元旦过后接手了一个两年前的 Vue 项目，打开 `styles` 目录的那一刻我就知道这个月要干什么了：48 个 SCSS 文件，6200 多行，一个 `variables.scss` 里塞了 300 多个变量，`common.scss` 有 1800 行而且谁都不知道里面哪些还在用。改一个按钮的圆角，全局搜出来 11 处硬编码的 `4px`。

样式代码是最容易腐烂的那一类代码，因为它“能跑就行”，没有类型检查，没有单测，删了什么东西也不会立刻报错。这篇记录我这三周把它重新整理成一个可维护结构的思路和做法，不是最佳实践，是在一个真实的烂摊子上验证过的做法。

## 先弄清楚问题出在哪

动手之前我花了两天只做一件事：读。读完之后把问题归成四类。

第一，没有入口。每个 Vue 组件自己 `@import` 需要的文件，有的引 `variables`，有的引 `mixins`，有的引 `common`，依赖关系是一张网，没人能画出来。

第二，全局污染。`common.scss` 里大量 `.title`、`.card`、`.list` 这种泛用类名，每个页面都在覆盖它们，覆盖的方式是加更长的选择器，最长的一条嵌了七层。

第三，变量没有语义。`$color-1` 到 `$color-23`，`$padding-small-2`，看名字不知道用在哪，于是新同学宁愿自己写死数值也不敢用变量。

第四，`@import` 本身。Sass 从去年 10 月的 1.80 开始正式把 `@import` 标为废弃，构建时一堆黄色警告。这个项目的 Dart Sass 已经升到了 1.83，每次启动开发服务器刷出几百行警告，所有人都学会了无视它。

## 目录结构

我最后定下来的结构是这样的，比经典的“7-1 模式”少几层，因为项目没那么大：

```text
styles/
├── abstracts/        只输出变量、函数、mixin，不产生任何 CSS
│   ├── _tokens.scss
│   ├── _functions.scss
│   ├── _mixins.scss
│   └── _index.scss
├── base/             重置、排版、全局元素样式
│   ├── _reset.scss
│   ├── _typography.scss
│   └── _index.scss
├── components/       跨页面复用的组件级样式
├── layouts/          页面骨架
├── themes/           主题变量（只有 CSS 自定义属性）
└── main.scss         唯一入口
```

核心规则只有一条：`abstracts` 目录里的文件被 `@use` 多少次都不会产生一行 CSS。这意味着任何组件都可以随便引用它，不用担心重复输出。而 `base`、`components` 这些会产生 CSS 的目录只能被 `main.scss` 引用一次。

## 从 @import 换到 @use 和 @forward

这是整个重构里最值得做的一步。`@use` 和 `@import` 的本质区别是命名空间：`@import` 把文件里的所有东西倒进当前作用域，`@use` 把它们挂在一个命名空间下，而且每个文件只会被加载一次。

`abstracts/_index.scss` 用 `@forward` 把几个文件打包成一个入口：

```scss
// abstracts/_index.scss
@forward 'tokens';
@forward 'functions';
@forward 'mixins';
```

然后组件里只需要一行：

```scss
@use '@/styles/abstracts' as *;

.post-card {
  padding: space(4);
  border-radius: $radius-md;

  @include respond(md) {
    padding: space(6);
  }
}
```

`as *` 是把命名空间去掉直接用，我在 `abstracts` 上用了这个写法，因为它们是项目的“标准库”，到处加前缀太啰嗦。其他文件之间互相引用一律带命名空间。

为了不在每个组件里重复这一行，Vite 的 `additionalData` 可以自动注入。在 Nuxt 里配置是：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use '@/styles/abstracts' as *;`,
        },
      },
    },
  },
})
```

`api: 'modern-compiler'` 这项在 Vite 5.4 之后可用，用的是 Dart Sass 新的编译 API，大项目里编译速度差别明显，我们这边 SCSS 编译从 3.1 秒降到了 1.2 秒。注意 `additionalData` 注入的内容必须是纯 `@use`，不能有任何会输出 CSS 的东西，否则每个组件都会多一份。

## 变量分两层：token 和语义

300 多个变量我最后压到了 60 个，办法是把它们分成两层。

底层是设计 token，描述“有什么”：

```scss
// abstracts/_tokens.scss
$palette: (
  'gray-50': #f9fafb,
  'gray-900': #111827,
  'blue-500': #3b82f6,
);

$spacing-unit: 0.25rem;
$radius-sm: 0.25rem;
$radius-md: 0.5rem;
$radius-lg: 1rem;
```

上层是语义变量，描述“用来干什么”，而且落到 CSS 自定义属性上，这样主题切换不需要重新编译：

```scss
// themes/_light.scss
@use '../abstracts' as *;
@use 'sass:map';

:root {
  --color-text: #{map.get($palette, 'gray-900')};
  --color-surface: #{map.get($palette, 'gray-50')};
  --color-accent: #{map.get($palette, 'blue-500')};
}
```

组件里只允许用 `var(--color-text)` 这类语义变量，禁止直接用 `$palette`。这条规则靠 Stylelint 的 `declaration-property-value-disallowed-list` 加了一条检查，直接写 `#3b82f6` 这种色值会被 lint 拦住。实际效果是两周之后新同学提的 PR 里已经没有硬编码颜色了。

## mixin 只做三件事

旧项目里有 40 多个 mixin，大部分是“把一堆属性包起来方便复制”，和直接写一个类没区别。我把 mixin 收敛到三类：

- 断点：`respond(md)`，内部查 `$breakpoints` map 生成 `@media`。
- 文本截断、视觉隐藏这类涉及多条属性且有浏览器兼容细节的工具。
- 需要参数化的模式，比如 `elevation($level)` 根据层级生成阴影。

```scss
// abstracts/_mixins.scss
@use 'sass:map';
@use 'tokens' as *;

@mixin respond($name) {
  $width: map.get($breakpoints, $name);
  @if $width == null {
    @error '未知断点 #{$name}，可用：#{map.keys($breakpoints)}';
  }
  @media (min-width: $width) {
    @content;
  }
}
```

`@error` 这一行很值得加，拼错断点名会在编译时直接报错，而不是悄悄生成一个 `min-width: null`。

## 组件样式放哪

一个经常引起争论的问题是：组件的样式写在 `.vue` 文件的 `<style scoped>` 里，还是放到 `styles/components` 目录？我的答案是看复用范围。只在一个组件里用的样式就留在组件里，和模板放一起，删组件的时候样式一起消失，不会留尸体；跨页面复用、而且会被别的组件覆盖的（比如按钮、表单控件、卡片容器），放到 `styles/components`，用明确的类名约定。

这个项目之前的问题是两种做法混着来，而且 `common.scss` 里的泛用类名和组件 scoped 样式互相打架，谁优先级高谁赢。整理后我定了一条约定：`styles/components` 里的类名统一加 `c-` 前缀，`layouts` 里加 `l-`，工具类加 `u-`，和组件 scoped 样式一眼能区分开。前缀不优雅，但在一个有十几个人协作的项目里，“一眼能看出来源”比优雅重要。

嵌套深度也定了硬规则：最多三层，Stylelint 的 `max-nesting-depth` 设成 3。原来那条嵌了七层的选择器拆开之后发现其实只是想给一个表格的第二列换个颜色，用一个独立类名就解决了。

## 怎么安全地删东西

重构样式最怕的是删了之后某个角落的页面坏了。我的办法是分三步：先用 PurgeCSS 的分析模式跑一遍，列出所有在模板里找不到引用的选择器，大概 700 条；再人工过一遍，把动态拼接类名的情况排除掉，剩下 500 多条；最后分三个 PR 删，每个 PR 跑一次全页面截图对比。三个 PR 合完之后生产的 CSS 从 214KB 降到 96KB，gzip 后从 31KB 到 17KB。

更重要的是心理上的变化。以前谁都不敢动 `common.scss`，现在它已经不存在了，每个文件的职责一眼能看出来，新加一个组件的样式知道该放哪、该引什么。

三周下来最大的体会是：样式架构的核心不是目录怎么分，而是“什么文件可以产生 CSS”这条边界画清楚，加上变量有语义、入口只有一个。做到这三点，剩下的东西自然会归位。
