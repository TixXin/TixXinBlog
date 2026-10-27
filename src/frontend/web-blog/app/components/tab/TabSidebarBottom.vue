<!--
  @file TabSidebarBottom.vue
  @description 悬浮侧栏底部的设置与赞助按钮：折叠时为带提示的图标按钮，展开时附文字
  @author TixXin
  @since 2026-10-27
-->

<template>
  <div class="tab-side__bottom">
    <CommonTooltip v-if="collapsed" :content="$t('misc.tab.sidebar.settings')" placement="right">
      <button type="button" class="tab-side__bottom-btn" @click="emit('settings')">
        <Icon name="lucide:settings" size="15" />
      </button>
    </CommonTooltip>
    <button v-else type="button" class="tab-side__bottom-btn" @click="emit('settings')">
      <Icon name="lucide:settings" size="15" />
      <span v-if="!collapsed">{{ $t('misc.tab.sidebar.settings') }}</span>
    </button>

    <CommonTooltip v-if="collapsed" :content="$t('misc.tab.sidebar.donate')" placement="right">
      <button type="button" class="tab-side__bottom-btn" @click="emit('donate')">
        <Icon name="lucide:heart" size="15" />
      </button>
    </CommonTooltip>
    <button v-else type="button" class="tab-side__bottom-btn" @click="emit('donate')">
      <Icon name="lucide:heart" size="15" />
      <span v-if="!collapsed">{{ $t('misc.tab.sidebar.donate') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ settings: []; donate: [] }>()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-sidebar' as sidebar;

@include sidebar.sidebar;
</style>
