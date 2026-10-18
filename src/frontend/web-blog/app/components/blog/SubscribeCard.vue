<!--
  @file SubscribeCard.vue
  @description 文章、闪念与朋友圈 RSS 订阅入口，并说明邮件订阅尚未开放；embedded 用于侧栏隐藏时的紧凑抽屉
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
        订阅更新
      </h3>
      <p class="subscribe-card__desc">使用 RSS 阅读器分别订阅文章、闪念和朋友圈更新，邮件订阅尚未开放。</p>
      <div class="subscribe-card__feeds">
        <BlogRssLink href="/rss.xml" label="文章" />
        <BlogRssLink href="/flash.xml" label="闪念" />
        <BlogRssLink href="/moments.xml" label="朋友圈" />
      </div>
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

.subscribe-card__feeds {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
