/**
 * @file topics.ts
 * @description 朋友圈话题元信息定义，列表页/详情页/话题页共享
 * @author TixXin
 * @since 2026-04-17
 */

import type { MomentTopic } from '~/components/sidebar/MomentTopicCard.vue'
import type { Translate } from '~/utils/format'

/** 不含 count 的话题元信息 */
export type MomentTopicMeta = Omit<MomentTopic, 'count'>

/**
 * 话题元信息总集，新增话题在此一处声明。
 * 话题名与动态内容中的话题逐字匹配，不翻译；内置简介属于界面文案，按界面语言取字典
 */
const MOMENT_TOPIC_DEFINITIONS: (Omit<MomentTopicMeta, 'description'> & { descriptionKey: string })[] = [
  { name: '生活日常', icon: 'lucide:sun', color: '#f59e0b', descriptionKey: 'flash-moment.topic.descriptions.daily' },
  { name: '技术分享', icon: 'lucide:code', color: '#3b82f6', descriptionKey: 'flash-moment.topic.descriptions.tech' },
  {
    name: '读书笔记',
    icon: 'lucide:book-open',
    color: '#8b5cf6',
    descriptionKey: 'flash-moment.topic.descriptions.reading',
  },
  {
    name: '摄影记录',
    icon: 'lucide:camera',
    color: '#ec4899',
    descriptionKey: 'flash-moment.topic.descriptions.photography',
  },
  {
    name: '美食探店',
    icon: 'lucide:utensils',
    color: '#ef4444',
    descriptionKey: 'flash-moment.topic.descriptions.food',
  },
]

/** 按名查找话题元信息，简介按传入的翻译函数求值 */
export function findMomentTopic(name: string, t: Translate): MomentTopicMeta | undefined {
  const definition = MOMENT_TOPIC_DEFINITIONS.find((topic) => topic.name === name)
  if (!definition) return undefined
  const { descriptionKey, ...meta } = definition
  return { ...meta, description: t(descriptionKey) }
}
