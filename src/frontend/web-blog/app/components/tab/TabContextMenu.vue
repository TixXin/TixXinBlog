<!--
  @file TabContextMenu.vue
  @description 标签页上下文菜单：右键 / 移动端长按触发，Teleport 到 body 并自动夹在 viewport 内
  @author TixXin
  @since 2026-04-15
-->

<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div v-if="visible" ref="menuRef" class="tab-ctx" :style="positionStyle" role="menu" @click.stop>
        <template v-for="(item, idx) in items" :key="idx">
          <div v-if="item.type === 'divider'" class="tab-ctx__divider" />
          <div v-else-if="item.submenu" class="tab-ctx__sub" @mouseenter="openSub = idx" @mouseleave="openSub = -1">
            <button
              type="button"
              class="tab-ctx__item"
              :data-focus-key="focusKey"
              :aria-expanded="openSub === idx"
              aria-haspopup="menu"
              @click="openSub = openSub === idx ? -1 : idx"
            >
              <Icon v-if="item.icon" :name="item.icon" size="13" />
              <span class="tab-ctx__item-label">{{ item.label }}</span>
              <Icon name="lucide:chevron-right" size="12" class="tab-ctx__item-chev" />
            </button>
            <div v-if="openSub === idx" class="tab-ctx__submenu">
              <button
                v-for="sub in item.submenu"
                :key="sub.label"
                type="button"
                class="tab-ctx__item"
                :data-focus-key="focusKey"
                @click="runSub(sub)"
              >
                <Icon v-if="sub.icon" :name="sub.icon" size="13" />
                <span class="tab-ctx__item-label">{{ sub.label }}</span>
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="tab-ctx__item"
            :data-focus-key="focusKey"
            :class="{ 'tab-ctx__item--danger': item.danger }"
            @click="run(item)"
          >
            <Icon v-if="item.icon" :name="item.icon" size="13" />
            <span class="tab-ctx__item-label">{{ item.label }}</span>
            <kbd v-if="item.shortcut" class="tab-ctx__item-kbd">{{ item.shortcut }}</kbd>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
export interface ContextMenuItem {
  type?: 'item' | 'divider'
  label?: string
  icon?: string
  shortcut?: string
  danger?: boolean
  submenu?: ContextMenuItem[]
  run?: () => void
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  focusKey?: string
}>()

const emit = defineEmits<{ close: [] }>()

const openSub = ref(-1)
const menuRef = ref<HTMLElement | null>(null)
const MENU_WIDTH = 220
const MENU_MAX_HEIGHT = 420

/** 定位修正：避免溢出视口 */
const positionStyle = computed(() => {
  if (typeof window === 'undefined') return {}
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.min(props.x, vw - MENU_WIDTH - 8)
  const top = Math.min(props.y, vh - MENU_MAX_HEIGHT - 8)
  return {
    left: `${Math.max(8, left)}px`,
    top: `${Math.max(8, top)}px`,
  }
})

/** 菜单即将卸载，后续弹窗应记住稳定的原始入口。 */
function focusOrigin() {
  if (!props.focusKey) return
  const target = [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
    (node) => node.dataset.focusKey === props.focusKey && !node.closest('.tab-ctx') && !node.closest('[inert]'),
  )
  target?.focus({ preventScroll: true })
}

function run(item: ContextMenuItem) {
  focusOrigin()
  item.run?.()
  emit('close')
}

function runSub(sub: ContextMenuItem) {
  focusOrigin()
  sub.run?.()
  openSub.value = -1
  emit('close')
}

/** 全局点击/ESC 关闭 */
let attachTimer: ReturnType<typeof setTimeout> | undefined
function onGlobalClick() {
  if (props.visible) emit('close')
}
function onGlobalKey(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    if (openSub.value >= 0) {
      openSub.value = -1
      return
    }
    emit('close')
    void nextTick(focusOrigin)
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const items = [...(menuRef.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter(
      (node) => node.getClientRects().length,
    )
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') emit('close')
}

watch(
  () => props.visible,
  (v) => {
    if (attachTimer) clearTimeout(attachTimer)
    if (v) {
      openSub.value = -1
      void nextTick(() => menuRef.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }))
      // 延迟一帧挂全局事件，避免打开时立即被当前 click 关闭
      attachTimer = setTimeout(() => {
        if (!props.visible) return
        document.addEventListener('click', onGlobalClick)
        document.addEventListener('contextmenu', onGlobalClick)
        document.addEventListener('keydown', onGlobalKey)
      }, 0)
    } else {
      document.removeEventListener('click', onGlobalClick)
      document.removeEventListener('contextmenu', onGlobalClick)
      document.removeEventListener('keydown', onGlobalKey)
    }
  },
)

onBeforeUnmount(() => {
  if (attachTimer) clearTimeout(attachTimer)
  document.removeEventListener('click', onGlobalClick)
  document.removeEventListener('contextmenu', onGlobalClick)
  document.removeEventListener('keydown', onGlobalKey)
})
</script>

<style lang="scss" scoped>
.tab-ctx {
  position: fixed;
  z-index: 400;
  min-width: 200px;
  padding: 0.25rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
  font-size: 0.75rem;
}

.ctx-enter-active,
.ctx-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.ctx-enter-from,
.ctx-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.tab-ctx__divider {
  height: 1px;
  margin: 0.25rem 0;
  background: var(--border-soft);
}

.tab-ctx__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4375rem 0.625rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover,
  &:focus-visible {
    background: var(--accent-soft);
    color: var(--accent-text);
    outline: none;
  }

  &--danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
  }
}

.tab-ctx__item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-ctx__item-chev {
  color: var(--text-faint);
}

.tab-ctx__item-kbd {
  padding: 0.0625rem 0.375rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.625rem;
}

/* ---- 子菜单 ---- */
.tab-ctx__sub {
  position: relative;
}

.tab-ctx__submenu {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 0.125rem;
  min-width: 180px;
  padding: 0.25rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
  max-height: 280px;
  overflow-y: auto;
}
</style>
