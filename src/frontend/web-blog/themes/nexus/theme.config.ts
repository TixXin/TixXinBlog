/**
 * @file theme.config.ts
 * @description Nexus 主题宿主侧配置：能力声明与补充元信息
 * @author TixXin
 * @since 2026-04-04
 */

export default {
  version: '2.0.0',
  icon: 'lucide:layout-dashboard',
  capabilities: {
    leftSidebar: true,
    rightSidebar: true,
    customizer: ['colorMode', 'contentTransition', 'sidebarAnimation'] as const,
  },
}
