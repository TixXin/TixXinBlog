<!--
  @file SubscribeCard.vue
  @description 可用RSS订阅入口，并说明邮件订阅尚未开放
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card subscribe-card">
    <div class="subscribe-card__decor" />
    <div class="subscribe-card__content">
      <h3 class="subscribe-card__title">
        <span class="subscribe-card__icon">
          <Icon name="lucide:mail" size="16" />
        </span>
        订阅更新
      </h3>
      <p class="subscribe-card__desc">使用RSS阅读器订阅最新文章。邮件订阅尚未开放。</p>
      <a href="/rss.xml" class="btn-primary subscribe-card__btn"><Icon name="lucide:rss" size="16" />RSS订阅</a>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.subscribe-card {
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
  display: none;

  @media (min-width: $breakpoint-lg) {
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

.subscribe-card__form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.subscribe-card__input {
  border-radius: $radius-md;
  padding: 0.5rem 1rem;
}

.subscribe-card__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: 0.5rem;
  width: 100%;
  border-radius: $radius-md;
}
</style>
