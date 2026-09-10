<!--
  @file LinkRules.vue
  @description 友链须知卡片组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card link-rules">
    <h3 class="link-rules__title"><Icon name="lucide:link" size="14" /> 友链须知</h3>
    <div class="link-rules__list">
      <div v-for="(rule, index) in rules" :key="index" class="link-rules__item">
        <span class="link-rules__badge">{{ index + 1 }}</span>
        <p>{{ rule }}</p>
      </div>
    </div>
    <p v-if="!rules.length" class="link-rules__empty">暂无额外友链须知。</p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  rules: string[]
}>()
</script>

<style lang="scss" scoped>
.link-rules {
  padding: 1.25rem;
  overflow-wrap: anywhere;
}
.link-rules__empty {
  font-size: 0.8125rem;
  color: var(--text-soft);
}

.link-rules__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.link-rules__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.link-rules__item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;

  p {
    margin: 0;
  }
}

.link-rules__badge {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: $radius-full;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0.125rem;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
}
</style>
