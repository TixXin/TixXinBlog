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
  let generation = 0
  async function loaded() {
    const node = image.value
    const version = generation
    if (!node?.complete) return
    // SSR图片可能在客户端挂载监听之前就已失败，此时不会再派发error。
    if (!node.naturalWidth) {
      state.value = toValue(source) ? 'error' : 'empty'
      return
    }
    try {
      if (typeof node.decode === 'function') await node.decode()
    } catch {
      if (version === generation && image.value === node) state.value = 'error'
      return
    }
    if (version === generation && image.value === node) state.value = 'ready'
  }
  function failed(event?: Event) {
    if (event && event.target !== image.value) return
    state.value = toValue(source) ? 'error' : 'empty'
  }
  function retry() {
    attempt.value++
  }
  watch(
    [() => toValue(source), attempt],
    () => {
      generation++
      state.value = toValue(source) ? 'loading' : 'empty'
      void nextTick(loaded)
    },
    { immediate: true, flush: 'sync' },
  )
  watch(image, () => {
    void loaded()
  })
  onMounted(loaded)
  onBeforeUnmount(() => {
    generation++
  })
  return { image, state, attempt, loaded, failed, retry }
}
