<!--
  @file SubscribeCard.vue
  @description 邮件订阅卡片组件，提供邮箱输入和订阅按钮
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
      <p class="subscribe-card__desc">获取最新文章和技术分享，不会发送垃圾邮件。</p>
      <form class="subscribe-card__form" @submit.prevent="handleSubscribe">
        <input
          v-model="email"
          type="email"
          class="input-field subscribe-card__input"
          placeholder="输入您的邮箱..."
          required
        >
        <button type="submit" class="btn-primary subscribe-card__btn">立即订阅</button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
const email = ref('')
const { info } = useToast()

function handleSubscribe() {
  if (email.value) {
    info('邮件订阅功能开发中，敬请期待！')
    email.value = ''
  }
}
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
  width: 100%;
  border-radius: $radius-md;
}
</style>
