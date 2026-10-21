/**
 * @file themeSwitchScroll.ts
 * @description 布局主题切换会替换 RootLayout（整树重挂），切换前记录滚动位置与焦点，切换后尽力恢复
 * @author TixXin
 * @since 2026-10-22
 */

/** 主题布局内部滚动容器与文章视口；替换根组件后节点会重建，只能按 DOM 顺序近似恢复 */
const SCROLL_ROOT_SELECTOR = '.custom-scrollbar__viewport, .article-viewport'

export interface ThemeSwitchSnapshot {
  windowY: number
  scrollTops: number[]
  focusKey: string | null
  focusId: string | null
}

function activeElement(doc: Document): HTMLElement | null {
  const active = doc.activeElement
  return active instanceof HTMLElement && active !== doc.body ? active : null
}

export function captureThemeSwitchSnapshot(doc: Document = document): ThemeSwitchSnapshot | null {
  if (!doc.defaultView) return null
  const active = activeElement(doc)
  return {
    windowY: doc.defaultView.scrollY,
    scrollTops: Array.from(doc.querySelectorAll<HTMLElement>(SCROLL_ROOT_SELECTOR)).map((element) => element.scrollTop),
    focusKey: active?.dataset.focusKey ?? null,
    focusId: active && active.id ? active.id : null,
  }
}

export function restoreThemeSwitchSnapshot(snapshot: ThemeSwitchSnapshot | null, doc: Document = document): void {
  if (!snapshot || !doc.defaultView) return
  // 页面级滚动（aurora/dock 走 window，nexus 走内部 scrollbar）两者都尝试，恢复失败不影响主题切换
  if (snapshot.windowY > 0) doc.defaultView.scrollTo({ top: snapshot.windowY, behavior: 'instant' })
  const roots = Array.from(doc.querySelectorAll<HTMLElement>(SCROLL_ROOT_SELECTOR))
  roots.forEach((element, index) => {
    const top = snapshot.scrollTops[index]
    if (typeof top === 'number' && top > 0 && element.scrollTop !== top) element.scrollTop = top
  })
  restoreFocus(snapshot, doc)
}

function restoreFocus(snapshot: ThemeSwitchSnapshot, doc: Document) {
  const current = activeElement(doc)
  // 用户在新布局里已经主动聚焦时不抢焦点
  if (current && current !== doc.body) return
  const target =
    (snapshot.focusKey ? doc.querySelector<HTMLElement>(`[data-focus-key="${snapshot.focusKey}"]`) : null) ??
    (snapshot.focusId ? doc.getElementById(snapshot.focusId) : null) ??
    doc.getElementById('main-content')
  target?.focus({ preventScroll: true })
}
