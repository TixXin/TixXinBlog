<!--
  @file ReleaseList.vue
  @description 版本列表：标出当前、最新、测试版与含数据库迁移；展开查看更新说明（Markdown 渲染并净化）。
    比当前新的版本提供一键安装站点的升级命令与复制按钮，升级本身仍在服务器上执行
  @author TixXin
  @since 2026-11-06
-->
<template>
  <ol class="release-list">
    <li
      v-for="item in items"
      :key="item.version"
      class="release-item"
      :class="{ 'release-item--current': item.current }"
    >
      <details :open="item.version === openVersion">
        <summary>
          <Icon name="lucide:chevron-right" size="14" class="release-item__chevron" aria-hidden="true" />
          <span class="release-item__version">v{{ item.version }}</span>
          <span v-if="item.current" class="release-item__tag release-item__tag--current">{{
            $t('admin-media.release.current')
          }}</span>
          <span v-if="item.version === latestVersion" class="release-item__tag release-item__tag--latest">{{
            $t('admin-media.release.latest')
          }}</span>
          <span v-if="item.prerelease" class="release-item__tag">{{ $t('admin-media.release.beta') }}</span>
          <span v-if="item.migration" class="release-item__tag release-item__tag--warn">{{
            $t('admin-media.release.migration')
          }}</span>
          <time v-if="item.publishedAt" class="release-item__date" :datetime="item.publishedAt">{{
            siteDayKey(item.publishedAt, timeZone)
          }}</time>
        </summary>
        <div class="release-item__body">
          <div v-if="item.newer" class="release-item__command">
            <p>{{ $t('admin-media.release.commandHint') }}</p>
            <div class="release-item__command-row">
              <code>{{ upgradeCommand(item.version) }}</code>
              <button type="button" @click="copy(item.version)">
                <Icon :name="copied === item.version ? 'lucide:check' : 'lucide:copy'" size="14" aria-hidden="true" />
                {{ copied === item.version ? $t('admin-media.release.copied') : $t('admin-media.release.copy') }}
              </button>
            </div>
          </div>
          <!-- 更新说明来自 GitHub Release 正文，渲染后经 DOMPurify 净化 -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="release-item__notes" v-html="notesHtml(item.notes)" />
          <a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer" class="release-item__link">
            {{ $t('admin-media.release.viewOnGithub') }}
            <Icon name="lucide:external-link" size="12" aria-hidden="true" />
          </a>
        </div>
      </details>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { siteDayKey } from '~/features/site/timeZone'
import { upgradeCommand, type ReleaseItem } from '~/features/release/types'
import { renderFlashMarkdown } from '~/utils/flashMarkdown'

const props = defineProps<{ items: ReleaseItem[] }>()
const { t } = useI18n()
const toast = useToast()
const timeZone = useSiteTimeZone()
const copied = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

const latestVersion = computed(() => props.items.find((item) => item.newer)?.version ?? null)
// 默认展开最新的可升级版本；没有更新时展开当前版本
const openVersion = computed(
  () => latestVersion.value ?? props.items.find((item) => item.current)?.version ?? props.items[0]?.version,
)

const rendered = new Map<string, string>()
function notesHtml(notes: string): string {
  if (!rendered.has(notes)) rendered.set(notes, renderFlashMarkdown(notes, { t }))
  return rendered.get(notes)!
}

async function copy(version: string) {
  try {
    await navigator.clipboard.writeText(upgradeCommand(version))
    copied.value = version
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = null), 2000)
  } catch {
    toast.error(t('admin-media.release.copyFailed'))
  }
}
</script>

<style scoped lang="scss">
.release-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-soft);
  border-radius: $radius-md;
}
.release-item + .release-item {
  border-top: 1px solid var(--border-soft);
}
.release-item--current {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  list-style: none;
  cursor: var(--interaction-cursor, pointer);
  &::-webkit-details-marker {
    display: none;
  }
  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
}
.release-item__chevron {
  color: var(--text-soft);
  transition: transform 0.15s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
details[open] .release-item__chevron {
  transform: rotate(90deg);
}
.release-item__version {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.release-item__tag {
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 600;
  &--current {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  &--latest {
    background: color-mix(in srgb, var(--success-text) 15%, transparent);
    color: var(--success-text);
  }
  &--warn {
    background: color-mix(in srgb, var(--warning-text) 15%, transparent);
    color: var(--warning-text);
  }
}
.release-item__date {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}
.release-item__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 0.75rem 0.875rem 2rem;
}
.release-item__command {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-sm;
  background: var(--surface-2);
  p {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
}
.release-item__command-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  code {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 0.8125rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
    min-height: 2rem;
    padding: 0 0.625rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--surface-1);
    color: var(--text-main);
    font-size: 0.75rem;
    cursor: var(--interaction-cursor, pointer);
    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
  }
}
.release-item__notes {
  font-size: 0.8125rem;
  line-height: 1.65;
  color: var(--text-muted);
  overflow-wrap: anywhere;
  :deep(h2) {
    display: none;
  }
  :deep(h3) {
    margin: 0.75rem 0 0.25rem;
    font-size: 0.8125rem;
    color: var(--text-main);
  }
  :deep(ul) {
    margin: 0;
    padding-left: 1.125rem;
  }
  :deep(pre) {
    overflow-x: auto;
  }
}
.release-item__link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: flex-start;
  font-size: 0.75rem;
  color: var(--accent-text);
}
</style>
