<!--
  @file MobileNav.vue
  @description 移动端底部导航栏组件
  @author TixXin
  @since 2025-03-17
-->

<template>
  <nav v-if="showMobileNav" class="mobile-nav" :aria-label="$t('layout.mobileNav.label')">
    <ul class="mobile-nav__list">
      <li v-for="item in primaryItems" :key="item.label">
        <NuxtLink
          :to="item.to"
          :target="item.newTab ? '_blank' : undefined"
          class="mobile-nav__item"
          :class="{ active: isActive(item.to) }"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          <Icon :name="item.icon" size="20" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </li>
      <li>
        <CommonContextDrawer
          v-slot="{ close }"
          v-model:open="moreOpen"
          class="mobile-nav__more"
          :label="$t('layout.mobileNav.more')"
          icon="lucide:menu"
        >
          <nav class="mobile-menu" :aria-label="$t('layout.mobileNav.allPages')">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :target="item.newTab ? '_blank' : undefined"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              @click="close"
            >
              <Icon :name="item.icon" size="18" />{{ item.label }}
            </NuxtLink>
          </nav>
          <div class="mobile-menu__settings">
            <BlogThemeSwitcher />
            <BlogAppearanceEntry />
            <NuxtLink v-if="isLoggedIn" to="/admin" @click="close">{{ $t('layout.mobileNav.admin') }}</NuxtLink>
            <button v-else type="button" @click="loginFromMenu(close)">
              {{ $t('layout.mobileNav.login') }}
            </button>
          </div>
        </CommonContextDrawer>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()
const { navItems } = useNavItems()
const { activeTheme, currentThemeId } = useLayoutTheme()
// 能力位替代主题 id 判断：主题自带移动导航（如 dock 的浮岛）时显式声明 mobileNav=false；
// 未声明时保留宿主共享移动导航，新增主题不必为了拿到导航而改宿主代码。
const showMobileNav = computed(() => activeTheme.value.capabilities.mobileNav !== false)
// 从菜单里的界面设置切换布局后收起菜单，与界面设置弹窗一致，让用户直接看到新布局
const moreOpen = ref(false)
watch(currentThemeId, () => {
  moreOpen.value = false
})
const { isLoggedIn } = useCurrentUser()
const { open: openLogin } = useLoginDrawer()
function loginFromMenu(close: () => void) {
  close()
  openLogin('login', true)
}
const primaryItems = computed(() =>
  navItems.value.filter((item) => ['/', '/archive', '/flash', '/guestbook'].includes(item.to)),
)

function isActive(to: string) {
  const path = route.path.replace(/\/$/, '') || '/'
  if (path === to) return true
  if (to === '/' && path === '/moments') return true
  return false
}
</script>
<style lang="scss" scoped>
.mobile-nav__more :deep(.context-entry__button) {
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border: 0;
  background: transparent;
  font-size: 0.625rem;
}
.mobile-menu {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  a {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 44px;
    padding: 0.75rem;
    border-radius: $radius-md;
    color: var(--text-main);
    background: var(--surface-2);
  }
  a[aria-current] {
    box-shadow: inset 0 -2px 0 var(--accent);
  }
}
.mobile-menu__settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  a,
  button {
    min-height: 44px;
    padding: 0.5rem;
    color: var(--text-main);
  }
}
</style>
