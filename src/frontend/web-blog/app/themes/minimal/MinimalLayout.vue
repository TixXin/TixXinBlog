<!--
  @file MinimalLayout.vue
  @description 单栏极简布局主题：顶部导航 + 居中单列内容，无侧栏干扰
  @author TixXin
  @since 2026-03-24
-->

<template>
  <div class="page-root theme-minimal">
    <header class="minimal-topbar anim-fade-in-up">
      <div class="minimal-topbar__inner">
        <NuxtLink to="/" class="minimal-topbar__brand">
          <Icon name="lucide:pen-tool" size="22" />
          <span class="minimal-topbar__title">TixXin Blog</span>
        </NuxtLink>
        <nav class="minimal-topbar__nav">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="minimal-topbar__link"
            :class="{ active: isActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="minimal-topbar__actions">
          <BlogThemeSwitcher />
          <BlogAppearanceEntry />
        </div>
      </div>
    </header>

    <main class="minimal-body anim-fade-in-up anim-delay-2">
      <div class="main-content">
        <slot />
      </div>
    </main>

    <!-- 隐藏的 Teleport 目标：页面组件通过 Teleport 渲染右侧栏内容，
         minimal 主题不显示但需提供挂载点以避免 Vue 警告 -->
    <div id="right-sidebar-target" class="minimal-sidebar-sink" />

    <footer class="minimal-footer">
      <LayoutStatusFooter />
    </footer>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { navItems } = useNavItems()

function isActive(to: string) {
  return route.path === to
}

</script>

<style lang="scss" scoped>
.theme-minimal {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.minimal-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
  transition: $transition-colors;
}

.minimal-topbar__inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0 2rem;
  height: 3.75rem;
}

.minimal-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--text-main);
  font-weight: 800;
  font-size: 1.0625rem;
  letter-spacing: -0.01em;
  flex-shrink: 0;
  transition: $transition-fast;

  &:hover {
    color: var(--accent);
  }
}

.minimal-topbar__title {
  @media (max-width: #{$breakpoint-sm - 0.02}) {
    display: none;
  }
}

.minimal-topbar__nav {
  display: none;
  align-items: center;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;

  @media (min-width: $breakpoint-lg) {
    display: flex;
  }
}

.minimal-topbar__link {
  padding: 0.375rem 0.875rem;
  border-radius: $radius-full;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-soft);
  white-space: nowrap;
  transition: $transition-fast;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }

  &.active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

.minimal-topbar__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.minimal-sidebar-sink {
  display: none;
}

.minimal-body {
  flex: 1;
  max-width: 780px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1rem;
  --post-card-min-h: 140px;
  --post-card-max-h: 190px;

  @media (min-width: $breakpoint-md) {
    padding: 2.5rem 2rem;
  }
}

.minimal-footer {
  max-width: $container-max-width;
  width: 100%;
  margin: 0 auto;
  padding: 0 1rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 0 2rem 2rem;
  }

  :deep(.site-footer) {
    @media (min-width: $breakpoint-md) {
      display: flex;
    }
  }
}
</style>
