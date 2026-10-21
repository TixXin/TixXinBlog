/**
 * @file theme.config.ts
 * @description Aurora 主题宿主侧能力声明；version/icon 只在 theme.json 维护
 * @author TixXin
 * @since 2026-04-04
 */

export default {
  capabilities: {
    rightSidebar: true,
    rightSidebarBreakpoint: 1280,
    mobileNav: true,
    guestbookChat: false,
    momentInfoPlacement: 'right' as const,
    customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'] as const,
  },
}
