<!--
  @file ExperienceTimeline.vue
  @description 经历时间线组件，按时间顺序展示职业和学历经历
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="timeline">
    <h3 class="timeline__title">
      <Icon name="lucide:clock" size="18" /> 经历时间线    </h3>
    <div class="timeline__track">
      <div
        v-for="(exp, idx) in experiences"
        :key="exp.period"
        class="timeline__item"
      >
        <div class="timeline__dot" :class="`timeline__dot--${idx}`" />
        <span class="timeline__period">{{ exp.period }}</span>
        <h4 class="timeline__role">{{ exp.title }}</h4>
        <p class="timeline__desc">{{ exp.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ExperienceItem } from '~/features/about/types'

defineProps<{
  experiences: ExperienceItem[]
}>()
</script>

<style lang="scss" scoped>
.timeline {
  margin-bottom: 2.5rem;
}

.timeline__title {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.timeline__track {
  margin-left: 0.75rem;
  border-left: 2px solid var(--border-soft);
  padding-left: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.timeline__item {
  position: relative;
}

.timeline__dot {
  position: absolute;
  left: calc(-2rem - 0.5rem - 1px);
  top: 0;
  width: 1rem;
  height: 1rem;
  border-radius: $radius-full;
  border: 2px solid var(--surface-1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &--0 { background: var(--text-main); }
  &--1 { background: var(--text-soft); }
  &--2 { background: var(--text-faint); }
  &--3 { background: var(--border-soft); }
}

.timeline__period {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--surface-3);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  margin-bottom: 0.25rem;
  color: var(--text-muted);
}

.timeline__role {
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
}

.timeline__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
  line-height: 1.6;
}
</style>
