/**
 * @file useImageState.ts
 * @description 图片加载、解码、失败及重试状态，忽略旧地址和卸载后的迟到事件
 * @author TixXin
 * @since 2026-09-07
 */
import type { MaybeRefOrGetter } from 'vue'

export function useImageState(source: MaybeRefOrGetter<string | undefined>) {
  const image = ref<HTMLImageElement | null>(null)
  const state = ref<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const attempt = ref(0)
  const nodeGenerations = new WeakMap<HTMLImageElement, number>()
  let generation = 0
  let decoding = 0
  let disposed = false

  function isCurrent(node: HTMLImageElement | null, version = generation) {
    return (
      !disposed && !!node && image.value === node && nodeGenerations.get(node) === version && version === generation
    )
  }

  async function loaded(event?: Event) {
    const node = image.value
    const version = generation
    if ((event && event.target !== node) || !isCurrent(node, version) || !node?.complete) return
    const decodeVersion = ++decoding
    // SSR图片可能在客户端挂载监听之前就已失败，此时不会再派发error。
    if (!node.naturalWidth) {
      state.value = toValue(source) ? 'error' : 'empty'
      return
    }
    try {
      if (typeof node.decode === 'function') await node.decode()
    } catch {
      if (isCurrent(node, version) && decodeVersion === decoding) state.value = 'error'
      return
    }
    if (isCurrent(node, version) && decodeVersion === decoding) state.value = 'ready'
  }
  function failed(event?: Event) {
    if ((event && event.target !== image.value) || !isCurrent(image.value)) return
    decoding++
    state.value = toValue(source) ? 'error' : 'empty'
  }

  function restart() {
    if (disposed) return
    generation++
    decoding++
    state.value = toValue(source) ? 'loading' : 'empty'
    // 地址变化和重试都替换节点，旧资源事件不能覆盖新请求，也不污染图片 URL。
    attempt.value++
  }
  function retry() {
    if (toValue(source)) restart()
  }
  watch(() => toValue(source), restart, { immediate: true, flush: 'sync' })
  watch(
    image,
    (node) => {
      if (!node || disposed) return
      nodeGenerations.set(node, generation)
      void loaded()
    },
    { flush: 'sync' },
  )
  onMounted(loaded)
  onBeforeUnmount(() => {
    disposed = true
    generation++
    decoding++
  })
  return { image, state, attempt, loaded, failed, retry }
}
