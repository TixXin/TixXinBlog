/**
 * @file useMomentSidebarPlacement.ts
 * @description 统一朋友圈资料归属；固定侧栏按主题渲染，紧凑抽屉仅补充不可见的信息
 */
import { useMediaQuery } from '@vueuse/core'

export function useMomentSidebarPlacement() {
  const { currentThemeId } = useLayoutTheme()
  const leftWidth = useMediaQuery('(min-width: 1024px)')
  const auroraWidth = useMediaQuery('(min-width: 1280px)')
  const nexusRightWidth = useMediaQuery('(min-width: 1440px)')
  const drawerOpen = ref(false)
  // 不使用视口决定SSR固定侧栏结构，防止首屏水合时把资料搬到另一侧。
  const rightInfo = computed(() => currentThemeId.value === 'aurora')
  const drawerInfo = computed(() =>
    currentThemeId.value === 'nexus' ? !leftWidth.value : currentThemeId.value === 'aurora' ? !auroraWidth.value : true,
  )
  watch([currentThemeId, leftWidth, auroraWidth, nexusRightWidth], () => {
    drawerOpen.value = false
  })
  return { rightInfo, drawerInfo, drawerOpen }
}
