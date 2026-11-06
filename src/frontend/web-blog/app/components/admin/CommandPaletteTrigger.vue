<!--
  @file CommandPaletteTrigger.vue
  @description 后台页头的命令面板入口：搜索图标、文字与按平台显示的快捷键提示（Mac 为 ⌘K，其余为 Ctrl K）；窄屏只留图标
  @author TixXin
  @since 2026-11-06
-->

<template>
  <button
    type="button"
    class="admin-command-trigger"
    :aria-label="t('admin-system.command.open')"
    :aria-keyshortcuts="mac ? 'Meta+K' : 'Control+K'"
    :title="t('admin-system.command.shortcut', { key: shortcut })"
    @click="$emit('open')"
  >
    <Icon name="lucide:search" aria-hidden="true" /><span class="admin-command-trigger__label">{{
      t('admin-system.command.open')
    }}</span
    ><kbd class="admin-command-trigger__kbd" aria-hidden="true">{{ shortcut }}</kbd>
  </button>
</template>

<script setup lang="ts">
defineEmits<{ open: [] }>()
const { t } = useI18n()
// 只在客户端挂载（页头整体在 ClientOnly 内），可以直接读取平台
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const shortcut = mac ? '⌘K' : 'Ctrl K'
</script>

<style scoped lang="scss">
.admin-command-trigger__kbd {
  padding: 0 0.3rem;
  border: 1px solid var(--border-soft);
  border-radius: 0.25rem;
  font-family: inherit;
  font-size: 0.6875rem;
}
@media (max-width: 760px) {
  .admin-command-trigger__label,
  .admin-command-trigger__kbd {
    display: none;
  }
}
</style>
