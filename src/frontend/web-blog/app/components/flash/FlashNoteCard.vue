<!--
  @file FlashNoteCard.vue
  @description 闪念笔记卡片：Blinko 风格 — 内容 + 标签 + 操作栏（点赞 / 评论 / 复制 / 删除）+ 评论区
  @author TixXin
  @since 2026-04-11
-->

<template>
  <article
    :id="'flash-note-' + note.id"
    class="fnc"
    :class="{
      'fnc--cited': cited,
      'fnc--commenting': commentOpen,
      'fnc--highlighted': highlighted,
      'fnc--pinned': note.isPinned,
      'fnc--draft': note.isDraft,
    }"
  >
    <!-- 状态徽章：置顶 / 草稿 -->
    <div v-if="note.isPinned || note.isDraft" class="fnc__badges">
      <span v-if="note.isPinned" class="fnc__badge fnc__badge--pin">
        <Icon name="lucide:pin" size="11" />
        {{ $t('flash-moment.noteCard.pinned') }}
      </span>
      <span v-if="note.isDraft" class="fnc__badge fnc__badge--draft">
        <Icon name="lucide:file-edit" size="11" />
        {{ $t('flash-moment.noteCard.draft') }}
      </span>
    </div>

    <!-- eslint-disable-next-line vue/no-v-html -->
    <div ref="contentRef" class="fnc__content" v-html="renderedContent" />
    <CommonMarkdownImages :root="contentRef" :html="renderedContent" />

    <FlashImageGrid v-if="note.images && note.images.length > 0" :images="note.images" :descriptions="note.imageAlts" />

    <div v-if="note.tags.length > 0" class="fnc__tags">
      <template v-for="tag in note.tags" :key="tag">
        <span v-if="interactive === false" class="fnc__tag">#{{ tag }}</span>
        <button v-else type="button" class="fnc__tag" @click="$emit('tag-click', tag)">#{{ tag }}</button>
      </template>
    </div>

    <FlashNoteCardFooter
      v-model:comment-open="commentOpen"
      :note="note"
      :liked="liked"
      :comment-count="commentCount"
      :relative-time="relativeTime"
      :type-meta="typeMeta"
      :read-only="readOnly"
      :busy="busy"
      :interactive="interactive"
      @toggle-like="$emit('toggle-like', $event)"
      @edit="$emit('edit')"
      @set-pinned="$emit('set-pinned', $event)"
      @set-archived="$emit('set-archived', $event)"
      @remove="$emit('remove', $event)"
    />

    <!-- 评论区 -->
    <FlashNoteCardComments
      :note-id="note.id"
      :open="commentOpen"
      :comments="note.comments"
      :can-interact="canInteract"
      :busy="busy"
      :read-only="readOnly"
      :current-user-id="currentUserId"
      :render-clock="renderClock"
      :clock-ready="clockReady"
      @add-comment="$emit('add-comment', $event)"
      @remove-comment="$emit('remove-comment', $event)"
    />
  </article>
</template>

<script setup lang="ts">
import type { FlashNote, FlashCommentSubmission } from '~/features/flash/types'
import { renderFlashMarkdown } from '~/utils/flashMarkdown'
import { publishedCommentCount } from '~/features/flash/comments'
import { FLASH_TYPE_META, formatFlashRelative } from '~/features/flash/date'

const props = withDefaults(
  defineProps<{
    note: FlashNote
    cited?: boolean
    readOnly?: boolean
    busy?: boolean
    interactive?: boolean
    /** AI 引用高亮：外部控制 2s 脉冲动画 */
    highlighted?: boolean
    /** 当前登录用户 id，用于判断能否删除别人的评论 */
    currentUserId?: string | null
    /** 游客设备 id，用于判断游客能否删除自己发的评论 */
    guestId?: string | null
  }>(),
  { interactive: true, currentUserId: null, guestId: null },
)

defineEmits<{
  remove: [id: string]
  edit: []
  'toggle-like': [id: string]
  'set-pinned': [payload: { id: string; pinned: boolean }]
  'set-archived': [payload: { id: string; archived: boolean }]
  'remove-comment': [payload: { noteId: string; commentId: string }]
  'add-comment': [payload: FlashCommentSubmission]
  'tag-click': [tag: string]
}>()

const { t } = useI18n()

const commentOpen = ref(false)
const liked = computed(() => !!props.note.liked)
/** 计数只计已发布评论；访客本人待审评论只出现在列表中并带提示 */
const commentCount = computed(() => publishedCommentCount(props.note))
const canInteract = computed(() => props.interactive && !props.note.isDraft && !props.note.isArchived)

// 列表由 SSR 直出：服务端与水合首帧使用随 payload 下发的同一时刻和 UTC 日历日期，
// 挂载后再换成本机时钟与本地时区，相对时间和日期不会因时钟或时区差异产生水合不一致。
const renderClock = useState('flash-render-clock', () => Date.now())
const clockReady = ref(false)
onMounted(() => {
  clockReady.value = true
})

const relativeTime = computed(() => {
  const now = clockReady.value ? Date.now() : renderClock.value
  return formatFlashRelative(props.note.createdAt, now, clockReady.value, t)
})

const typeMeta = computed(() => {
  const meta = props.note.type ? FLASH_TYPE_META[props.note.type] : undefined
  return meta ? { icon: meta.icon, label: t(meta.labelKey) } : undefined
})

/** 轻量 markdown 渲染 —— 覆盖编辑器工具栏支持的子集 */
const siteUrl = useSiteUrl()
const renderedContent = computed(() => renderFlashMarkdown(props.note.content, { siteUrl, t }))
const contentRef = ref<HTMLElement | null>(null)
</script>

<style lang="scss" scoped>
.fnc {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem 1rem 0.75rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
  break-inside: avoid;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: var(--border);
    box-shadow: var(--shadow-elevated, 0 8px 24px rgba(0, 0, 0, 0.08));

    :deep(.fnc__action) {
      opacity: 1;
    }
  }

  &--cited {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }

  &--highlighted {
    animation: flash-highlight 2s ease-out;
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  }

  &--commenting {
    :deep(.fnc__action) {
      opacity: 1;
    }
  }
}

.fnc :deep(.fnc__action:disabled) {
  opacity: 0.45;
  cursor: var(--interaction-cursor, not-allowed);
}

.fnc__content {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-main);
  /* markdown-it 已开启 breaks 处理换行；pre-wrap 会把段落间的 \n 渲染成多余空行 */
  white-space: normal;
  word-break: break-word;
}

.fnc__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.fnc__tag {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent-text);
  background: var(--accent-soft);
  border-radius: $radius-full;
  cursor: var(--interaction-cursor, pointer);
  transition:
    opacity 0.18s,
    background 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  // 视觉尺寸不变，伪元素把点击区扩到至少 24px 高
  &::after {
    content: '';
    position: absolute;
    inset: -4px -3px;
  }

  &:hover {
    opacity: 0.75;
    background: var(--accent-action);
    color: #fff;
  }
}

/* ---- 状态徽章：置顶 / 草稿 ---- */
.fnc__badges {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.4rem;
  flex-wrap: wrap;
}

.fnc__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.0625rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  border-radius: $radius-sm;
  line-height: 1.4;
}

.fnc__badge--pin {
  color: var(--accent-text);
  background: var(--accent-soft);
}

.fnc__badge--draft {
  color: var(--text-faint);
  background: var(--surface-2);
  border: 1px dashed var(--border-soft);
}

/* 置顶卡片左侧强调条 */
.fnc--pinned {
  border-left: 2px solid var(--accent);
}

/* 草稿卡片整体透明度降低 */
.fnc--draft {
  opacity: 0.88;
}

/* ---- Markdown 渲染样式（markdown-it 输出标准标签，需 :deep） ---- */
.fnc__content {
  :deep(p) {
    margin: 0 0 0.4rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(a) {
    color: var(--accent-text);
    text-decoration: none;
    border-bottom: 1px dotted currentColor;

    &:hover {
      opacity: 0.85;
    }
  }

  :deep(strong) {
    font-weight: 600;
  }

  :deep(em) {
    font-style: italic;
  }

  :deep(del) {
    color: var(--text-faint);
  }

  :deep(code) {
    padding: 0.1rem 0.35rem;
    background: var(--surface-2);
    border-radius: $radius-sm;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    color: var(--accent-text);
  }

  :deep(pre) {
    margin: 0.5rem 0;
    padding: 0.75rem 1rem;
    background: var(--surface-2);
    border-radius: $radius-sm;
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.5;

    code {
      padding: 0;
      background: transparent;
      color: var(--text-main);
    }
  }

  :deep(blockquote) {
    margin: 0.4rem 0;
    padding: 0.25rem 0.75rem;
    border-left: 2px solid var(--accent);
    color: var(--text-soft);
    font-style: italic;
    background: var(--surface-2);
    border-radius: 0 $radius-sm $radius-sm 0;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.25rem;
    margin: 0.25rem 0 0.4rem;
  }

  :deep(li) {
    margin: 0.125rem 0;
  }

  // markdown-it-task-lists 输出：<li class="task-list-item">
  :deep(.task-list-item) {
    list-style: none;
    margin-left: -1.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  :deep(.task-list-item-checkbox) {
    flex-shrink: 0;
    margin: 0;
    accent-color: var(--accent);
    cursor: var(--interaction-cursor, default);
  }

  :deep(hr) {
    margin: 0.75rem 0;
    border: none;
    border-top: 1px dashed var(--border-soft);
  }
}

/* ---- AI 引用高亮脉冲 ---- */
@keyframes flash-highlight {
  0% {
    box-shadow: 0 0 0 3px var(--accent);
  }
  100% {
    box-shadow: 0 0 0 3px transparent;
  }
}
</style>
