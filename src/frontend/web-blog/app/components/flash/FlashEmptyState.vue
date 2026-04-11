<!--
  @file FlashEmptyState.vue
  @description 闪念页未登录引导
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="flash-empty">
    <div class="flash-empty__icon">
      <Icon name="lucide:zap" size="40" />
    </div>
    <h2 class="flash-empty__title">闪念是你的私人灵感空间</h2>
    <p class="flash-empty__desc">
      登录后即可记录每一个稍纵即逝的想法，配合 AI 搜索，让灵感不再失联。
    </p>
    <button type="button" class="flash-empty__button" @click="onLogin">
      <Icon name="lucide:log-in" size="14" />
      立即登录
    </button>
  </div>
</template>

<script setup lang="ts">
const { open } = useLoginDrawer()
function onLogin() {
  open('login')
}
</script>

<style lang="scss" scoped>
.flash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3.5rem 1.5rem;
  background: var(--surface-1);
  border: 1px dashed var(--border);
  border-radius: $radius-card;
}

.flash-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: $radius-full;
  background: var(--accent-soft);
  color: var(--accent);
  margin-bottom: 1rem;
}

.flash-empty__title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-main);
}

.flash-empty__desc {
  margin: 0 0 1.25rem;
  max-width: 22rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--text-soft);
}

.flash-empty__button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.125rem;
  border: none;
  border-radius: $radius-md;
  background: var(--accent);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.88;
  }
}
</style>
