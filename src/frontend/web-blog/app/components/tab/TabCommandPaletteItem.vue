<!--
  @file TabCommandPaletteItem.vue
  @description 命令面板的一条结果：图标、高亮标题与摘要、快捷键；经过或聚焦即成为当前项，点击执行
  @author TixXin
  @since 2026-10-27
-->

<template>
  <button
    type="button"
    class="tab-palette__item"
    :class="{ 'tab-palette__item--focus': focused }"
    :aria-current="focused ? 'true' : undefined"
    :data-id="item.id"
    @mouseenter="emit('hover')"
    @focus="emit('hover')"
    @click="emit('run')"
  >
    <span class="tab-palette__item-icon">
      <Icon v-if="item.icon.startsWith('lucide:')" :name="item.icon" size="14" />
      <span v-else>{{ item.icon }}</span>
    </span>
    <div class="tab-palette__item-text">
      <div class="tab-palette__item-title">
        <SearchHighlight :text="item.title" :keyword="query" />
      </div>
      <div v-if="item.subtitle" class="tab-palette__item-sub">
        <SearchHighlight :text="item.subtitle" :keyword="query" />
      </div>
    </div>
    <kbd v-if="item.shortcut" class="tab-palette__kbd">{{ item.shortcut }}</kbd>
  </button>
</template>

<script setup lang="ts">
import SearchHighlight from '~/components/common/SearchHighlight.vue'
import type { PaletteItem } from '~/features/tab/paletteItems'

defineProps<{ item: PaletteItem; query: string; focused: boolean }>()
const emit = defineEmits<{ hover: []; run: [] }>()
</script>

<style lang="scss" scoped>
@use '~/assets/styles/tab-palette' as palette;

@include palette.palette;
</style>
