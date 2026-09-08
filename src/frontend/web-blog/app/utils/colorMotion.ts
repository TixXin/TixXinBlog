/**
 * @file colorMotion.ts
 * @description 文档级颜色事务：最后请求生效，旧完成回调不得清理新状态
 * @author TixXin
 * @since 2026-09-07
 */
import { nextTick } from 'vue'

interface ColorTask {
  key?: string
  cancel: () => void
  settle: () => void
}
const tasks = new WeakMap<Document, ColorTask>()
const disposers = new Set<() => void>()
if (import.meta.hot) import.meta.hot.dispose(() => [...disposers].forEach((dispose) => dispose()))

export function hasColorMotion(doc: Document) {
  return tasks.has(doc)
}
export function settleColorMotion(doc: Document) {
  tasks.get(doc)?.settle()
}

export function runColorMotion(options: {
  doc: Document
  preset: 'instant' | 'fade' | 'blur' | 'circle'
  direction?: 'expand' | 'retract'
  apply: () => void
  animate?: () => Animation
  key?: string
}) {
  const { doc, preset } = options
  const previous = tasks.get(doc)
  if (options.key !== undefined && previous?.key === options.key) return
  previous?.cancel()
  const root = doc.documentElement
  let transition: ViewTransition | undefined
  let animation: Animation | undefined
  let frame = 0
  let ended = false
  let instantStarted = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const current = () => tasks.get(doc) === task && !ended
  const clear = () => {
    if (ended) return
    ended = true
    if (timer) clearTimeout(timer)
    cancelAnimationFrame(frame)
    animation?.cancel()
    if (tasks.get(doc) !== task) return
    disposers.delete(task.cancel)
    tasks.delete(doc)
    delete root.dataset.colorModeAnim
    delete root.dataset.colorModeAnimDir
  }
  const apply = async () => {
    if (!current()) return
    options.apply()
    await nextTick()
  }
  const instant = async () => {
    if (!current() || instantStarted) return
    instantStarted = true
    transition?.skipTransition()
    animation?.cancel()
    root.dataset.colorModeAnim = 'instant'
    await apply()
    if (!current()) return
    // 在解除颜色插值抑制前提交一次实际样式；仅读样式，不测量布局。
    getComputedStyle(doc.body).getPropertyValue('background-color')
    if (doc.hidden) {
      clear()
      return
    }
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(clear)
    })
  }
  const task: ColorTask = {
    key: options.key,
    cancel: () => {
      transition?.skipTransition()
      clear()
    },
    settle: () => {
      void instant()
    },
  }
  tasks.set(doc, task)
  disposers.add(task.cancel)
  root.dataset.colorModeAnim = preset
  if (options.direction) root.dataset.colorModeAnimDir = options.direction
  else delete root.dataset.colorModeAnimDir
  if (preset === 'instant' || typeof doc.startViewTransition !== 'function') {
    void instant()
    return
  }
  try {
    transition = doc.startViewTransition(apply)
    void transition.ready
      .then(() => {
        if (current() && options.animate) {
          animation = options.animate()
          // cancel产生的AbortError是正常收尾，其他动画失败降级为当前目标色。
          void animation.finished.catch((error: unknown) => {
            if ((error as { name?: string })?.name !== 'AbortError' && current()) void instant()
          })
        }
      })
      .catch(() => {
        if (current()) void instant()
      })
    void transition.finished.then(
      () => {
        if (!instantStarted) clear()
      },
      () => {
        if (current()) void instant()
      },
    )
    // 浏览器取消或切入后台也不能让根覆盖层无限存续。
    timer = setTimeout(() => {
      if (current()) void instant()
    }, 4000)
  } catch {
    void instant()
  }
}
