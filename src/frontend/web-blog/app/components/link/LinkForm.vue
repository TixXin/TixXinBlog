<!--
  @file LinkForm.vue
  @description 整理友链资料供本机复制，明确在线申请尚未开放
  @author TixXin
  @since 2025-03-17
-->

<template>
  <div class="link-form">
    <h3 class="link-form__title">
      <Icon name="lucide:plus-circle" size="18" />
      申请友链
    </h3>
    <p class="link-form__desc">在线申请尚未开放。你可以在下方整理并复制友链资料；内容不会自动提交给博主。</p>
    <form class="link-form__fields" @submit.prevent="handleSubmit">
      <div class="link-form__field">
        <label class="link-form__label" for="friend-name">站点名称</label>
        <input
          id="friend-name"
          v-model="form.name"
          type="text"
          class="input-field"
          placeholder="例如：TixXin Blog"
          maxlength="40"
          required
        />
      </div>
      <div class="link-form__field">
        <label class="link-form__label" for="friend-url">站点地址</label>
        <input
          id="friend-url"
          v-model="form.url"
          type="url"
          class="input-field"
          placeholder="https://example.com"
          pattern="https?://.+"
          required
        />
      </div>
      <div class="link-form__field">
        <label class="link-form__label" for="friend-avatar">头像地址</label>
        <input
          id="friend-avatar"
          v-model="form.avatar"
          type="url"
          class="input-field"
          placeholder="https://example.com/avatar.png"
          pattern="https?://.+"
          required
        />
      </div>
      <div class="link-form__field">
        <label class="link-form__label" for="friend-description">一句话描述</label>
        <input
          id="friend-description"
          v-model="form.description"
          type="text"
          class="input-field"
          placeholder="简要介绍你的站点"
          maxlength="60"
          required
        />
      </div>
      <div class="link-form__submit">
        <button type="submit" class="btn-primary" :disabled="!isValid">复制友链资料</button>
        <p v-if="copyError" role="alert">复制失败，资料已保留。请手动复制各字段。</p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
const { success } = useToast()
const copyError = ref(false)

const form = reactive({
  name: '',
  url: '',
  avatar: '',
  description: '',
})

// 简单的 URL 校验：必须以 http(s) 开头，避免协议缺失或填错
const URL_PATTERN = /^https?:\/\/.+/i

const isValid = computed(
  () =>
    form.name.trim().length > 0 &&
    URL_PATTERN.test(form.url.trim()) &&
    URL_PATTERN.test(form.avatar.trim()) &&
    form.description.trim().length > 0,
)

async function handleSubmit() {
  if (!isValid.value) return
  copyError.value = false
  try {
    await navigator.clipboard.writeText(
      `站点名称：${form.name.trim()}\n站点地址：${form.url.trim()}\n头像地址：${form.avatar.trim()}\n一句话描述：${form.description.trim()}`,
    )
    success('友链资料已复制，尚未提交申请')
  } catch {
    copyError.value = true
  }
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
