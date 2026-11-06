<!--
  @file StatusBadge.vue
  @description 后台状态徽章：色调由状态值统一决定（features/admin/status.ts），文案由使用方传入
  @author TixXin
  @since 2026-11-06
-->

<template>
  <span class="admin-badge" :class="adminStatusTone(status)"
    ><slot>{{ label }}</slot></span
  >
</template>

<script setup lang="ts">
import { adminStatusTone } from '~/features/admin/status'

defineProps<{ status: string | null | undefined; label?: string }>()
</script>
