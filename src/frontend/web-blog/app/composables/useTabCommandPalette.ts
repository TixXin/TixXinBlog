/**
 * @file useTabCommandPalette.ts
 * @description 标签页命令面板状态：Cmd/Ctrl+K 打开，全局共享 open/close
 * @author TixXin
 * @since 2026-04-15
 */

export function useTabCommandPalette() {
  const paletteOpen = useState<boolean>('tab-palette-open', () => false)

  function open() {
    paletteOpen.value = true
  }

  function close() {
    paletteOpen.value = false
  }

  function toggle() {
    paletteOpen.value = !paletteOpen.value
  }

  return { paletteOpen, open, close, toggle }
}
