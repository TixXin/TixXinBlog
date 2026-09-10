/**
 * @file modalFocusOrigin.ts
 * @description 记录真实指针入口，兼容点击按钮不自动聚焦的浏览器；键盘操作清除旧指针记录
 * @author TixXin
 * @since 2026-09-08
 */
interface PointerOrigin {
  target: WeakRef<HTMLElement>
  activeBefore: WeakRef<HTMLElement> | null
  time: number
}
const origins = new WeakMap<Document, PointerOrigin>()
const selector = 'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]'

export function bindModalFocusOrigin(doc: Document) {
  function pointer(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null
    if (!target || target.matches(':disabled') || target.closest('[inert]')) {
      origins.delete(doc)
      return
    }
    origins.set(doc, {
      target: new WeakRef(target),
      activeBefore: doc.activeElement instanceof HTMLElement ? new WeakRef(doc.activeElement) : null,
      time: performance.now(),
    })
  }
  const keyboard = () => origins.delete(doc)
  doc.addEventListener('pointerdown', pointer, true)
  doc.addEventListener('keydown', keyboard, true)
  return () => {
    doc.removeEventListener('pointerdown', pointer, true)
    doc.removeEventListener('keydown', keyboard, true)
    origins.delete(doc)
  }
}

export function getModalFocusOrigin(doc: Document) {
  const active = doc.activeElement instanceof HTMLElement ? doc.activeElement : null
  const origin = origins.get(doc)
  const target = origin?.target.deref()
  // 若业务主动移动了焦点（例如菜单回到书签），尊重该选择；否则使用刚点击的入口。
  if (
    origin &&
    target?.isConnected &&
    performance.now() - origin.time < 1000 &&
    (active === origin.activeBefore?.deref() ||
      // WebKit 再次点击已聚焦按钮时会先将焦点退回 body；原入口仍然是这次指针目标。
      (target === origin.activeBefore?.deref() && active === doc.body))
  )
    return target
  return active
}
