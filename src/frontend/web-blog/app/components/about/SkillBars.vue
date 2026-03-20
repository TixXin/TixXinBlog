<!--
  @file SkillBars.vue
  @description 技能进度条组件，以双列网格展示技能熟练度
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="skill-bars">
    <h3 class="skill-bars__title">
      <Icon name="lucide:zap" size="18" /> 技能栈
    </h3>
    <div class="skill-bars__grid">
      <div v-for="skill in skills" :key="skill.name" class="skill-bars__item">
        <div class="skill-bars__meta">
          <span class="skill-bars__name">{{ skill.name }}</span>
          <span class="skill-bars__percent">{{ skill.percent }}%</span>
        </div>
        <div class="skill-bars__track">
          <div class="skill-bars__fill" :style="{ width: `${skill.percent}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillItem } from '~/features/about/types'

defineProps<{
  skills: SkillItem[]
}>()
</script>

<style lang="scss" scoped>
.skill-bars {
  margin-bottom: 2.5rem;
}

.skill-bars__title {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.skill-bars__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem 2rem;

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.skill-bars__meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.375rem;
}

.skill-bars__name {
  font-weight: 500;
}

.skill-bars__percent {
  color: var(--text-soft);
}

.skill-bars__track {
  width: 100%;
  height: 0.5rem;
  background: var(--surface-3);
  border-radius: $radius-full;
}

.skill-bars__fill {
  height: 100%;
  border-radius: $radius-full;
  background: var(--text-main);
  transition: width 1s ease;

  .dark & {
    background: var(--text-soft);
  }
}
</style>
