<!--
  @file SidebarNav.vue
  @description 桌面端左侧栏导航组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <nav class="card sidebar-nav">
    <ul class="sidebar-nav__list">
      <li v-for="item in navItems" :key="item.label">
        <NuxtLink
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" class="nav-item__icon" size="20" />
          <span class="font-medium">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
    <div v-if="$slots.footer" class="sidebar-nav__footer">
      <slot name="footer" />
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const { navItems } = useNavItems()

function isActive(to: string) {
  const path = route.path.replace(/\/$/, '') || '/'
  const target = to.replace(/\/$/, '') || '/'
  return path === target || (target !== '/' && path.startsWith(target + '/'))
}
</script>

<style lang="scss" scoped>
.sidebar-nav {
  padding: 1rem;
  display: none;

  @media (min-width: $breakpoint-lg) {
    display: block;
  }
}

.sidebar-nav__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.nav-item__icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.sidebar-nav__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);
}
</style>
