/**
 * @file eslint.config.mjs
 * @description ESLint flat config，基于 @nuxt/eslint 自动生成的 Nuxt 规则并追加项目自定义
 * @author TixXin
 * @since 2026-04-03
 */

import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'no-console': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
)
