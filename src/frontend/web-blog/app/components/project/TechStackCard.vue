<!--
  @file TechStackCard.vue
  @description 技术栈进度条卡片组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card tech-stack">
    <h3 class="tech-stack__title"><Icon name="lucide:code-2" size="14" /> 技术栈示例</h3>
    <div class="tech-stack__list">
      <div v-for="item in stack" :key="item.name" class="tech-stack__item">
        <div class="tech-stack__meta">
          <span class="tech-stack__name">{{ item.name }}</span>
          <span class="tech-stack__percent">{{ item.percent }}%</span>
        </div>
        <div class="tech-stack__track">
          <div class="tech-stack__fill" :style="{ width: `${item.percent}%` }" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TechStackItem } from '~/features/project/types'

defineProps<{
  stack: TechStackItem[]
}>()
</script>

<style lang="scss" scoped>
.tech-stack {
  padding: 1.25rem;
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
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.tech-stack__name {
  color: var(--text-muted);
}

.tech-stack__percent {
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
