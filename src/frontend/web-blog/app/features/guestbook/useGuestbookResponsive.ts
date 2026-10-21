/**
 * @file useGuestbookResponsive.ts
 * @description 留言板响应式布局状态：断点匹配、挂载标记、抽屉开关与聊天模式判定
 * @author TixXin
 * @since 2026-10-21
 */

import { useMediaQuery } from '@vueuse/core'

export function useGuestbookResponsive() {
  const { activeTheme, currentThemeId } = useLayoutTheme()
  const internalWidth = useMediaQuery('(min-width:1024px)')
  const nexusRight = useMediaQuery('(min-width:1440px)')
  const auroraRight = useMediaQuery('(min-width:1280px)')

  const mounted = ref(false)
  const infoOpen = ref(false)

  const isChatMode = computed(() => mounted.value && activeTheme.value.capabilities.leftSidebar && internalWidth.value)
  const rightVisible = computed(
    () =>
      mounted.value &&
      (currentThemeId.value === 'nexus' ? nexusRight.value : currentThemeId.value === 'aurora' && auroraRight.value),
  )

  return {
    activeTheme,
    currentThemeId,
    mounted,
    infoOpen,
    isChatMode,
    rightVisible,
  }
}
