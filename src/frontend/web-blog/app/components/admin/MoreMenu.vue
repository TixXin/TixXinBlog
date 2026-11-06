<!--
  @file MoreMenu.vue
  @description 后台列表项的“更多”操作菜单：原生 details/summary，键盘与读屏可用；选择任一项、点击菜单外或按 Esc 后收起，
               Esc 时焦点回到“更多”按钮
  @author TixXin
  @since 2026-11-06
-->

<template>
  <details ref="root" class="admin-more" @toggle="onToggle">
    <summary class="admin-btn" :aria-label="label">
      <Icon name="lucide:ellipsis" aria-hidden="true" />{{ $t('admin-system.layout.more') }}
    </summary>
    <div class="admin-more__menu" @click="close()">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
defineProps<{ label?: string }>()
const root = ref<HTMLDetailsElement | null>(null)
function close(restoreFocus = false) {
  if (!root.value?.open) return
  root.value.open = false
  if (restoreFocus) root.value.querySelector('summary')?.focus()
}
function onOutside(event: Event) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true)
}
function onToggle() {
  if (root.value?.open) {
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onOutside)
    document.removeEventListener('keydown', onKeydown)
  }
}
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>
