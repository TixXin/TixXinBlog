/**
 * @file useFooterExpand.ts
 * @description 底部栏展开状态共享 composable，供 StatusFooter 写入、其他组件（如分页栏）读取
 * @author TixXin
 * @since 2026-04-10
 */

/** 底部栏展开状态，跨组件响应式共享 */
export function useFooterExpand() {
  const isFooterExpanded = useState('footer-expanded', () => false)
  return { isFooterExpanded }
}
