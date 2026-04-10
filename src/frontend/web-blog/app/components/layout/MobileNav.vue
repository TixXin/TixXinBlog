<!--
  @file MobileNav.vue
  @description 移动端底部导航栏组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <nav class="mobile-nav">
    <ul class="mobile-nav__list">
      <li v-for="item in navItems" :key="item.label">
        <NuxtLink
          :to="item.to"
          class="mobile-nav__item"
          :class="{ active: isActive(item.to) }"
        >
          <Icon :name="item.icon" size="20" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const { mobileNavItems: navItems } = useNavItems()

function isActive(to: string) {
  if (route.path === to) return true
  if (to === '/' && route.path === '/moments') return true
  return false
}
</script>
