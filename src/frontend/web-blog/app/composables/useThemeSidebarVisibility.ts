/**
 * @file useThemeSidebarVisibility.ts
 * @description 侧栏能力位的统一计算出口：宿主页面与组合函数不再按主题 id 写死断点/归属，只读主题声明的能力
 * @author TixXin
 * @since 2026-10-22
 */

import { useMediaQuery } from '@vueuse/core'

/**
 * 能力位派生状态：
 * - rightSidebarVisible：主题声明右栏，且视口达到主题自报断点，且页面未用 meta 禁用右栏；
 * - chatLayoutEnabled：留言板宽屏聊天态（依赖左侧栏的主题显式声明 guestbookChat）；
 * - momentInfoSidebar：朋友圈资料固定侧栏归属，未声明表示只放紧凑抽屉。
 *
 * 注意：rightSidebarVisible/chatLayoutEnabled 含视口判断，SSR 时恒为 false，
 * 只能在客户端消费（ClientOnly 内、mounted 之后或抽屉内容里），
 * 结构性渲染（如是否创建右栏挂载点）请直接读 activeTheme.capabilities，避免水合 mismatch。
 */
export function useThemeSidebarVisibility() {
  const route = useRoute()
  const { activeTheme } = useLayoutTheme()
  const capabilities = computed(() => activeTheme.value.capabilities)
  // 未声明右侧断点时视为“右栏存在即显示”，0px 等价于始终命中
  const sidebarBreakpoint = computed(() => capabilities.value.rightSidebarBreakpoint)
  const wideEnoughForSidebar = useMediaQuery(computed(() => `(min-width: ${sidebarBreakpoint.value ?? 0}px)`))
  const wideEnoughForChat = useMediaQuery('(min-width: 1024px)')

  const rightSidebarVisible = computed(
    () =>
      capabilities.value.rightSidebar &&
      (sidebarBreakpoint.value === undefined || wideEnoughForSidebar.value) &&
      route.meta.rightSidebar !== false,
  )
  const chatLayoutEnabled = computed(() => capabilities.value.guestbookChat === true && wideEnoughForChat.value)
  const momentInfoSidebar = computed(() => capabilities.value.momentInfoPlacement)

  return { rightSidebarVisible, chatLayoutEnabled, momentInfoSidebar }
}
