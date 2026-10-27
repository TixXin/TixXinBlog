<!--
  @file TabSidebarAddCategory.vue
  @description 悬浮侧栏的新建分类入口：折叠时为带提示的图标按钮，展开时为带文字的按钮
  @author TixXin
  @since 2026-10-27
-->

<template>
  <div class="tab-side__divider" />
  <CommonTooltip v-if="collapsed" :content="$t('misc.tab.sidebar.addCategory')" placement="right">
    <button
      type="button"
      :aria-label="$t('misc.tab.sidebar.addCategory')"
      class="tab-side__action tab-side__action--icon"
      @click="emit('add')"
    >
      <Icon name="lucide:folder-plus" size="15" />
    </button>
  </CommonTooltip>
  <button v-else type="button" class="tab-side__action" @click="emit('add')">
    <Icon name="lucide:folder-plus" size="14" />
    <span>{{ $t('misc.tab.sidebar.addCategory') }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ add: [] }>()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-sidebar' as sidebar;

@include sidebar.sidebar;
</style>
