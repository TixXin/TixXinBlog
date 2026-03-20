<!--
  @file ContactCards.vue
  @description 联系方式网格组件，展示各类联系渠道
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="contact-cards">
    <h3 class="contact-cards__title">
      <Icon name="lucide:send" size="18" /> 联系我
    </h3>
    <div class="contact-cards__grid">
      <a
        v-for="c in contacts"
        :key="c.type"
        :href="c.href"
        class="contact-cards__item"
        target="_blank"
        rel="noopener"
      >
        <div class="contact-cards__icon">
          <Icon :name="c.icon" size="20" />
        </div>
        <div>
          <p class="contact-cards__type">{{ c.type }}</p>
          <p class="contact-cards__value">{{ c.value }}</p>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContactItem } from '~/features/about/types'

defineProps<{
  contacts: ContactItem[]
}>()
</script>

<style lang="scss" scoped>
.contact-cards__title {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.contact-cards__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.contact-cards__item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-card;
  text-decoration: none;
  color: inherit;
  transition: $transition-normal;

  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);

    .contact-cards__icon {
      background: var(--accent);
      color: #fff;
    }
  }
}

.contact-cards__icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: $radius-md;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-soft);
  flex-shrink: 0;
  transition: $transition-fast;
}

.contact-cards__type {
  font-size: 0.75rem;
  font-weight: 700;
  margin: 0;
}

.contact-cards__value {
  font-size: 11px;
  color: var(--text-soft);
  margin: 0;
}
</style>
