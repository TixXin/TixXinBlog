<!--
  @file ModerationPagination.vue
  @description 后台审核列表分页组件：无业务耦合，封装上一页、页码概览、下一页及无障碍属性
  @author TixXin
  @since 2026-10-21
-->
<template>
  <nav :aria-label="ariaLabel">
    <button type="button" :disabled="disabled || page <= 1" @click="$emit('prev')">
      <slot name="prev">{{ prevLabel }}</slot>
    </button>
    <span>
      <slot :page="page" :pages="totalPages" :total="total">{{ summaryText }}</slot>
    </span>
    <button type="button" :disabled="disabled || page * pageSize >= total" @click="$emit('next')">
      <slot name="next">{{ nextLabel }}</slot>
    </button>
  </nav>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    page: number
    total: number
    pageSize?: number
    disabled?: boolean
    ariaLabel?: string
    prevLabel?: string
    nextLabel?: string
    summary?: string
  }>(),
  {
    pageSize: 20,
    disabled: false,
    ariaLabel: '',
    prevLabel: '',
    nextLabel: '',
    summary: '',
  },
)

defineEmits<{
  prev: []
  next: []
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const summaryText = computed(() => props.summary || `${props.page} / ${totalPages.value}`)
</script>
