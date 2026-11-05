<!--
  @file SubscribeCard.vue
  @description 全站唯一的 RSS 订阅入口：一个按钮打开订阅弹窗，在弹窗内选择文章、闪念或朋友圈订阅源，并说明邮件订阅尚未开放；
               embedded 用于侧栏隐藏时的紧凑抽屉
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card subscribe-card" :class="{ 'subscribe-card--embedded': embedded }">
    <div class="subscribe-card__decor" />
    <div class="subscribe-card__content">
      <h3 class="subscribe-card__title">
        <span class="subscribe-card__icon">
          <Icon name="lucide:rss" size="16" aria-hidden="true" />
        </span>
        {{ $t('article.subscribe.title') }}
      </h3>
      <p class="subscribe-card__desc">{{ $t('article.subscribe.description') }}</p>
      <!-- 全站唯一的订阅按钮：保留原生地址，普通点击由 rss-subscribe-links 插件改为打开订阅弹窗（内含三个订阅源） -->
      <a href="/rss.xml" type="application/rss+xml" class="subscribe-card__button btn-primary" aria-haspopup="dialog">
        <Icon name="lucide:rss" size="16" aria-hidden="true" />
        <span>{{ $t('article.subscribe.button') }}</span>
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
// 侧栏卡片只在宽屏显示；侧栏隐藏时页面把同一订阅内容放进紧凑抽屉，此时不受宽屏断点限制
withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
</script>

<style lang="scss" scoped>
.subscribe-card {
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
  display: none;

  @media (min-width: $breakpoint-lg) {
    display: block;
  }

  // 抽屉与筛选卡片同列排布，任何宽度都显示
  &--embedded {
    display: block;
  }
}

.subscribe-card__decor {
  position: absolute;
  right: -1.5rem;
  top: -1.5rem;
  width: 6rem;
  height: 6rem;
  background: rgba(226, 232, 240, 0.4);
  border-radius: 50%;
  filter: blur(24px);

  .dark & {
    background: rgba(71, 85, 105, 0.2);
  }
}

.subscribe-card__content {
  position: relative;
  z-index: 1;
}

.subscribe-card__title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.subscribe-card__icon {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
}

.subscribe-card__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.subscribe-card__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  width: 100%;
  border-radius: $radius-md;
  text-decoration: none;
  cursor: var(--interaction-cursor, pointer);

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
</style>
