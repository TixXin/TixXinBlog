<!-- @file SiteNavRowActions.vue @description 导航与页脚编辑列表的行操作：上移、下移与可选的移除按钮，到达边界时禁用对应方向 -->
<template>
  <div class="site-nav-fields__actions">
    <button
      type="button"
      data-move="up"
      :disabled="index === 0"
      :aria-label="t('admin-system.siteNav.moveUpLabel', { name })"
      @click="emit('move', -1)"
    >
      {{ t('admin-system.siteNav.moveUp') }}
    </button>
    <button
      type="button"
      data-move="down"
      :disabled="index === count - 1"
      :aria-label="t('admin-system.siteNav.moveDownLabel', { name })"
      @click="emit('move', 1)"
    >
      {{ t('admin-system.siteNav.moveDown') }}
    </button>
    <button
      v-if="removable"
      type="button"
      :aria-label="t('admin-system.siteNav.removeLabel', { name })"
      @click="emit('remove')"
    >
      {{ t('admin-system.siteNav.remove') }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ index: number; count: number; name: string; removable?: boolean }>(), { removable: true })
const emit = defineEmits<{ move: [direction: number]; remove: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
