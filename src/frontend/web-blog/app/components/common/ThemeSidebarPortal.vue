<!--
  @file ThemeSidebarPortal.vue
  @description 页面右侧栏内容投递包装：把「主题是否声明右栏」的判断从各页面收敛到一处，
               只有声明 capabilities.rightSidebar 的主题才把内容 Teleport 到布局挂载点
  @author TixXin
  @since 2026-10-22
-->

<template>
  <Teleport v-if="showRightSidebar" to="#right-sidebar-target">
    <slot />
  </Teleport>
</template>

<script setup lang="ts">
const { activeTheme } = useLayoutTheme()
// 能力位门控替代页面里散落的主题 id / capabilities 判断：
// dock 的 rightSidebar=false 自然不渲染，也不再需要它的隐藏 sink 接收内容；
// 视口断点由主题布局的媒体查询负责，组件内不做视口判断，保证 SSR 与水合结构一致。
const showRightSidebar = computed(() => activeTheme.value.capabilities.rightSidebar)
</script>
