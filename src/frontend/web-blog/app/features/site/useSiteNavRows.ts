/**
 * @file useSiteNavRows.ts
 * @description 导航与页脚编辑区各列表的行操作：稳定的行键，按钮排序后把焦点放回同方向按钮并播报新位置，移除后播报
 * @author TixXin
 * @since 2026-10-27
 */

/** group 对应行上的 data-row 前缀；announce 接收要播报的文字 */
export function useSiteNavRows(group: string, announce: (message: string) => void) {
  const { t } = useI18n()
  const keys = new WeakMap<object, number>()
  let nextKey = 0
  function itemKey(item: object) {
    const raw = toRaw(item)
    if (!keys.has(raw)) keys.set(raw, ++nextKey)
    return keys.get(raw)!
  }
  /** 移动后把焦点放回同方向的按钮（到达边界时换到另一方向），并播报新位置 */
  async function move<T>(items: T[], index: number, direction: number, name: string) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const item = items.splice(index, 1)[0]!
    items.splice(target, 0, item)
    announce(t('admin-system.siteNav.moved', { name, position: target + 1 }))
    await nextTick()
    const row = document.querySelector<HTMLElement>(`[data-row="${group}-${target}"]`)
    const same = row?.querySelector<HTMLButtonElement>(`[data-move="${direction < 0 ? 'up' : 'down'}"]`)
    const other = row?.querySelector<HTMLButtonElement>(`[data-move="${direction < 0 ? 'down' : 'up'}"]`)
    ;(same && !same.disabled ? same : other)?.focus()
  }
  function remove<T>(items: T[], index: number, name: string) {
    items.splice(index, 1)
    announce(t('admin-system.siteNav.removed', { name }))
  }
  return { itemKey, move, remove }
}
