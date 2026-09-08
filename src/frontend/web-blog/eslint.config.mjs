/**
 * @file eslint.config.mjs
 * @description ESLint flat config，基于 @nuxt/eslint 自动生成的 Nuxt 规则并追加项目自定义
 * @author TixXin
 * @since 2026-04-03
 */

import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  { ignores: ['.nuxt-production/**'] },
  {
    rules: {
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
  // 版式统一由 Prettier 管理，避免两套格式规则反复改写同一段代码。
  prettier,
)
