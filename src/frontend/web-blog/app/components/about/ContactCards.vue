<!--
  @file ContactCards.vue
  @description 联系方式网格组件，展示各类联系渠道
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="contact-cards" aria-labelledby="about-contact-title">
    <!-- 与资料栏目同为 h2，保持标题层级连续 -->
    <h2 id="about-contact-title" class="contact-cards__title">
      <Icon name="lucide:send" size="18" /> {{ $t('misc.about.contact.title') }}
    </h2>
    <div class="contact-cards__grid">
      <a
        v-for="(c, index) in contacts"
        :key="`${index}-${c.href}`"
        :href="c.href"
        class="contact-cards__item"
        v-bind="externalLinkAttrs(c.href)"
      >
        <div class="contact-cards__icon">
          <Icon :name="c.icon" size="20" />
        </div>
        <div class="contact-cards__text">
          <p class="contact-cards__type">{{ c.type }}</p>
          <p class="contact-cards__value">{{ c.value }}</p>
        </div>
      </a>
      <!-- 留言板入口：静态发布没有后端、导航隐藏留言板时不出现 -->
      <NuxtLink v-if="guestbook" to="/guestbook" class="contact-cards__item">
        <div class="contact-cards__icon">
          <Icon name="lucide:message-square" size="20" />
        </div>
        <div class="contact-cards__text">
          <p class="contact-cards__type">{{ $t('misc.about.contact.guestbook') }}</p>
          <p class="contact-cards__value">{{ $t('misc.about.contact.guestbookValue') }}</p>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ContactItem } from '~/features/about/types'
import { externalLinkAttrs } from '~/features/about/links'

defineProps<{
  contacts: ContactItem[]
  guestbook?: boolean
}>()
</script>

<style lang="scss" scoped>
/* 标题与卡片网格沿用资料栏目（经历、技能、书单）的版式，保持整页节奏一致 */
.contact-cards {
  margin-block: 2rem;
}

.contact-cards__title {
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.contact-cards__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.75rem;
}

.contact-cards__item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
  padding: 0.875rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  text-decoration: none;
  color: inherit;
  transition: $transition-normal;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    box-shadow: var(--shadow-card-hover);
    border-color: var(--border-hover);

    .contact-cards__icon {
      background: var(--accent-action);
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
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.contact-cards__text {
  min-width: 0;
}

.contact-cards__type {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.contact-cards__value {
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--text-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}
</style>
