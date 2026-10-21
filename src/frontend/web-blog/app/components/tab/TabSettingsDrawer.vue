<!--
  @file TabSettingsDrawer.vue
  @description 标签页设置抽屉：从右侧滑出，双栏布局，外壳容器与分区导航，具体设置项由 settings/ 子组件分担
  @author TixXin
  @since 2026-04-12
-->

<template>
  <Teleport to="body">
    <div v-if="visible" ref="backdropRef" class="tab-settings-backdrop" @click="close" />
    <Transition name="tab-settings-drawer">
      <aside
        v-if="visible"
        ref="dialogRef"
        class="tab-settings-drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('misc.tab.settings.dialogLabel')"
        tabindex="-1"
      >
        <header class="tsd-header">
          <Icon name="lucide:settings" size="16" />
          <h2 class="tsd-header__title">{{ $t('misc.tab.settings.title') }}</h2>
          <button type="button" class="tsd-header__close" :aria-label="$t('misc.tab.common.close')" @click="close">
            <Icon name="lucide:x" size="16" />
          </button>
        </header>

        <div class="tsd-body">
          <!-- 左列：导航 -->
          <nav class="tsd-nav">
            <button
              v-for="sec in sections"
              :key="sec.id"
              type="button"
              class="tsd-nav__item"
              :class="{ 'tsd-nav__item--active': activeSection === sec.id }"
              :aria-pressed="activeSection === sec.id"
              @click="activeSection = sec.id"
            >
              <Icon :name="sec.icon" size="14" />
              <span>{{ sec.label }}</span>
            </button>
          </nav>

          <!-- 右列：内容 -->
          <div class="tsd-content">
            <TabSettingsProfile v-if="activeSection === 'profile'" :user="user" />
            <TabSettingsLayout v-else-if="activeSection === 'layout'" />
            <TabSettingsIcon v-else-if="activeSection === 'icon'" />
            <TabSettingsTime v-else-if="activeSection === 'time'" />
            <TabSettingsTheme v-else-if="activeSection === 'theme'" />
            <TabSettingsSearch v-else-if="activeSection === 'search'" />
            <TabSettingsSidebar v-else-if="activeSection === 'sidebar'" />
            <TabSettingsData v-else-if="activeSection === 'data'" @open-import="emit('openImport')" />
            <TabSettingsAbout v-else-if="activeSection === 'about'" />
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TabSettingsAbout from './settings/TabSettingsAbout.vue'
import TabSettingsData from './settings/TabSettingsData.vue'
import TabSettingsIcon from './settings/TabSettingsIcon.vue'
import TabSettingsLayout from './settings/TabSettingsLayout.vue'
import TabSettingsProfile from './settings/TabSettingsProfile.vue'
import TabSettingsSearch from './settings/TabSettingsSearch.vue'
import TabSettingsSidebar from './settings/TabSettingsSidebar.vue'
import TabSettingsTheme from './settings/TabSettingsTheme.vue'
import TabSettingsTime from './settings/TabSettingsTime.vue'
import { useModalFocus } from '~/composables/useModalFocus'
import type { CurrentUser } from '~/features/auth/types'

defineProps<{
  user: CurrentUser | null
}>()
const emit = defineEmits<{ openImport: [] }>()
const { t } = useI18n()

const visible = defineModel<boolean>('visible', { default: false })
const dialogRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
useModalFocus(visible, dialogRef, { close, extra: () => [backdropRef.value] })

const activeSection = ref('profile')

const sections = computed(() =>
  (
    [
      { id: 'profile', icon: 'lucide:user' },
      { id: 'layout', icon: 'lucide:layout-grid' },
      { id: 'icon', icon: 'lucide:image' },
      { id: 'time', icon: 'lucide:clock' },
      { id: 'theme', icon: 'lucide:paintbrush' },
      { id: 'search', icon: 'lucide:search' },
      { id: 'sidebar', icon: 'lucide:panel-left' },
      { id: 'data', icon: 'lucide:database' },
      { id: 'about', icon: 'lucide:info' },
    ] as const
  ).map((sec) => ({ ...sec, label: t(`misc.tab.settings.nav.${sec.id}`) })),
)

function close() {
  visible.value = false
}
</script>

<style lang="scss" scoped>
/* ---- Backdrop ---- */
.tab-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 199;
}

/* ---- Drawer ---- */
.tab-settings-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  width: min(540px, 90vw);
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border-left: 1px solid var(--border-soft);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
}

.tab-settings-drawer-enter-active,
.tab-settings-drawer-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.tab-settings-drawer-enter-from,
.tab-settings-drawer-leave-to {
  transform: translateX(100%);
}

/* ---- Header ---- */
.tsd-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  color: var(--accent-text);
  flex-shrink: 0;
}

.tsd-header__title {
  flex: 1;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.tsd-header__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: transparent;
  border-radius: $radius-full;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

/* ---- Body ---- */
.tsd-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* 左列导航 */
.tsd-nav {
  width: 130px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.625rem 0.375rem;
  border-right: 1px solid var(--border-soft);
  overflow-y: auto;
}

.tsd-nav__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5rem;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);
  text-align: left;
  white-space: nowrap;
  transition: $transition-fast;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }

  &--active {
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 600;
  }
}

/* 右列内容 */
.tsd-content {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
}
</style>
