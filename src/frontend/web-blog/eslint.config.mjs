/**
 * @file eslint.config.mjs
 * @description ESLint flat config，基于 @nuxt/eslint 自动生成的 Nuxt 规则并追加项目自定义与代码组织约束
 * @author TixXin
 * @since 2026-04-03
 */

import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

/** 不受体量与复杂度约束的文件，与 scripts/check-file-size.mjs 的 EXEMPT 保持一致 */
const STRUCTURE_EXEMPT = [
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/__tests__/**',
  '**/migrations/**',
  '**/seeders/**',
  '**/mock.ts',
  '**/*.d.ts',
]

export default withNuxt(
  { ignores: ['.nuxt-production/**', '.nuxt-setup-sandbox/**'] },
  {
    rules: {
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
  // 代码组织约束，规则见 docs/code-organization.md；存量违规冻结在 eslint-suppressions.json，只许减少。
  {
    name: 'tixxin/structure',
    ignores: STRUCTURE_EXEMPT,
    rules: {
      // 函数体量按文档口径计入空行与注释
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: false, skipComments: false, IIFEs: true }],
      'max-depth': ['error', 3],
      // 存量分布 p95 为 13、p99 为 21；取 15 只拦明显过度分支的函数，与后端一致
      complexity: ['error', 15],
      'max-params': ['error', 4],
      // 模板嵌套存量 p95 为 7、p99 为 8；取 8 冻结约 50 处，取 6 会冻结约 400 处而失去棘轮意义
      'vue/max-template-depth': ['error', { maxDepth: 8 }],
    },
  },
  // 通用组件只依赖 props、事件与插槽：不导入领域模块，不直接请求接口
  {
    name: 'tixxin/common-components',
    files: ['app/components/common/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['~/features', '~/features/**', '~~/app/features/**', '@/features/**', '**/features/**'],
              message: '通用组件不导入领域模块，数据经 props 传入；领域相关的组件放到对应领域目录。',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^(\\$fetch|useFetch|useLazyFetch|useApi|useAdminApi)$/]',
          message: '通用组件不直接请求接口，由使用方取得数据后经 props 传入。',
        },
        {
          selector: "CallExpression[callee.object.name='$fetch']",
          message: '通用组件不直接请求接口，由使用方取得数据后经 props 传入。',
        },
      ],
    },
  },
  // 版式统一由 Prettier 管理，避免两套格式规则反复改写同一段代码。
  prettier,
)
