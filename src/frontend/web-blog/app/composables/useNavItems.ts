/**
 * @file useNavItems.ts
 * @description 导航数据源 composable：按站点设置中的模块显隐、顺序与外链生成导航项，隐藏只影响展示
 * @author TixXin
 * @since 2026-03-26
 */

import type { NavItem } from '~/features/nav/types'
import { buildNavItems } from '~/features/nav/routes'

/** 获取导航菜单项（全量，含 desktopOnly 标记） */
export function useNavItems() {
  const { settings } = useSiteSettings()
  const navItems = computed<NavItem[]>(() => buildNavItems(settings.value.navigation))

  /** 仅返回移动端可见的导航项（过滤掉 desktopOnly） */
  const mobileNavItems = computed<NavItem[]>(() => navItems.value.filter((item) => !item.desktopOnly))

  return {
    navItems,
    mobileNavItems,
  }
}
