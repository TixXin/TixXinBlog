/**
 * @file reactions.ts
 * @description 留言互动表情定义与元数据映射
 * @author TixXin
 * @since 2026-10-21
 */

export interface ReactionOption {
  value: string
  icon: string
  labelKey: string
}

/** 保留示例数据的反应值，界面统一使用 Lucide 与明确名称 */
export const REACTION_OPTIONS: readonly ReactionOption[] = [
  { value: '👍', icon: 'lucide:thumbs-up', labelKey: 'interaction.reactions.like' },
  { value: '❤️', icon: 'lucide:heart', labelKey: 'interaction.reactions.love' },
  { value: '🎉', icon: 'lucide:party-popper', labelKey: 'interaction.reactions.celebrate' },
  { value: '🔥', icon: 'lucide:flame', labelKey: 'interaction.reactions.fire' },
  { value: '😄', icon: 'lucide:smile', labelKey: 'interaction.reactions.smile' },
  { value: '🙏', icon: 'lucide:hand-heart', labelKey: 'interaction.reactions.thanks' },
  { value: '📷', icon: 'lucide:camera', labelKey: 'interaction.reactions.camera' },
  { value: '💡', icon: 'lucide:lightbulb', labelKey: 'interaction.reactions.idea' },
]

export function reactionMeta(value: string): ReactionOption {
  return (
    REACTION_OPTIONS.find((option) => option.value === value) ?? {
      value,
      icon: 'lucide:smile',
      labelKey: 'interaction.reactions.default',
    }
  )
}
