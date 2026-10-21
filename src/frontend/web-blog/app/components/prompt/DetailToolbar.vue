<!-- @file DetailToolbar.vue @description 提示词阅读浮层顶栏：草稿徽章、前后导航与关闭按钮 -->
<template>
  <header class="prompt-detail__toolbar">
    <span
      ><Icon :name="draft ? 'lucide:lock-keyhole' : 'lucide:aperture'" size="15" />{{
        draft ? $t('misc.prompt.detail.draftBadge') : $t('misc.prompt.detail.badge')
      }}</span
    >
    <nav
      v-if="navigationCount > 1 && position > 0"
      class="prompt-detail__navigation"
      :aria-label="$t('misc.prompt.detail.navigationLabel')"
    >
      <CommonTooltip :content="$t('misc.prompt.detail.navigationHint')" placement="bottom"
        ><span class="prompt-detail__navigation-count">{{
          $t('misc.prompt.detail.position', { position, total: navigationCount })
        }}</span></CommonTooltip
      >
      <button
        type="button"
        :aria-label="$t('misc.prompt.detail.previous')"
        :aria-disabled="!canPrevious || pending"
        @click="requestMove(-1, $event)"
      >
        <Icon name="lucide:chevron-left" size="18" />
      </button>
      <button
        type="button"
        :aria-label="$t('misc.prompt.detail.next')"
        :aria-disabled="!canNext || pending"
        @click="requestMove(1, $event)"
      >
        <Icon name="lucide:chevron-right" size="18" />
      </button>
    </nav>
    <button
      class="prompt-detail__close"
      type="button"
      :aria-label="$t('misc.prompt.detail.close')"
      @click="$emit('close')"
    >
      <Icon name="lucide:x" size="20" />
    </button>
  </header>
</template>
<script setup lang="ts">
const props = defineProps<{
  draft: boolean
  navigationCount: number
  position: number
  canPrevious: boolean
  canNext: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  previous: []
  next: []
  close: []
}>()

function requestMove(direction: -1 | 1, event: MouseEvent) {
  if (props.pending || (direction < 0 ? !props.canPrevious : !props.canNext)) return
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  if (direction < 0) emit('previous')
  else emit('next')
}
</script>
<style scoped lang="scss">
.prompt-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 0.6rem 0.9rem 0.6rem 1.4rem;
  border-bottom: 1px solid var(--border);
}
.prompt-detail__toolbar > span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.prompt-detail__navigation {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
  margin-right: 0.75rem;
}
.prompt-detail__navigation-count {
  margin-right: 0.45rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.prompt-detail__navigation button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
}
.prompt-detail__navigation button:not([aria-disabled='true']):hover {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.prompt-detail__close {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  z-index: 3;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface-1);
  color: var(--text-main);
}
.prompt-detail__close:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
button:disabled,
button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}
button {
  cursor: var(--interaction-cursor, pointer);
}
@media (max-width: 480px) {
  .prompt-detail__toolbar > span {
    font-size: 0.68rem;
  }
  .prompt-detail__navigation {
    gap: 0.2rem;
    margin-right: 0.35rem;
  }
  .prompt-detail__navigation-count {
    font-size: 0.65rem;
    margin-right: 0.25rem;
  }
  .prompt-detail__navigation button {
    width: 36px;
  }
}
</style>
