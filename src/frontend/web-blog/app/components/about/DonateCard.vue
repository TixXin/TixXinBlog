<!--
  @file DonateCard.vue
  @description 打赏卡片组件，用于关于页和文章详情页
  @author TixXin
  @since 2025-03-17
-->

<template>
  <section class="card donate-card">
    <div class="donate-card__decor" />
    <div class="donate-card__content">
      <h3 class="donate-card__title">
        <span class="donate-card__icon">
          <Icon name="lucide:coffee" size="16" />
        </span>
        请我喝咖啡      </h3>
      <p class="donate-card__desc">如果我的文章对你有帮助，欢迎请我喝杯咖啡</p>
      <button class="btn-primary donate-card__btn">打赏支持</button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.donate-card {
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
}

.donate-card__decor {
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

.donate-card__content {
  position: relative;
  z-index: 1;
}

.donate-card__title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.donate-card__icon {
  width: 2rem;
  height: 2rem;
  border-radius: $radius-sm;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.donate-card__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.donate-card__btn {
  width: 100%;
  border-radius: $radius-md;
}
</style>
