/**
 * @file useMomentSidebarPlacement.ts
 * @description 统一朋友圈资料归属：按主题能力位决定资料放固定侧栏还是紧凑抽屉，不再按主题 id 分支
 * @author TixXin
 * @since 2026-10-21
 */
import { useMediaQuery } from '@vueuse/core'

export function useMomentSidebarPlacement() {
  const { rightSidebarVisible, momentInfoSidebar } = useThemeSidebarVisibility()
  // 左侧栏没有单独的能力位断点：三主题沿用全站统一的主断点（1024px），主题未声明归属时不会用到它
  const leftSidebarVisible = useMediaQuery('(min-width: 1024px)')
  const drawerOpen = ref(false)
  // 归属只取决于能力位，不用视口决定 SSR 结构，防止首屏水合时把资料搬到另一侧。
  const rightInfo = computed(() => momentInfoSidebar.value === 'right')
  // 固定侧栏不可见时由紧凑抽屉补齐；未声明归属的主题始终用抽屉。
  const drawerInfo = computed(() => {
    if (momentInfoSidebar.value === 'right') return !rightSidebarVisible.value
    if (momentInfoSidebar.value === 'left') return !leftSidebarVisible.value
    return true
  })
  watch([rightInfo, rightSidebarVisible, leftSidebarVisible], () => {
    drawerOpen.value = false
  })
  return { rightInfo, drawerInfo, drawerOpen }
}
