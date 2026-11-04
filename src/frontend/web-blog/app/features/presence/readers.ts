/**
 * @file readers.ts
 * @description “正在阅读”展示规则：心跳结果须属于当前页面（路径口径与后端一致，忽略末尾斜杠），
 *   且至少两人（含自己）才显示，只有自己时返回 null。
 */
import type { LivePresence } from './types'

const normalize = (path: string) => path.split(/[?#]/, 1)[0]!.replace(/\/+$/, '') || '/'

export function readersOnPage(live: LivePresence | null, currentPath: string): number | null {
  if (!live || typeof live.readers !== 'number' || !live.path) return null
  if (normalize(live.path) !== normalize(currentPath)) return null
  return live.readers >= 2 ? live.readers : null
}
