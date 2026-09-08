<!--
  @file ContextDrawer.vue
  @description 紧凑功能入口与模态抽屉，复用页面已有的筛选、目录和导航内容
  @author TixXin
  @since 2026-09-07
-->
<template>
  <div class="context-entry">
    <button
      type="button"
      class="context-entry__button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="openFromButton"
    >
      <Icon :name="icon" size="18" />
      <span>{{ label }}</span>
    </button>
    <Teleport to="body">
      <Transition name="context-drawer">
        <div v-if="open" class="context-drawer__overlay" @click.self="open = false">
          <section
            ref="dialog"
            role="dialog"
            aria-modal="true"
            :aria-label="label"
            tabindex="-1"
            class="context-drawer"
          >
            <header class="context-drawer__header">
              <h2>{{ label }}</h2>
              <button type="button" :aria-label="`关闭${label}`" @click="open = false">
                <Icon name="lucide:x" size="20" />
              </button>
            </header>
            <div class="context-drawer__body">
              <slot
                :close="
                  () => {
                    open = false
                  }
                "
              />
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ label: string; icon?: string }>(), { icon: 'lucide:menu' })
const open = defineModel<boolean>('open', { default: false })
const dialog = ref<HTMLElement | null>(null)
function openFromButton(event: MouseEvent) {
  // WebKit再次点击已聚焦按钮时会先失焦，显式确定入口再交给模态焦点管理。
  ;(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
  open.value = true
}
useModalFocus(open, dialog, {
  close: () => {
    open.value = false
  },
})
</script>
<style lang="scss" scoped>
.context-entry__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  white-space: nowrap;
  font-size: 0.8125rem;
  cursor: pointer;
}
.context-drawer__overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  justify-content: flex-end;
  background: rgb(0 0 0 / 45%);
}
.context-drawer {
  display: flex;
  flex-direction: column;
  width: min(26rem, 100%);
  max-height: 100dvh;
  background: var(--surface-1);
  color: var(--text-main);
  box-shadow: var(--shadow-card);
  padding-bottom: env(safe-area-inset-bottom);
}
.context-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  h2 {
    font-size: 1rem;
  }
  button {
    width: 44px;
    height: 44px;
    color: var(--text-main);
    cursor: pointer;
  }
}
.context-drawer__body {
  padding: 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
}
.context-drawer-enter-active,
.context-drawer-leave-active {
  transition: opacity 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
.context-drawer-enter-from,
.context-drawer-leave-to {
  opacity: 0;
}
</style>
