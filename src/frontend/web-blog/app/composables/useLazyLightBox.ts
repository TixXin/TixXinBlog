/**
 * @file useLazyLightBox.ts
 * @description 列表卡片内灯箱的按需挂载：首次打开前不创建实例，避免每张卡片在水合后各挂一个灯箱与全局键盘监听
 * @author TixXin
 * @since 2026-11-04
 */

export function useLazyLightBox() {
  // 只在客户端点击后置为 true；SSR 与水合首帧不渲染灯箱，也不需要 ClientOnly 占位。
  const mounted = ref(false)
  const visible = ref(false)
  const index = ref(0)

  async function open(target: number) {
    index.value = target
    if (!mounted.value) {
      // 先以关闭状态挂载，下一帧再打开，首次打开也走进入过渡与焦点管理。
      mounted.value = true
      await nextTick()
    }
    visible.value = true
  }

  function close() {
    // 关闭后保留实例，离场过渡照常播放，再次打开不重建。
    visible.value = false
  }

  return { mounted, visible, index, open, close }
}
