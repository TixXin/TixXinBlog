五一假期前最后一个工作日，我把公司的组件库仓库升级到了 ESLint 9，顺手把三个个人项目也迁了一遍。这事从去年 ESLint 9 发布就一直挂在待办里，拖到现在的原因很简单：`.eslintrc` 还能跑，没人愿意碰。真正逼我动手的是 `pnpm install` 时那条越来越刺眼的警告——`eslint@8` 已经进入 EOL，而且几个常用插件的新版本只认 `eslint.config.js` 了。

迁完之后回头看，整个过程比我想象的顺利，但也踩了几个坑，有的坑官方迁移指南里没写。这篇把过程完整记一下，给同样在拖延的人一个参考。

## 先搞清楚 Flat Config 到底变了什么

Flat Config 不是换个文件名那么简单，它改的是配置的心智模型。旧的 `.eslintrc` 靠 `extends`、`overrides`、`env`、`plugins` 这些字段互相嵌套，配置来源散落在 `package.json`、父目录和 `--config` 参数里，查一条规则到底从哪来经常要翻半天。

Flat Config 把这一切压成一个数组。数组里每一项是一个配置对象，后面的覆盖前面的，`files` 决定这个对象作用于哪些文件。没有 `extends`，想复用别人的配置就直接 `...` 展开进数组。没有 `env`，全局变量通过 `languageOptions.globals` 显式声明。插件不再靠字符串名字自动解析，而是你 `import` 进来后放进 `plugins` 对象。

一开始觉得啰嗦，用两天就会发现好处：配置就是普通 JavaScript，能 `console.log`，能条件判断，能从别的模块导出，IDE 能跳转定义。以前想知道 `plugin:vue/vue3-recommended` 里到底开了哪些规则，要去 `node_modules` 里翻；现在直接 `import pluginVue from 'eslint-plugin-vue'` 然后看 `pluginVue.configs['flat/recommended']` 就行。

## 迁移步骤

### 升级依赖

先把核心包升上去。我这几个项目用的组合是 ESLint、typescript-eslint 和 eslint-plugin-vue，三个都已经原生支持 Flat Config：

```bash
pnpm add -D eslint@^9.25.0 typescript-eslint@^8.31.0 eslint-plugin-vue@^10.0.0 globals
pnpm remove @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

注意 `typescript-eslint` 现在是一个统一入口包，v8 之后不需要再分别装 parser 和 plugin。`globals` 用来替代以前的 `env: { browser: true, node: true }`。

### 写新配置

然后删掉 `.eslintrc.cjs` 和 `.eslintignore`，新建 `eslint.config.js`。我的 Nuxt 项目最终长这样：

```js
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: ['.nuxt/**', '.output/**', 'dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
```

几点说明。`ignores` 单独放在一个只有 `ignores` 字段的对象里，这是全局忽略的写法；如果同一个对象里还有 `files` 或 `rules`，`ignores` 就只对那个对象生效，这个区别第一次很容易搞混。`tseslint.config()` 只是个带类型提示的辅助函数，不用也行，直接导出数组效果一样。`.vue` 文件需要告诉 vue 解析器把 `<script lang="ts">` 交给 TS 解析器，所以有那一段 `parserOptions.parser`。

### 处理还没支持 Flat Config 的插件

这是最烦的一步。我有个老项目用了 `eslint-plugin-import` 的旧版本，它的 `configs.recommended` 还是 eslintrc 格式，直接放进数组会报 `Unexpected key "plugins"`。两个办法：

一是换成已经支持 Flat Config 的替代品，`eslint-plugin-import-x` 就是干这个的。二是用官方的 `@eslint/compat` 把旧配置包一层：

```js
import { fixupConfigRules } from '@eslint/compat'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export default [...fixupConfigRules(compat.extends('plugin:import/recommended'))]
```

我最后选了换成 `import-x`，因为 compat 层只是过渡方案，迟早还得改。另外 `import.meta.dirname` 要 Node 20.11 以上才有，低版本得用 `fileURLToPath` 自己算。

## 踩到的坑

**第一个坑是 `.eslintignore` 被静默忽略。** ESLint 9 不再读这个文件，但也不报错，结果 `pnpm lint` 第一次跑直接扫了 `.nuxt` 目录，一万多条错误。解决方法就是上面说的全局 `ignores` 对象。

**第二个坑是编辑器没生效。** VS Code 的 ESLint 插件在 3.0 之后默认会探测 `eslint.config.js`，但我有个项目 `package.json` 里没有 `"type": "module"`，配置文件用了 ESM 语法，插件端报错而命令行没报，因为命令行会自动尝试。改成 `eslint.config.mjs` 后两边都正常了。

**第三个坑是规则名变了。** `@typescript-eslint/ban-types` 在 v8 被拆成了 `no-unsafe-function-type`、`no-wrapper-object-types` 等几条，旧配置里引用它会直接报 `Definition for rule was not found`。还有 `no-extra-semi` 这类格式类规则已经从核心里移除，统一交给 Prettier 处理就好。

**还有一个不算坑但容易漏的点：`parserOptions.project` 的写法变了。** 如果你要开类型感知的规则，以前是指定 `tsconfig.json` 路径，现在推荐用 `projectService: true`，让 typescript-eslint 自己根据文件位置找对应的 tsconfig，monorepo 里尤其省事。不过开了之后记得给 `eslint.config.js` 本身一个豁免，不然它会抱怨配置文件不在任何 tsconfig 的 include 范围里。

**第四个坑是性能。** 迁移后我发现 `pnpm lint` 比以前慢了，从 11 秒涨到 19 秒。查了一下是因为 `tseslint.configs.recommended` 被我不小心换成了 `recommendedTypeChecked`，后者会做类型检查，开销完全不是一个量级。改回来之后降到 9 秒，比迁移前还快一点，应该是 ESLint 9 本身的优化。

## 自定义规则怎么写

Flat Config 下本地规则也简单了，不用再装 `eslint-plugin-local-rules` 这类中转包。我写了一条禁止在组件里直接 `import` 第三方图标库的规则，强制走项目封装的 `Icon` 组件：

```js
// eslint/no-raw-icon-import.js
export default {
  meta: {
    type: 'problem',
    messages: {
      useIcon: '请使用项目封装的 <Icon name="lucide:xxx" /> 而不是直接引入 {{ source }}',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source === 'string' && source.startsWith('lucide-vue-next')) {
          context.report({ node, messageId: 'useIcon', data: { source } })
        }
      },
    }
  },
}
```

然后在配置里把它挂到一个自定义插件命名空间下：

```js
import noRawIconImport from './eslint/no-raw-icon-import.js'

export default [
  {
    plugins: {
      local: { rules: { 'no-raw-icon-import': noRawIconImport } },
    },
    rules: { 'local/no-raw-icon-import': 'error' },
  },
]
```

`plugins` 的 key 就是规则前缀，想叫什么叫什么。这种小规则以前觉得麻烦不想写，现在写一条五分钟，团队里好几个“口头约定”都可以变成 lint 错误了。

## 多包仓库怎么共享配置

公司那个组件库是 pnpm workspace，里面有五个包，以前每个包都有一份几乎一样的 `.eslintrc.cjs`，改一条规则要改五处。这次我把公共部分抽成了一个内部包 `@team/eslint-config`，导出一个函数而不是一个固定数组，这样各个包可以传参数做微调：

```js
// packages/eslint-config/index.js
export function createConfig({ vue = true, extraIgnores = [] } = {}) {
  return tseslint.config(
    { ignores: ['dist/**', 'coverage/**', ...extraIgnores] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...(vue ? pluginVue.configs['flat/recommended'] : []),
  )
}
```

然后每个包的 `eslint.config.js` 就只剩三四行，调用 `createConfig({ vue: false })` 之类的就完了。根目录再放一个汇总配置，`pnpm -r lint` 和根目录直接 `eslint .` 两种跑法都能用。以前 eslintrc 时代也能靠 `extends` 做到类似的效果，但要靠 `root: true` 和目录层级去猜，调试起来很痛苦；现在就是普通的函数调用，谁覆盖谁一目了然。

还有一个小细节：`lint-staged` 的配置里以前写的是 `eslint --fix --ext .ts,.vue`，`--ext` 在 ESLint 9 里已经没了，文件类型完全由配置里的 `files` 决定，直接写 `eslint --fix` 就行。我因为这个参数被 Husky 的 pre-commit 卡了两次才反应过来。

## 迁完以后

四个仓库加上那个 workspace 总共花了大半天，大部分时间在处理插件兼容和重新理解 `ignores` 的语义。配置文件行数从原来 `.eslintrc.cjs` 加 `.eslintignore` 的 87 行变成了 62 行，而且终于能在一个文件里看清所有规则的来源。

如果你还在用 ESLint 8，我的建议是别等了，趁着项目没在赶需求的时候找半天迁掉。先用 `npx @eslint/migrate-config .eslintrc.cjs` 自动生成一版，再手动清理，比从零写快很多。插件如果不支持就找替代品，`@eslint/compat` 留作最后手段。迁完记得跑一次完整 lint，对比一下错误数和耗时，有变化就说明哪里没对上。
