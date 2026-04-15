<!--
  @file TabCommandPalette.vue
  @description 标签页 Cmd/Ctrl+K 命令面板：模糊搜索书签/分类/动作，键盘方向键导航
  @author TixXin
  @since 2026-04-15
-->

<template>
  <Teleport to="body">
    <Transition name="tab-palette">
      <div v-if="open" class="tab-palette" role="dialog" aria-modal="true" @click.self="close">
        <div class="tab-palette__panel">
          <div class="tab-palette__search">
            <Icon name="lucide:search" size="16" class="tab-palette__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="tab-palette__input"
              placeholder="搜索书签 / 分类 / 动作，↑↓ 选择，Enter 执行，Esc 关闭"
              autocomplete="off"
              spellcheck="false"
              @keydown.stop="onKeydown"
            >
            <kbd class="tab-palette__kbd">Esc</kbd>
          </div>

          <div v-if="sectionList.length === 0" class="tab-palette__empty">
            <Icon name="lucide:search-x" size="20" />
            <span>无匹配结果</span>
          </div>

          <div v-else ref="listRef" class="tab-palette__list">
            <template v-for="section in sectionList" :key="section.id">
              <div class="tab-palette__section">{{ section.label }}</div>
              <button
                v-for="item in section.items"
                :key="`${section.id}-${item.id}`"
                type="button"
                class="tab-palette__item"
                :class="{ 'tab-palette__item--focus': focusedId === item.id }"
                :data-id="item.id"
                @mouseenter="focusedId = item.id"
                @click="runItem(item)"
              >
                <span class="tab-palette__item-icon">
                  <Icon v-if="item.icon.startsWith('lucide:')" :name="item.icon" size="14" />
                  <span v-else>{{ item.icon }}</span>
                </span>
                <div class="tab-palette__item-text">
                  <div class="tab-palette__item-title">{{ item.title }}</div>
                  <div v-if="item.subtitle" class="tab-palette__item-sub">{{ item.subtitle }}</div>
                </div>
                <kbd v-if="item.shortcut" class="tab-palette__kbd">{{ item.shortcut }}</kbd>
              </button>
            </template>
          </div>

          <div class="tab-palette__footer">
            <span>
              <kbd>↑</kbd><kbd>↓</kbd> 导航
            </span>
            <span><kbd>Enter</kbd> 执行</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Fuse from 'fuse.js'

export interface CommandAction {
  id: string
  title: string
  subtitle?: string
  icon: string
  shortcut?: string
  section: 'actions'
  run: () => void | Promise<void>
}

const props = defineProps<{ actions: CommandAction[] }>()

const { paletteOpen, close } = useTabCommandPalette()
const open = paletteOpen

const { bookmarks, categories, selectCategory } = useTabBookmarks()

const query = ref('')
const focusedId = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  icon: string
  shortcut?: string
  source: 'bookmark' | 'category' | 'action'
  payload: unknown
}

interface PaletteSection {
  id: string
  label: string
  items: PaletteItem[]
}

/** 把书签/分类/动作合并为统一 item */
const allItems = computed<PaletteItem[]>(() => {
  const bmItems: PaletteItem[] = bookmarks.value.map((b) => ({
    id: `bm-${b.id}`,
    title: b.name,
    subtitle: b.url,
    icon: b.icon?.startsWith('lucide:') ? b.icon : 'lucide:bookmark',
    source: 'bookmark',
    payload: b,
  }))
  const catItems: PaletteItem[] = categories.value.map((c) => ({
    id: `cat-${c.id}`,
    title: c.name,
    subtitle: '分类',
    icon: c.icon || 'lucide:folder',
    source: 'category',
    payload: c,
  }))
  const actItems: PaletteItem[] = props.actions.map((a) => ({
    id: `act-${a.id}`,
    title: a.title,
    subtitle: a.subtitle,
    icon: a.icon,
    shortcut: a.shortcut,
    source: 'action',
    payload: a,
  }))
  return [...actItems, ...bmItems, ...catItems]
})

const fuse = computed(
  () =>
    new Fuse(allItems.value, {
      keys: ['title', 'subtitle'],
      threshold: 0.4,
      ignoreLocation: true,
    }),
)

const filteredItems = computed<PaletteItem[]>(() => {
  const q = query.value.trim()
  if (!q) return allItems.value.slice(0, 30)
  return fuse.value.search(q).slice(0, 30).map((r) => r.item)
})

/** 分段组织结果 */
const sectionList = computed<PaletteSection[]>(() => {
  const actions: PaletteItem[] = []
  const bmList: PaletteItem[] = []
  const catList: PaletteItem[] = []
  for (const it of filteredItems.value) {
    if (it.source === 'action') actions.push(it)
    else if (it.source === 'bookmark') bmList.push(it)
    else catList.push(it)
  }
  const sections: PaletteSection[] = []
  if (actions.length > 0) sections.push({ id: 'actions', label: '动作', items: actions })
  if (bmList.length > 0) sections.push({ id: 'bookmarks', label: '书签', items: bmList })
  if (catList.length > 0) sections.push({ id: 'categories', label: '分类', items: catList })
  return sections
})

const flattenedItems = computed<PaletteItem[]>(() =>
  sectionList.value.flatMap((s) => s.items),
)

// 打开时聚焦输入 + 重置状态
watch(open, (v) => {
  if (v) {
    query.value = ''
    focusedId.value = null
    nextTick(() => inputRef.value?.focus())
  }
})

// 结果变化时默认选中第一项
watch(filteredItems, (list) => {
  focusedId.value = list[0]?.id ?? null
})

function onKeydown(e: KeyboardEvent) {
  const items = flattenedItems.value
  if (items.length === 0) {
    if (e.key === 'Escape') close()
    return
  }
  const idx = items.findIndex((i) => i.id === focusedId.value)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = items[(idx + 1) % items.length]
    if (next) focusedId.value = next.id
    scrollToFocused()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = items[(idx - 1 + items.length) % items.length]
    if (prev) focusedId.value = prev.id
    scrollToFocused()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const current = items.find((i) => i.id === focusedId.value)
    if (current) runItem(current)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

function scrollToFocused() {
  nextTick(() => {
    const id = focusedId.value
    if (!id || !listRef.value) return
    const el = listRef.value.querySelector(`[data-id="${id}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

async function runItem(item: PaletteItem) {
  if (item.source === 'action') {
    const a = item.payload as CommandAction
    await a.run()
  } else if (item.source === 'bookmark') {
    const b = item.payload as { url: string }
    window.open(b.url, '_blank', 'noopener')
  } else if (item.source === 'category') {
    const c = item.payload as { id: string }
    selectCategory(c.id)
  }
  close()
}
</script>

<style lang="scss" scoped>
.tab-palette {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.tab-palette-enter-active,
.tab-palette-leave-active {
  transition: opacity 0.18s ease;

  .tab-palette__panel {
    transition: transform 0.18s ease, opacity 0.18s ease;
  }
}

.tab-palette-enter-from,
.tab-palette-leave-to {
  opacity: 0;

  .tab-palette__panel {
    transform: translateY(-8px);
    opacity: 0;
  }
}

.tab-palette__panel {
  width: min(640px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.24);
  overflow: hidden;
}

.tab-palette__search {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.tab-palette__icon {
  color: var(--text-soft);
}

.tab-palette__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9375rem;
  color: var(--text-main);

  &::placeholder {
    color: var(--text-faint);
  }
}

.tab-palette__kbd,
.tab-palette__footer kbd {
  padding: 0.0625rem 0.375rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.625rem;
  font-weight: 500;
}

.tab-palette__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.tab-palette__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 2rem;
  color: var(--text-faint);
  font-size: 0.8125rem;
}

.tab-palette__section {
  padding: 0.5rem 1rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.tab-palette__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;

  &--focus {
    background: var(--accent-soft);
    color: var(--accent);

    .tab-palette__item-sub {
      color: var(--accent);
      opacity: 0.75;
    }
  }
}

.tab-palette__item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: $radius-sm;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.875rem;
}

.tab-palette__item--focus .tab-palette__item-icon {
  background: var(--accent);
  color: #fff;
}

.tab-palette__item-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tab-palette__item-title {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-palette__item-sub {
  font-size: 0.6875rem;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-palette__footer {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-soft);
  background: var(--surface-2);
  font-size: 0.625rem;
  color: var(--text-soft);

  kbd {
    margin-right: 0.25rem;
  }
}
</style>
