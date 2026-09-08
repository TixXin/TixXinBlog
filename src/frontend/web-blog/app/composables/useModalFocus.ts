/**
 * @file useModalFocus.ts
 * @description 模态弹层栈：焦点进入/约束/归还、背景隔离与滚动锁，支持嵌套弹窗
 * @author TixXin
 * @since 2026-09-07
 */
import { nextTick, onBeforeUnmount, onMounted, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { getModalFocusOrigin } from '~/utils/modalFocusOrigin'

interface Layer {
  root: HTMLElement
  extra: () => (HTMLElement | null)[]
  close: () => void
}
interface DocumentLayers {
  layers: Layer[]
  previous: Map<HTMLElement, { inert: boolean; hidden: string | null }>
  overflow: string | null
}
const documents = new WeakMap<Document, DocumentLayers>()
const releases = new Set<() => void>()
if (import.meta.hot) import.meta.hot.dispose(() => [...releases].forEach((release) => release()))
const selector = 'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]'

function visible(element: HTMLElement) {
  return (
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden' &&
    !element.closest('[inert],[hidden]')
  )
}
function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => element.tabIndex >= 0 && !element.matches(':disabled') && visible(element),
  )
}
function refreshBackground(doc: Document, state: DocumentLayers) {
  for (const [element, original] of state.previous) {
    element.inert = original.inert
    if (original.hidden === null) element.removeAttribute('aria-hidden')
    else element.setAttribute('aria-hidden', original.hidden)
  }
  state.previous.clear()
  const layer = state.layers.at(-1)
  if (!layer) {
    if (state.overflow !== null) doc.body.style.overflow = state.overflow
    state.overflow = null
    return
  }
  if (state.overflow === null) state.overflow = doc.body.style.overflow
  doc.body.style.overflow = 'hidden'
  const allowed = [layer.root, ...layer.extra()].filter(Boolean) as HTMLElement[]
  for (const child of [...doc.body.children]) {
    if (
      !(child instanceof HTMLElement) ||
      allowed.some((root) => child.contains(root)) ||
      child.hasAttribute('aria-live') ||
      ['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName)
    )
      continue
    state.previous.set(child, { inert: child.inert, hidden: child.getAttribute('aria-hidden') })
    child.inert = true
    child.setAttribute('aria-hidden', 'true')
  }
}

export function useModalFocus(
  open: MaybeRefOrGetter<boolean>,
  root: Ref<HTMLElement | null>,
  options: {
    close: () => void
    initialFocus?: () => HTMLElement | null
    extra?: () => (HTMLElement | null)[]
    /** 成功导航由新页面管理焦点；用户取消仍归还原入口。 */
    restoreFocus?: () => boolean
  },
) {
  let mounted = false
  let release: (() => void) | undefined
  let attached: HTMLElement | null = null
  function sync() {
    if (!mounted) return
    const candidate = toValue(open) ? root.value : null
    if (candidate === attached) return
    release?.()
    release = undefined
    attached = candidate
    if (!candidate) return
    const element: HTMLElement = candidate
    const doc = element.ownerDocument
    const state: DocumentLayers = documents.get(doc) ?? { layers: [], previous: new Map(), overflow: null }
    documents.set(doc, state)
    const previous = getModalFocusOrigin(doc)
    const focusKey = previous?.dataset.focusKey
    const layer: Layer = { root: element, extra: options.extra ?? (() => []), close: options.close }
    state.layers.push(layer)
    refreshBackground(doc, state)
    const top = () => state.layers.at(-1) === layer
    const focusFirst = () => {
      const preferred = options.initialFocus?.()
      const target =
        preferred && !preferred.matches(':disabled') && visible(preferred)
          ? preferred
          : (focusables(element)[0] ?? element)
      target.focus({ preventScroll: true })
    }
    function keydown(event: KeyboardEvent) {
      if (!top()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        layer.close()
      } else if (event.key === 'Tab') {
        const items = focusables(element)
        const first = items[0]
        const last = items.at(-1)
        if (!first) {
          event.preventDefault()
          element.focus()
          return
        }
        if (event.shiftKey && (doc.activeElement === first || !element.contains(doc.activeElement))) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (doc.activeElement === last || !element.contains(doc.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    function focusin(event: FocusEvent) {
      if (top() && event.target instanceof Node && !element.contains(event.target)) focusFirst()
    }
    doc.addEventListener('keydown', keydown, true)
    doc.addEventListener('focusin', focusin, true)
    focusFirst()
    // 子表单可能在 onMounted 后才解除禁用；DOM 更新后补一次初始焦点，不打断用户已发生的移动。
    const initial = doc.activeElement
    void nextTick(() => {
      if (attached === element && top() && doc.activeElement === initial) focusFirst()
    })
    let released = false
    release = () => {
      if (released) return
      released = true
      releases.delete(release!)
      const wasTop = top()
      doc.removeEventListener('keydown', keydown, true)
      doc.removeEventListener('focusin', focusin, true)
      state.layers.splice(state.layers.indexOf(layer), 1)
      refreshBackground(doc, state)
      if (!wasTop || options.restoreFocus?.() === false) return
      const replacement = focusKey
        ? [...doc.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
            (candidate) => candidate.dataset.focusKey === focusKey && visible(candidate),
          )
        : null
      const target = previous?.isConnected && visible(previous) ? previous : replacement
      if (target) target.focus({ preventScroll: true })
      else if (state.layers.length) focusables(state.layers.at(-1)!.root)[0]?.focus({ preventScroll: true })
    }
    releases.add(release)
  }
  watch([() => toValue(open), root], sync, { flush: 'post' })
  onMounted(() => {
    mounted = true
    sync()
  })
  onBeforeUnmount(() => {
    mounted = false
    release?.()
    attached = null
  })
  return {
    isTopModal: () => !!root.value && documents.get(root.value.ownerDocument)?.layers.at(-1)?.root === root.value,
  }
}
