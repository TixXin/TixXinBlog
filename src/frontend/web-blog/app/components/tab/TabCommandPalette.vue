<!--
  @file TabCommandPalette.vue
  @description 标签页 Cmd/Ctrl+K 命令面板：模糊搜索书签/分类/动作，键盘方向键导航
  @author TixXin
  @since 2026-04-15
-->

<!--
  @file TabCommandPalette.vue
  @description 标签页 Cmd/Ctrl+K 命令面板：模糊搜索书签/分类/动作，键盘方向键导航
  @author TixXin
  @since 2026-04-15
-->

<template>
  <Teleport to="body">
    <Transition name="tab-palette">
      <div v-if="open" class="tab-palette" @click.self="close">
        <div
          ref="dialogRef"
          class="tab-palette__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('misc.tab.palette.dialogLabel')"
          tabindex="-1"
          @keydown.stop="onKeydown"
        >
          <div class="tab-palette__search">
            <Icon name="lucide:search" size="16" class="tab-palette__icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              :aria-label="$t('misc.tab.palette.inputLabel')"
              class="tab-palette__input"
              :placeholder="$t('misc.tab.palette.placeholder')"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="button" class="tab-palette__close" :aria-label="$t('misc.tab.palette.close')" @click="close">
              <Icon name="lucide:x" size="18" />
            </button>
          </div>

          <div v-if="sectionList.length === 0" class="tab-palette__empty">
            <Icon name="lucide:search-x" size="20" />
            <span>{{ $t('misc.tab.palette.empty') }}</span>
          </div>

          <div v-else ref="listRef" class="tab-palette__list">
            <template v-for="section in sectionList" :key="section.id">
              <div class="tab-palette__section">{{ section.label }}</div>
              <TabCommandPaletteItem
                v-for="item in section.items"
                :key="`${section.id}-${item.id}`"
                :item="item"
                :query="query"
                :focused="focusedId === item.id"
                @hover="focusedId = item.id"
                @run="runItem(item)"
              />
            </template>
          </div>

          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ selectionStatus }}</p>
          <div class="tab-palette__footer">
            <span> <kbd>↑</kbd><kbd>↓</kbd> {{ $t('misc.tab.palette.navigate') }} </span>
            <span><kbd>Enter</kbd> {{ $t('misc.tab.palette.run') }}</span>
            <span><kbd>Esc</kbd> {{ $t('misc.tab.palette.dismiss') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import TabCommandPaletteItem from './TabCommandPaletteItem.vue'
import {
  buildPaletteItems,
  createPaletteFuse,
  filterPaletteItems,
  groupPaletteSections,
  paletteKeyAction,
  paletteSelectionStatus,
  type CommandAction,
  type PaletteItem,
} from '~/features/tab/paletteItems'

const props = defineProps<{ actions: CommandAction[] }>()
const { t } = useI18n()

const { paletteOpen, close } = useTabCommandPalette()
const open = paletteOpen

const { bookmarks, categories, selectCategory } = useTabBookmarks()

const query = ref('')
const focusedId = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
useModalFocus(open, dialogRef, { close, initialFocus: () => inputRef.value })
const listRef = ref<HTMLElement | null>(null)

const allItems = computed(() => buildPaletteItems(bookmarks.value, categories.value, props.actions, t))
const fuse = computed(() => createPaletteFuse(allItems.value))
const filteredItems = computed(() => filterPaletteItems(allItems.value, fuse.value, query.value))
const sectionList = computed(() => groupPaletteSections(filteredItems.value, t))
const flattenedItems = computed<PaletteItem[]>(() => sectionList.value.flatMap((s) => s.items))
const selectionStatus = computed(() => paletteSelectionStatus(flattenedItems.value, focusedId.value, t))

// 打开时清空查询。输入框在面板渲染后才挂上 ref，等引用出现再聚焦。
watch(
  open,
  (v) => {
    if (!v) return
    query.value = ''
    focusedId.value = flattenedItems.value[0]?.id ?? null
  },
  { immediate: true },
)
watch(
  inputRef,
  (input) => {
    if (open.value && input?.isConnected) input.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

// 按实际分组后的显示顺序选择首项，避免模糊搜索的原始排名与键盘顺序不一致。
watch(
  flattenedItems,
  (list) => {
    focusedId.value = list[0]?.id ?? null
  },
  { immediate: true },
)

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  const target = e.target instanceof HTMLElement ? e.target : null
  const focusedButton = target?.closest<HTMLButtonElement>('.tab-palette__item')
  // 关闭按钮保留原生 Enter 行为；输入框和结果按钮共同支持方向键导航。
  if (e.key !== 'Escape' && target !== inputRef.value && !focusedButton) return
  const items = flattenedItems.value
  if (items.length === 0) {
    if (e.key === 'Escape') close()
    return
  }
  const currentId = focusedButton?.dataset.id ?? focusedId.value
  const action = paletteKeyAction(
    e.key,
    items.findIndex((i) => i.id === currentId),
    items.length,
  )
  if (!action) return
  e.preventDefault()
  if (action.kind === 'close') return close()
  const item = items[action.index]
  if (action.kind === 'run') {
    if (item) runItem(item)
    return
  }
  if (item) focusedId.value = item.id
  scrollToFocused(!!focusedButton)
}

function scrollToFocused(moveFocus: boolean) {
  nextTick(() => {
    const id = focusedId.value
    if (!id || !listRef.value) return
    const el = [...listRef.value.querySelectorAll<HTMLElement>('[data-id]')].find((item) => item.dataset.id === id)
    if (moveFocus) el?.focus({ preventScroll: true })
    el?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
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
@use '~/assets/styles/tab-palette' as palette;

@include palette.palette;
</style>
