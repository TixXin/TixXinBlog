/**
 * @file useGuestbookResponsive.ts
 * @description 留言板响应式布局状态：挂载标记、抽屉开关与能力位派生的聊天态/右栏可见性
 * @author TixXin
 * @since 2026-10-21
 */

export function useGuestbookResponsive() {
  const { activeTheme, currentThemeId } = useLayoutTheme()
  const { chatLayoutEnabled, rightSidebarVisible } = useThemeSidebarVisibility()

  const mounted = ref(false)
  const infoOpen = ref(false)

  // 聊天态改由主题能力位 guestbookChat 声明（替代原来按主题 id / leftSidebar 的推断）。
  // mounted 保证首屏 SSR 与水合首帧走论坛布局，避免视口判断造成结构 mismatch。
  const isChatMode = computed(() => mounted.value && chatLayoutEnabled.value)
  // 右栏是否可见同样来自能力位与主题自报断点，dock 的 rightSidebar=false 自然覆盖。
  const rightVisible = computed(() => mounted.value && rightSidebarVisible.value)

  return {
    activeTheme,
    currentThemeId,
    mounted,
    infoOpen,
    isChatMode,
    rightVisible,
  }
}
