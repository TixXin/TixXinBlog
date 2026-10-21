/**
 * @file theme.config.ts
 * @description Nexus 主题宿主侧能力声明；version/icon 只在 theme.json 维护
 * @author TixXin
 * @since 2026-04-04
 */

export default {
  capabilities: {
    rightSidebar: true,
    rightSidebarBreakpoint: 1440,
    mobileNav: true,
    guestbookChat: true,
    momentInfoPlacement: 'left' as const,
    customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'] as const,
  },
}
