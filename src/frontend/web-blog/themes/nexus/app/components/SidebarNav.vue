<!--
  @file SidebarNav.vue
  @description 经典三栏主题的侧边导航栏（桥接共享组件，透传插槽）
  @author TixXin
  @since 2026-04-03
-->

<template>
  <SharedSidebarNav v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData ?? {}" />
    </template>
  </SharedSidebarNav>
</template>

<script setup lang="ts">
import SharedSidebarNav from '../../../../app/components/layout/SidebarNav.vue'

defineOptions({ inheritAttrs: false })
</script>
