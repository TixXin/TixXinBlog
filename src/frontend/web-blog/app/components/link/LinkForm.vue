<!--
  @file LinkForm.vue
  @description 申请友链表单组件（纯 UI，不实现提交逻辑）
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="link-form">
    <h3 class="link-form__title">
      <Icon name="lucide:plus-circle" size="18" />
      申请友链
    </h3>
    <p class="link-form__desc">
      欢迎互换友链！请填写以下信息，我会尽快审核添加。要求：网站正常运行、内容健康、有定期更新。
    </p>
    <form class="link-form__fields" @submit.prevent="handleSubmit">
      <div class="link-form__field">
        <label class="link-form__label">站点名称</label>
        <input type="text" class="input-field" placeholder="例如：TixXin Blog" >
      </div>
      <div class="link-form__field">
        <label class="link-form__label">站点地址</label>
        <input type="url" class="input-field" placeholder="https://example.com" >
      </div>
      <div class="link-form__field">
        <label class="link-form__label">头像地址</label>
        <input type="url" class="input-field" placeholder="https://example.com/avatar.png" >
      </div>
      <div class="link-form__field">
        <label class="link-form__label">一句话描述</label>
        <input type="text" class="input-field" placeholder="简要介绍你的站点" >
      </div>
      <div class="link-form__submit">
        <button type="submit" class="btn-primary">提交申请</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const { info } = useToast()

function handleSubmit() {
  info('友链申请功能开发中，敬请期待！')
}
</script>

<style lang="scss" scoped>
.link-form {
  background: var(--surface-2);
  border-radius: $radius-card;
  padding: 1.5rem;
  border: 1px solid var(--border);
}

.link-form__title {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.link-form__desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.link-form__fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: $breakpoint-sm) {
    grid-template-columns: 1fr 1fr;
  }
}

.link-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.link-form__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.link-form__submit {
  @media (min-width: $breakpoint-sm) {
    grid-column: span 2;
  }
}
</style>
