<!--
  @file ReleaseBadge.vue
  @description 后台顶栏的版本标签：显示当前运行版本（测试版附标记），有新版本时显示提示点；
    点击打开版本列表弹窗，查看更新说明并复制升级命令。版本信息只在打开后台后于客户端读取一次
  @author TixXin
  @since 2026-11-06
-->
<template>
  <span class="release-badge">
    <button
      type="button"
      class="release-badge__button"
      :class="{ 'release-badge__button--update': summary?.latest }"
      :aria-label="buttonLabel"
      aria-haspopup="dialog"
      @click="open"
    >
      <Icon name="lucide:tag" size="14" aria-hidden="true" />
      <span class="release-badge__version">{{ versionText }}</span>
      <span v-if="summary?.channel === 'beta'" class="release-badge__beta">{{ $t('admin-media.release.beta') }}</span>
      <span v-if="summary?.latest" class="release-badge__dot" aria-hidden="true" />
    </button>
    <dialog ref="dialog" class="release-dialog" aria-labelledby="release-dialog-title" @click.self="close">
      <div class="release-dialog__panel">
        <header class="release-dialog__header">
          <h2 id="release-dialog-title">{{ $t('admin-media.release.title') }}</h2>
          <button
            type="button"
            class="release-dialog__close"
            :aria-label="$t('admin-media.release.close')"
            @click="close"
          >
            <Icon name="lucide:x" size="16" aria-hidden="true" />
          </button>
        </header>
        <p class="release-dialog__status" role="status">{{ statusText }}</p>
        <AdminReleaseList v-if="summary?.items.length" :items="summary.items" />
        <p v-else-if="!loading" class="release-dialog__empty">{{ $t('admin-media.release.empty') }}</p>
        <footer class="release-dialog__footer">
          <span>{{ checkedText }}</span>
          <button type="button" :disabled="loading" @click="load(true)">
            <Icon name="lucide:refresh-cw" size="14" aria-hidden="true" />
            {{ $t('admin-media.release.refresh') }}
          </button>
        </footer>
      </div>
    </dialog>
  </span>
</template>

<script setup lang="ts">
import { siteDateTime } from '~/features/site/timeZone'

const { t } = useI18n()
const { summary, loading, failed, load } = useReleaseInfo()
const timeZone = useSiteTimeZone()
const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => void load())

const versionText = computed(() =>
  summary.value?.current ? `v${summary.value.current}` : t('admin-media.release.development'),
)
const buttonLabel = computed(() =>
  summary.value?.latest
    ? t('admin-media.release.labelUpdate', { current: versionText.value, latest: summary.value.latest })
    : t('admin-media.release.label', { current: versionText.value }),
)
const statusText = computed(() => {
  if (loading.value) return t('admin-media.release.loading')
  if (failed.value || summary.value?.error) return t('admin-media.release.failed')
  if (!summary.value?.current) return t('admin-media.release.noVersion')
  return summary.value.latest
    ? t('admin-media.release.available', { latest: summary.value.latest })
    : t('admin-media.release.upToDate')
})
const checkedText = computed(() =>
  summary.value?.checkedAt
    ? t('admin-media.release.checkedAt', { time: siteDateTime(summary.value.checkedAt, timeZone.value) })
    : '',
)

function open() {
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
}
</script>

<style scoped lang="scss">
.release-badge {
  display: inline-flex;
}
// 与顶栏其他按钮同一外观（布局的作用域样式不作用于子组件内部元素，这里单独声明）
.release-badge__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: var(--interaction-cursor, pointer);
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
  &:hover {
    background: var(--surface-2);
    border-color: var(--border-soft);
    color: var(--text-main);
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  &--update {
    color: var(--text-main);
  }
}
.release-badge__beta {
  padding: 0.05rem 0.35rem;
  border-radius: 0.3rem;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.6875rem;
  font-weight: 600;
}
.release-badge__dot {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--danger);
}
// 全局样式会清零 dialog 外边距，这里恢复模态居中
.release-dialog {
  inset: 0;
  margin: auto;
  width: min(40rem, calc(100vw - 2rem));
  max-height: min(80vh, 46rem);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  background: var(--surface-1);
  color: var(--text-main);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
}
.release-dialog__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: inherit;
  padding: 1rem 1.25rem;
}
.release-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  h2 {
    margin: 0;
    font-size: 1rem;
  }
}
.release-dialog__close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: $radius-full;
  background: transparent;
  color: var(--text-soft);
  cursor: var(--interaction-cursor, pointer);
  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}
.release-dialog__status,
.release-dialog__empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-muted);
}
.release-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-soft);
  font-size: 0.75rem;
  color: var(--text-soft);
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 2rem;
    padding: 0 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8125rem;
    cursor: var(--interaction-cursor, pointer);
    &:disabled {
      opacity: 0.5;
    }
  }
}
.release-dialog__close,
.release-dialog__footer button {
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
}
@media (max-width: 760px) {
  .release-badge__version {
    max-width: 7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
