/**
 * @file clipboard.ts
 * @description Dev 调试面板文本复制纯逻辑
 * @author TixXin
 * @since 2026-10-21
 */

/** 复制指定文本到系统剪贴板，支持成功与失败回调 */
export async function copyTextToClipboard(
  text: string,
  callbacks?: { onSuccess?: () => void; onError?: () => void },
): Promise<boolean> {
  if (!import.meta.client) return false
  try {
    await navigator.clipboard.writeText(text)
    callbacks?.onSuccess?.()
    return true
  } catch {
    callbacks?.onError?.()
    return false
  }
}
