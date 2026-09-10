<!--
  @file TechStackCard.vue
  @description 技术栈进度条卡片组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card tech-stack">
    <h3 class="tech-stack__title"><Icon name="lucide:code-2" size="14" /> 技术栈分布</h3>
    <p class="tech-stack__description">使用该技术的公开项目占比。一个项目可使用多种技术，比例不表示代码语言占比。</p>
    <p v-if="!stack.length" class="tech-stack__description">公开项目尚未填写技术标签。</p>
    <div class="tech-stack__list">
      <button
        v-for="item in stack"
        :key="item.label"
        type="button"
        class="tech-stack__item"
        :aria-label="`筛选技术：${item.label}`"
        :disabled="!interactive"
        @click="$emit('tag', item.label)"
      >
        <div class="tech-stack__meta">
          <span class="tech-stack__name">{{ item.label }}</span>
          <span class="tech-stack__percent">{{ item.count }} 项 · {{ item.percent }}%</span>
        </div>
        <div class="tech-stack__track">
          <div class="tech-stack__fill" :style="{ width: `${item.percent}%` }" />
        </div>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TechStackItem } from '~/features/project/types'

defineProps<{
  stack: TechStackItem[]
  interactive: boolean
}>()
defineEmits<{ tag: [label: string] }>()
</script>

<style lang="scss" scoped>
.tech-stack {
  padding: 1.25rem;
}
.tech-stack__description {
  color: var(--text-soft);
  font-size: 0.75rem;
  line-height: 1.65;
  margin-bottom: 0.75rem;
}
.tech-stack__item {
  min-width: 0;
  min-height: 44px;
  border: 0;
  background: transparent;
  padding: 0.25rem 0;
  text-align: left;
  cursor: pointer;
}

.tech-stack__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tech-stack__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tech-stack__meta {
  gap: 0.75rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.tech-stack__name {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-muted);
}

.tech-stack__percent {
  flex-shrink: 0;
  color: var(--text-soft);
}

.tech-stack__track {
  width: 100%;
  height: 0.375rem;
  background: var(--surface-3);
  border-radius: $radius-full;
}

.tech-stack__fill {
  height: 100%;
  border-radius: $radius-full;
  background: var(--text-muted);
  transition: width 1s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  .dark & {
    background: var(--text-soft);
  }
}
</style>
