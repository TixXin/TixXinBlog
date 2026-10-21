<!--
  @file ModerationItem.vue
  @description 后台审核卡片组件：纯展示单条审核项，支持勾选、头部关联、元信息、正文、引用及操作按钮插槽
  @author TixXin
  @since 2026-10-21
-->
<template>
  <li :class="{ 'is-selected': selected }">
    <label v-if="selectable" :class="selectClass">
      <slot name="select">
        <input
          type="checkbox"
          :checked="selected"
          :disabled="selectDisabled"
          :aria-label="selectAriaLabel"
          @change="$emit('toggle-select', ($event.target as HTMLInputElement).checked)"
        />
      </slot>
    </label>
    <slot name="header" />
    <slot name="meta" />
    <slot name="content" />
    <slot />
    <slot name="extra" />
    <div v-if="$slots.actions" :class="actionsClass">
      <slot name="actions" />
    </div>
  </li>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    selected?: boolean
    selectable?: boolean
    selectDisabled?: boolean
    selectAriaLabel?: string
    selectClass?: string
    actionsClass?: string
  }>(),
  {
    selected: false,
    selectable: false,
    selectDisabled: false,
    selectAriaLabel: '',
    selectClass: 'admin-comments__select',
    actionsClass: 'admin-comments__actions',
  },
)

defineEmits<{
  'toggle-select': [checked: boolean]
}>()
</script>
