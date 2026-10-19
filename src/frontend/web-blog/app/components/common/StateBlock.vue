<!--
  @file StateBlock.vue
  @description 通用状态提示组件，用于空态、404、500 等场景的居中图文提示
  @author TixXin
  @since 2026-03-23
-->

<template>
  <div class="state-block">
    <div class="state-block__icon-wrap">
      <Icon :name="icon" size="48" class="state-block__icon" />
    </div>
    <component :is="`h${level}`" class="state-block__title">{{ title }}</component>
    <p v-if="description" class="state-block__desc">{{ description }}</p>
    <span v-if="statusCode" class="state-block__code">{{ statusCode }}</span>
    <!-- 传入 actionHref 时渲染为链接：水合前或脚本失效时按原生链接跳转，水合后仍交给 action 事件处理 -->
    <a v-if="actionLabel && actionHref" :href="actionHref" class="state-block__action" @click="onLinkClick">
      <Icon name="lucide:arrow-left" size="14" />
      {{ actionLabel }}
    </a>
    <button v-else-if="actionLabel" type="button" class="state-block__action" @click="$emit('action')">
      <Icon name="lucide:arrow-left" size="14" />
      {{ actionLabel }}
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    title: string
    description?: string
    statusCode?: number | string
    actionLabel?: string
    /** 操作的目标地址；提供时操作渲染为链接，实现渐进增强 */
    actionHref?: string
    /** 标题级别：页面内区块用默认 2；整页错误/空态且页面没有其他标题时传 1 */
    level?: 1 | 2 | 3
  }>(),
  { description: undefined, statusCode: undefined, actionLabel: undefined, actionHref: undefined, level: 2 },
)

const emit = defineEmits<{
  action: []
}>()

/** 普通左键点击交给 action 处理；带修饰键或非主键点击保留浏览器默认行为（如新标签页打开） */
function onLinkClick(event: MouseEvent) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('action')
}
</script>

<style lang="scss" scoped>
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 2rem;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
}

.state-block__icon-wrap {
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-3);
  margin-bottom: 0.75rem;
}

.state-block__icon {
  color: var(--text-soft);
}

.state-block__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.state-block__desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
  max-width: 24rem;
  line-height: 1.6;
}

.state-block__code {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-faint);
  line-height: 1;
  margin-bottom: 0.25rem;
}

.state-block__action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-main);
  background: var(--surface-3);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  cursor: var(--interaction-cursor, pointer);
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  text-decoration: none;

  &:hover {
    background: var(--accent-soft);
    border-color: var(--border-hover);
  }
}
</style>
