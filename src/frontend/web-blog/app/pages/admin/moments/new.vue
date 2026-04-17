<!--
  @file new.vue
  @description 闪念发布编辑器（博主 owner 才可访问），mock 阶段写入 useMomentList 状态
  @author TixXin
  @since 2026-04-17
-->

<template>
  <div class="main-inner moment-publish-page">
    <div class="main-content__header moment-publish-header">
      <NuxtLink to="/moments" class="back-btn">
        <Icon name="lucide:arrow-left" size="16" />
        返回朋友圈
      </NuxtLink>
      <h1 class="moment-publish-header__title">发布闪念</h1>
    </div>

    <CommonCustomScrollbar class="moment-publish-body" viewport-class="moment-publish-viewport" primary>
      <div class="moment-publish-content">
        <!-- 未登录 / 非 owner 守卫 -->
        <CommonStateBlock
          v-if="!isOwner"
          icon="lucide:lock"
          title="仅博主可发布"
          description="该入口需要博主账号登录后访问"
        >
          <button type="button" class="primary-btn" @click="onLogin">前往登录</button>
        </CommonStateBlock>

        <!-- 编辑器表单 -->
        <form v-else class="moment-form" @submit.prevent="onSubmit">
          <!-- 正文 -->
          <label class="moment-form__field">
            <span class="moment-form__label">
              正文 <span class="moment-form__hint">（支持 Markdown、待办清单 - [ ] / - [x]）</span>
            </span>
            <textarea
              v-model="form.content"
              rows="6"
              required
              placeholder="此刻在想什么？支持 **加粗**、`代码`、列表、引用、链接…"
              class="moment-form__textarea"
            />
            <span class="moment-form__counter">{{ form.content.length }} / 1000</span>
          </label>

          <!-- 话题 multi-select -->
          <div class="moment-form__field">
            <span class="moment-form__label">话题</span>
            <div class="moment-form__topic-list">
              <button
                v-for="topic in topicChoices"
                :key="topic.name"
                type="button"
                class="moment-form__topic"
                :class="{ 'is-selected': form.topics.includes(topic.name) }"
                :style="{ '--topic-color': topic.color }"
                @click="toggleTopic(topic.name)"
              >
                <Icon :name="topic.icon" size="12" />
                #{{ topic.name }}
              </button>
            </div>
          </div>

          <!-- 图片 URL 列表 -->
          <label class="moment-form__field">
            <span class="moment-form__label">
              图片
              <span class="moment-form__hint">（每行一个 URL，最多 9 张；后端就绪后改为上传）</span>
            </span>
            <textarea
              v-model="imageInput"
              rows="3"
              placeholder="https://example.com/photo.jpg"
              class="moment-form__textarea moment-form__textarea--code"
            />
          </label>

          <!-- 元信息：地点 / 设备 / 心情 -->
          <div class="moment-form__row">
            <label class="moment-form__field">
              <span class="moment-form__label">地点</span>
              <input v-model="form.location" type="text" placeholder="深圳·南山" class="moment-form__input" >
            </label>
            <label class="moment-form__field">
              <span class="moment-form__label">设备</span>
              <input v-model="form.device" type="text" placeholder="MacBook Pro" class="moment-form__input" >
            </label>
            <label class="moment-form__field">
              <span class="moment-form__label">心情</span>
              <input v-model="form.mood" type="text" placeholder="🚀 心情大好" class="moment-form__input" >
            </label>
          </div>

          <!-- 置顶 -->
          <label class="moment-form__checkbox">
            <input v-model="form.isPinned" type="checkbox" >
            <span>置顶到列表顶部</span>
          </label>

          <!-- 外链 OG（可选，折叠） -->
          <details class="moment-form__details">
            <summary>引用外链（可选）</summary>
            <div class="moment-form__row">
              <label class="moment-form__field">
                <span class="moment-form__label">URL</span>
                <input v-model="form.linkedLink.url" type="url" placeholder="https://..." class="moment-form__input" >
              </label>
              <label class="moment-form__field">
                <span class="moment-form__label">标题</span>
                <input v-model="form.linkedLink.title" type="text" class="moment-form__input" >
              </label>
            </div>
            <label class="moment-form__field">
              <span class="moment-form__label">描述</span>
              <input v-model="form.linkedLink.description" type="text" class="moment-form__input" >
            </label>
            <div class="moment-form__row">
              <label class="moment-form__field">
                <span class="moment-form__label">站点名</span>
                <input v-model="form.linkedLink.siteName" type="text" class="moment-form__input" >
              </label>
              <label class="moment-form__field">
                <span class="moment-form__label">封面图 URL</span>
                <input v-model="form.linkedLink.image" type="url" class="moment-form__input" >
              </label>
            </div>
          </details>

          <!-- 操作 -->
          <div class="moment-form__actions">
            <button type="button" class="ghost-btn" @click="resetForm">清空</button>
            <button type="submit" class="primary-btn" :disabled="!canSubmit">
              <Icon name="lucide:send" size="14" />
              发布
            </button>
          </div>
        </form>
      </div>
    </CommonCustomScrollbar>
  </div>
</template>

<script setup lang="ts">
import { MOMENT_TOPIC_DEFINITIONS } from '~/features/moment/topics'
import type { MomentLinkedLink } from '~/features/moment/types'

definePageMeta({
  // mock 阶段不强制路由层守卫，模板内对 isOwner 判定后降级为登录提示
  // 后端就绪后可改为 middleware: 'auth-owner'
})

useSeoMeta({
  title: '发布闪念',
  robots: 'noindex, nofollow',
})

const router = useRouter()
const { currentUser } = useCurrentUser()
const { open: openLoginDrawer } = useLoginDrawer()
const { create } = useMomentList()

const isOwner = computed(() => currentUser.value?.role === 'owner')

const topicChoices = MOMENT_TOPIC_DEFINITIONS

const form = reactive({
  content: '',
  topics: [] as string[],
  location: '',
  device: '',
  mood: '',
  isPinned: false,
  linkedLink: {
    url: '',
    title: '',
    description: '',
    siteName: '',
    image: '',
  },
})

const imageInput = ref('')

const canSubmit = computed(
  () => form.content.trim().length > 0 && form.content.length <= 1000,
)

function toggleTopic(name: string) {
  const i = form.topics.indexOf(name)
  if (i >= 0) form.topics.splice(i, 1)
  else form.topics.push(name)
}

function onLogin() {
  openLoginDrawer('login')
}

function resetForm() {
  form.content = ''
  form.topics = []
  form.location = ''
  form.device = ''
  form.mood = ''
  form.isPinned = false
  form.linkedLink.url = ''
  form.linkedLink.title = ''
  form.linkedLink.description = ''
  form.linkedLink.siteName = ''
  form.linkedLink.image = ''
  imageInput.value = ''
}

function onSubmit() {
  if (!canSubmit.value) return

  const images = imageInput.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 9)

  const linkedLink: MomentLinkedLink | undefined =
    form.linkedLink.url && form.linkedLink.title
      ? {
          url: form.linkedLink.url.trim(),
          title: form.linkedLink.title.trim(),
          description: form.linkedLink.description.trim() || undefined,
          siteName: form.linkedLink.siteName.trim() || undefined,
          image: form.linkedLink.image.trim() || undefined,
        }
      : undefined

  const item = create({
    content: form.content.trim(),
    images: images.length > 0 ? images : undefined,
    topics: form.topics.length > 0 ? [...form.topics] : undefined,
    location: form.location.trim() || undefined,
    device: form.device.trim() || undefined,
    mood: form.mood.trim() || undefined,
    isPinned: form.isPinned || undefined,
    linkedLink,
  })

  router.push(`/moments/${item.id}`)
}
</script>

<style lang="scss" scoped>
.moment-publish-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.moment-publish-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.moment-publish-header__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: $transition-colors;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.moment-publish-body {
  flex: 1;
  min-height: 0;
}

:deep(.moment-publish-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.moment-publish-content {
  max-width: 720px;
  margin: 0 auto;
}

// 表单
.moment-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.moment-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
}

.moment-form__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-main);
}

.moment-form__hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-faint);
}

.moment-form__textarea,
.moment-form__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  background: var(--surface-1);
  color: var(--text-main);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  resize: vertical;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}

.moment-form__textarea--code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.8125rem;
}

.moment-form__counter {
  align-self: flex-end;
  font-size: 0.75rem;
  color: var(--text-faint);
}

.moment-form__row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

// 话题 chip 列表
.moment-form__topic-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.moment-form__topic {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 0.75rem;
  border-radius: $radius-full;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: var(--topic-color, var(--accent));
    border-color: var(--topic-color, var(--accent));
  }

  &.is-selected {
    color: #fff;
    background: var(--topic-color, var(--accent));
    border-color: var(--topic-color, var(--accent));
  }
}

.moment-form__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-main);
  cursor: pointer;
  user-select: none;

  input {
    accent-color: var(--accent);
  }
}

// 折叠 details
.moment-form__details {
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  padding: 0.75rem 1rem;

  summary {
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-main);
    user-select: none;
  }

  > .moment-form__field,
  > .moment-form__row {
    margin-top: 0.75rem;
  }
}

// 操作按钮
.moment-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-soft);
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.88;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.ghost-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.875rem;
  border: 1px solid var(--border);
  border-radius: $radius-sm;
  cursor: pointer;
  transition: $transition-colors;

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}
</style>
