<!--
  @file TabBookmarkItem.vue
  @description 标签页书签格子：图标 + 名称，支持 lucide / favicon / emoji / 单字母 fallback 四种渲染
  @author TixXin
  @since 2026-04-11
-->

<template>
  <a
    :href="bookmark.url"
    :title="bookmark.url"
    target="_blank"
    rel="noopener"
    class="tab-bm"
    :class="{ 'tab-bm--pinned': bookmark.pinned }"
    :draggable="!readOnly"
    @dragstart="onDragStart"
    @contextmenu.prevent="onContextMenu"
    @pointerdown="onPointerDown"
    @pointerup="clearLongPress"
    @pointerleave="clearLongPress"
    @pointermove="clearLongPress"
  >
    <span class="tab-bm__icon" :style="iconComputedStyle">
      <Icon v-if="renderKind === 'lucide'" :name="bookmark.icon!" :size="Math.round(tabSettings.iconSize * 0.46)" />
      <img
        v-else-if="renderKind === 'image'"
        :src="imageSrc"
        :alt="bookmark.name"
        class="tab-bm__img"
        referrerpolicy="no-referrer"
        @error="onImgError"
      >
      <span v-else class="tab-bm__letter">{{ letter }}</span>
    </span>
    <span
      v-if="tabSettings.showIconName && viewMode !== 'compact'"
      class="tab-bm__name"
      :style="nameComputedStyle"
    >{{ bookmark.name }}</span>
    <span v-if="showUrl" class="tab-bm__url">{{ displayHost }}</span>
    <span v-if="showDescription && bookmark.description" class="tab-bm__desc">{{ bookmark.description }}</span>
    <button
      v-if="!readOnly"
      type="button"
      class="tab-bm__remove"
      :aria-label="`删除 ${bookmark.name}`"
      @click.prevent.stop="emit('remove', bookmark.id)"
    >
      <Icon name="lucide:x" size="11" />
    </button>
  </a>
</template>

<script setup lang="ts">
import type { Bookmark } from '~/features/tab/types'
import type { TabViewMode } from '~/composables/useTabSettings'

const props = withDefaults(
  defineProps<{ bookmark: Bookmark; readOnly?: boolean; viewMode?: TabViewMode }>(),
  { viewMode: 'grid' },
)
const emit = defineEmits<{
  remove: [id: string]
  faviconError: [id: string]
  contextMenu: [payload: { bookmark: Bookmark; x: number; y: number }]
}>()

const { settings: tabSettings } = useTabSettings()

// 本地图片加载失败态；不直接改 props，由父组件再决定是否持久化
const localImgFailed = ref(false)
watch(() => props.bookmark.icon, () => { localImgFailed.value = false })
watch(() => props.bookmark.faviconUrl, () => { localImgFailed.value = false })

/** 渲染分支：lucide 优先 → 有 favicon/dataURL 图片 → 字符 fallback */
const renderKind = computed<'lucide' | 'image' | 'text'>(() => {
  const icon = props.bookmark.icon
  if (icon?.startsWith('lucide:')) return 'lucide'
  if (localImgFailed.value) return 'text'
  if (icon?.startsWith('data:') || icon?.startsWith('http')) return 'image'
  if (props.bookmark.faviconUrl && !props.bookmark.faviconFailed) return 'image'
  return 'text'
})

const imageSrc = computed(() => {
  const icon = props.bookmark.icon
  if (icon?.startsWith('data:') || icon?.startsWith('http')) return icon
  return props.bookmark.faviconUrl ?? ''
})

const letter = computed(() => {
  const icon = props.bookmark.icon
  if (icon && !icon.startsWith('lucide:') && !icon.startsWith('data:') && !icon.startsWith('http')) {
    return icon
  }
  return props.bookmark.name.charAt(0).toUpperCase()
})

function onImgError() {
  localImgFailed.value = true
  emit('faviconError', props.bookmark.id)
}

function onDragStart(e: DragEvent) {
  if (props.readOnly || !e.dataTransfer) return
  e.dataTransfer.setData('application/x-bookmark-id', props.bookmark.id)
  e.dataTransfer.effectAllowed = 'move'
}

function onContextMenu(e: MouseEvent) {
  if (props.readOnly) return
  emit('contextMenu', { bookmark: props.bookmark, x: e.clientX, y: e.clientY })
}

// 移动端长按 500ms 触发上下文菜单
let longPressTimer: number | null = null

function onPointerDown(e: PointerEvent) {
  if (props.readOnly) return
  if (e.pointerType === 'mouse') return
  longPressTimer = window.setTimeout(() => {
    emit('contextMenu', { bookmark: props.bookmark, x: e.clientX, y: e.clientY })
  }, 500)
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const showUrl = computed(() => props.viewMode === 'list' || props.viewMode === 'cards')
const showDescription = computed(() => props.viewMode === 'cards')

const displayHost = computed(() => {
  try {
    return new URL(props.bookmark.url).hostname.replace(/^www\./, '')
  } catch {
    return props.bookmark.url
  }
})

const effectiveRadius = computed(() => {
  const s = tabSettings.value
  if (s.iconStyle === 'rounded') return Math.floor(s.iconSize / 2)
  if (s.iconStyle === 'flat') return Math.min(4, s.iconRadius)
  return s.iconRadius
})

const iconComputedStyle = computed(() => ({
  background: props.bookmark.color || 'var(--accent)',
  color: '#fff',
  width: `${tabSettings.value.iconSize}px`,
  height: `${tabSettings.value.iconSize}px`,
  borderRadius: `${effectiveRadius.value}px`,
  opacity: String(tabSettings.value.iconOpacity),
  boxShadow: tabSettings.value.iconStyle === 'flat' ? 'none' : undefined,
}))

const nameComputedStyle = computed(() => ({
  fontSize: `${tabSettings.value.nameSize}px`,
  color: tabSettings.value.nameColor || undefined,
}))
</script>

<style lang="scss" scoped>
.tab-bm {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 0.5rem;
  border-radius: $radius-card;
  text-decoration: none;
  color: var(--text-main);
  transition: all 0.2s;

  &:hover {
    background: var(--surface-1);
    transform: translateY(-2px);

    .tab-bm__remove {
      opacity: 1;
    }
  }

  &--pinned::before {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 5px;
    height: 5px;
    border-radius: $radius-full;
    background: var(--accent);
  }

  // list 视图：横向行式
  .tab-grid--list & {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--surface-1);
  }

  // cards 视图：宽卡片纵向排列
  .tab-grid--cards & {
    align-items: flex-start;
    padding: 1rem;
    background: var(--surface-1);
    border: 1px solid var(--border-soft);
  }

  // compact 视图：更紧凑
  .tab-grid--compact & {
    padding: 0.4375rem 0.25rem;
    gap: 0.25rem;
  }
}

.tab-bm__img {
  width: 60%;
  height: 60%;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
}

.tab-bm__url {
  font-size: 0.6875rem;
  color: var(--text-faint);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .tab-grid--list & {
    margin-left: auto;
  }
}

.tab-bm__desc {
  font-size: 0.75rem;
  color: var(--text-soft);
  line-height: 1.4;
  max-width: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tab-bm__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
  transition:
    width 0.2s ease,
    height 0.2s ease,
    border-radius 0.2s ease,
    opacity 0.2s ease;
}

.tab-bm__letter {
  font-size: 1.125rem;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
}

.tab-bm__name {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-soft);
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bm__remove {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: $radius-full;
  background: var(--surface-2);
  color: var(--text-soft);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--accent);
    color: #fff;
  }
}
</style>
