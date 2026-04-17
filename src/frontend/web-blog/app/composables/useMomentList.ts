/**
 * @file useMomentList.ts
 * @description 闪念列表的响应式状态层，包裹 mockMoments 以支持运行时新增
 * @author TixXin
 * @since 2026-04-17
 */

import { mockMoments } from '~/features/moment/mock'
import type { MomentItem } from '~/features/moment/types'

export type MomentDraft = Omit<MomentItem, 'id' | 'date' | 'likes' | 'isLiked'>

export function useMomentList() {
  // useState 在 SSR/CSR 共享，编辑器新增会立刻在列表/详情/话题页生效
  const list = useState<MomentItem[]>('moment-list', () => [...mockMoments])

  /** 创建新动态，自动补全 id/date/likes 等运行时字段 */
  function create(draft: MomentDraft): MomentItem {
    const item: MomentItem = {
      ...draft,
      id: `m-${Date.now()}`,
      date: new Date().toISOString(),
      likes: 0,
      isLiked: false,
    }
    list.value = [item, ...list.value]
    return item
  }

  /** 按 id 查找单条 */
  function findById(id: string): MomentItem | null {
    return list.value.find((m) => m.id === id) ?? null
  }

  return { list, create, findById }
}
