/**
 * @file topics.ts
 * @description 朋友圈话题元信息定义，列表页/详情页/话题页共享
 * @author TixXin
 * @since 2026-04-17
 */

import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'

/** 不含 count 的话题元信息 */
export type MomentTopicMeta = Omit<MomentTopic, 'count'>

/** 话题元信息总集，新增话题在此一处声明 */
export const MOMENT_TOPIC_DEFINITIONS: MomentTopicMeta[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', description: '记录每一天的小确幸' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', description: '代码与灵感的碰撞' },
  { name: '读书笔记', icon: 'lucide:book-open', color: '#8b5cf6', description: '阅读中的思考片段' },
  { name: '摄影记录', icon: 'lucide:camera', color: '#ec4899', description: '用镜头捕捉瞬间' },
  { name: '美食探店', icon: 'lucide:utensils', color: '#ef4444', description: '味蕾的冒险旅程' },
]

/** 按名查找话题元信息 */
export function findMomentTopic(name: string): MomentTopicMeta | undefined {
  return MOMENT_TOPIC_DEFINITIONS.find((t) => t.name === name)
}
