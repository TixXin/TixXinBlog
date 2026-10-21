/**
 * @file theme.config.ts
 * @description Dock 主题宿主侧能力声明；version/icon 只在 theme.json 维护
 * @author TixXin
 * @since 2026-04-04
 */

export default {
  capabilities: {
    rightSidebar: false,
    mobileNav: false,
    guestbookChat: false,
    customizer: ['colorMode', 'contentTransition'] as const,
  },
}
