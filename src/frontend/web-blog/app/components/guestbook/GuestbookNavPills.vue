<!--
  @file GuestbookNavPills.vue
  @description 留言板浮动导航入口：定位中状态、返回原留言胶囊与滚动至最新按钮
  @author TixXin
  @since 2026-10-21
-->

<template>
  <!-- 跳转引用时的查找进度与返回入口 -->
  <p v-if="locating" class="guestbook-jump-pill" role="status">
    <Icon name="lucide:loader-2" size="14" class="guestbook-jump-pill__spin" />{{
      $t('interaction.guestbook.locating')
    }}
  </p>
  <button v-else-if="jumpOrigin !== null" type="button" class="guestbook-jump-pill" @click="$emit('backToOrigin')">
    <Icon name="lucide:corner-down-left" size="14" />{{ $t('interaction.guestbook.backToOrigin') }}
  </button>
  <button
    v-if="isChatMode && !atBottom"
    type="button"
    class="guestbook-scroll-bottom"
    :aria-label="$t('interaction.guestbook.scrollLatest')"
    @click="$emit('scrollLatest')"
  >
    <Icon name="lucide:arrow-down" size="18" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  locating: boolean
  jumpOrigin: number | null
  isChatMode: boolean
  atBottom: boolean
}>()

defineEmits<{
  backToOrigin: []
  scrollLatest: []
}>()
</script>

<style scoped lang="scss">
.guestbook-jump-pill {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  z-index: 5;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 44px;
  margin: 0;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-1);
  box-shadow: var(--shadow-card);
  color: var(--text-main);
  font-size: 0.75rem;
  white-space: nowrap;
}

button.guestbook-jump-pill {
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    border-color: var(--border-hover);
  }
}

.guestbook-jump-pill__spin {
  animation: spin 1.2s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

.guestbook-scroll-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 6;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
}
</style>
