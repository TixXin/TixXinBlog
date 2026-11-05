<!--
  @file RssSubscribeModal.vue
  @description RSS 订阅弹窗：切换文章/闪念/朋友圈订阅源，复制完整订阅地址、一键加入阅读器或在新标签页查看源文件
  @author TixXin
  @since 2026-11-05
-->

<template>
  <Teleport to="body">
    <Transition name="rss-modal">
      <div v-if="visible" class="rss-overlay" @click.self="close">
        <div
          ref="dialogRef"
          class="rss-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rss-modal-title"
          tabindex="-1"
        >
          <header class="rss-modal__header">
            <Icon name="lucide:rss" size="16" class="rss-modal__icon" aria-hidden="true" />
            <h3 id="rss-modal-title" class="rss-modal__title">{{ $t('article.rss.modal.title') }}</h3>
            <button type="button" class="rss-modal__close" :aria-label="$t('article.rss.modal.close')" @click="close">
              <Icon name="lucide:x" size="16" aria-hidden="true" />
            </button>
          </header>

          <div class="rss-modal__body">
            <p class="rss-modal__desc">{{ $t('article.rss.modal.description') }}</p>

            <!-- 订阅源切换：默认选中被点击的入口 -->
            <div class="rss-modal__feeds" role="group" :aria-label="$t('article.rss.modal.feedGroup')">
              <button
                v-for="item in RSS_FEEDS"
                :key="item.key"
                type="button"
                class="rss-modal__feed"
                :class="{ 'rss-modal__feed--active': item.key === feedKey }"
                :aria-pressed="item.key === feedKey"
                @click="feedKey = item.key"
              >
                {{ $t(item.labelKey) }}
              </button>
            </div>

            <!-- 订阅地址与复制 -->
            <label class="rss-modal__label" for="rss-modal-url">{{ $t('article.rss.modal.urlLabel') }}</label>
            <div class="rss-modal__url-row">
              <input
                id="rss-modal-url"
                ref="urlRef"
                class="rss-modal__url"
                type="text"
                readonly
                :value="feedUrl"
                @focus="selectUrl"
              />
              <button type="button" class="rss-modal__copy btn-primary" @click="copyUrl">
                <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" size="14" aria-hidden="true" />
                {{ copied ? $t('article.rss.modal.copied') : $t('article.rss.modal.copy') }}
              </button>
            </div>

            <BlogRssSubscribeLinks :feed="feed" :feed-url="feedUrl" />
            <p class="rss-modal__note">{{ $t('article.rss.modal.emailNote') }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { RSS_FEEDS, feedAbsoluteUrl, rssFeedByKey } from '~/features/feed/rssFeeds'

const { t } = useI18n()
const { visible, feedKey, close } = useRssSubscribe()
const siteUrl = useSiteUrl()
const toast = useToast()

const dialogRef = ref<HTMLElement | null>(null)
const urlRef = ref<HTMLInputElement | null>(null)
useModalFocus(() => visible.value, dialogRef, { close })

const feed = computed(() => rssFeedByKey(feedKey.value))
// 站点地址由部署环境注入（静态形态为构建时的 --site-url），缺失时用浏览器当前域名
const feedUrl = computed(() =>
  feedAbsoluteUrl(siteUrl, feed.value.path, import.meta.client ? window.location.origin : ''),
)

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
let alive = true
onBeforeUnmount(() => {
  alive = false
  if (copyTimer) clearTimeout(copyTimer)
})
// 切换订阅源或关闭后不再沿用上一次的「已复制」状态
watch([feedKey, visible], () => {
  copied.value = false
})

function selectUrl() {
  urlRef.value?.select()
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(feedUrl.value)
    if (!alive) return
    copied.value = true
    toast.success(t('article.rss.modal.copySuccess'))
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    if (!alive) return
    // 剪贴板不可用时选中地址，方便手动复制
    selectUrl()
    toast.error(t('article.rss.modal.copyFailed'))
  }
}
</script>

<style lang="scss" scoped>
.rss-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(14vh, 7rem);

  @media (max-width: #{$breakpoint-sm - 1px}) {
    align-items: flex-end;
    padding-top: 0;
  }
}

.rss-modal {
  width: min(460px, calc(100vw - 2rem));
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
  overflow: hidden;

  @media (max-width: #{$breakpoint-sm - 1px}) {
    width: 100%;
    border-radius: $radius-lg $radius-lg 0 0;
  }
}

.rss-modal__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.rss-modal__icon {
  color: var(--accent-text);
  flex-shrink: 0;
}

.rss-modal__title {
  flex: 1;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.rss-modal__close {
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

.rss-modal__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.rss-modal__desc,
.rss-modal__note {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--text-soft);
}

.rss-modal__note {
  color: var(--text-muted);
}

.rss-modal__feeds {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--surface-2);
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
}

.rss-modal__feed {
  min-height: 2.25rem;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);

  &:hover {
    color: var(--text-main);
  }

  &--active {
    background: var(--surface-1);
    color: var(--text-main);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
}

.rss-modal__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: -0.375rem;
}

.rss-modal__url-row {
  display: flex;
  gap: 0.5rem;
}

.rss-modal__url {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: $radius-md;
  background: var(--surface-2);
  color: var(--text-main);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
}

.rss-modal__copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0 0.875rem;
  min-height: 2.5rem;
  border-radius: $radius-md;
  font-size: 0.8125rem;
}

.rss-modal__feed,
.rss-modal__close {
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

/* ---- Transition ---- */
.rss-modal-enter-active,
.rss-modal-leave-active,
.rss-modal-enter-active .rss-modal,
.rss-modal-leave-active .rss-modal {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.rss-modal-enter-from,
.rss-modal-leave-to {
  opacity: 0;
}

.rss-modal-enter-from .rss-modal,
.rss-modal-leave-to .rss-modal {
  transform: translateY(-10px) scale(0.98);
}
</style>
