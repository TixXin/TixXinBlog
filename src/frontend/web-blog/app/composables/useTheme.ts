/**
 * @file useTheme.ts
 * @description 主题切换组合式函数，封装 colorMode 的读取与设置逻辑
 * @author TixXin
 * @since 2025-03-17
 */

import type { ThemeOption } from '~/features/appearance/types'
import { COLOR_MODE_OPTIONS } from '~/features/appearance/types'

export function useTheme() {
  const colorMode = useColorMode()
  const themeOptions = COLOR_MODE_OPTIONS

  const currentPreference = computed(() => colorMode.preference as ThemeOption)

  function setTheme(theme: ThemeOption) {
    colorMode.preference = theme
  }

  return {
    currentPreference,
    themeOptions,
    setTheme,
  }
}
