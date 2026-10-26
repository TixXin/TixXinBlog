/**
 * @file eslint.config.mjs
 * @description 后端 ESLint 扁平配置：typescript-eslint 推荐规则 + 项目强约束与代码组织约束
 * @author TixXin
 * @since 2026-07-20
 */

import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

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

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // 后端禁用 any 与 console，统一使用类型约束和结构化日志。
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
      // 存量分布 p90 为 12、p95 为 18；取 15 只拦明显过度分支的函数，与前端一致
      complexity: ['error', 15],
      'max-params': ['error', 4],
    },
  },
)
