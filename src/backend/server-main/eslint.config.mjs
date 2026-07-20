/**
 * @file eslint.config.mjs
 * @description 后端 ESLint 扁平配置：typescript-eslint 推荐规则 + 项目强约束
 * @author TixXin
 * @since 2026-07-20
 */

import eslint from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // 见 docs/backend/development.md §5：禁用 any 与 console，统一走 pino
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
