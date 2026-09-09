<!--
  @file ChatRules.vue
  @description 留言板对话守则卡片，编号列表与友链须知一致的卡片模式
  @author TixXin
  @since 2026-03-20
-->

<template>
  <section class="card chat-rules">
    <h3 class="chat-rules__title">
      <Icon name="lucide:shield" size="14" />
      对话守则
    </h3>
    <div class="chat-rules__list">
      <div v-for="rule in rules" :key="rule.id" class="chat-rules__item">
        <span class="chat-rules__badge">{{ rule.id }}</span>
        <p>{{ rule.text }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ChatRule } from '~/features/guestbook/types'

defineProps<{
  rules: ChatRule[]
}>()
</script>

<style lang="scss" scoped>
.chat-rules {
  padding: 1.25rem;
}

.chat-rules__title {
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-main);

  :deep(svg),
  :deep(.icon) {
    color: var(--text-soft);
  }
}

.chat-rules__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chat-rules__item {
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

.chat-rules__badge {
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
