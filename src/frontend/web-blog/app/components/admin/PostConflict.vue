<!--
  @file PostConflict.vue
  @description 显示本地与服务器完整内容，必须显式比较后选择，不自动覆盖。
-->
<template>
  <section class="post-conflict" :aria-label="$t('admin-content.postConflict.region')">
    <h2>{{ titleText }}</h2>
    <p>{{ descriptionText }}</p>
    <div class="post-conflict__columns">
      <section v-for="item in versions" :key="item.label">
        <h3>
          {{
            $t('admin-content.postConflict.versionHeading', {
              label: item.label,
              revision: item.draft.revision ?? $t('admin-content.postConflict.unknown'),
            })
          }}
        </h3>
        <p>{{ $t('admin-content.postConflict.fieldTitle', { value: item.draft.title }) }}</p>
        <p>{{ $t('admin-content.postConflict.fieldSummary', { value: item.draft.summary }) }}</p>
        <p>
          {{
            $t('admin-content.postConflict.fieldRelations', {
              value: contentRelationSummary(item.draft.relatedContent),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldTaxonomy', {
              folder: item.draft.folder,
              tags: item.draft.tags.join($t('admin-content.postConflict.tagSeparator')),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldCover', {
              value: item.draft.cover || $t('admin-content.postConflict.none'),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldAddress', {
              slug: item.draft.slug || $t('admin-content.postConflict.numericAddress'),
              alt: item.draft.coverAlt || $t('admin-content.postConflict.notSet'),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldSeoTitle', {
              value: item.draft.seoTitle || $t('admin-content.postConflict.useTitle'),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldSeo', {
              description: item.draft.seoDescription || $t('admin-content.postConflict.useSummary'),
              indexing: item.draft.seoNoindex
                ? $t('admin-content.postConflict.noindex')
                : $t('admin-content.postConflict.index'),
            })
          }}
        </p>
        <p>
          {{
            $t('admin-content.postConflict.fieldMeta', {
              status: item.draft.status,
              minutes: item.draft.readTimeMinutes,
              pinned: item.draft.pinned ? $t('admin-content.postConflict.yes') : $t('admin-content.postConflict.no'),
            })
          }}
        </p>
        <label
          >{{ $t('admin-content.postConflict.bodyLabel', { label: item.label })
          }}<textarea readonly rows="12" :value="item.draft.contentRaw" />
        </label>
      </section>
    </div>
    <details class="post-conflict__diff">
      <summary>
        {{
          $t('admin-content.postConflict.diffSummary', {
            removed: difference.removed.length,
            added: difference.added.length,
          })
        }}
      </summary>
      <p>{{ $t('admin-content.postConflict.diffHint', { from: serverLabelText, to: localLabelText }) }}</p>
      <pre>{{ difference.prefix.slice(-3).join('\n') }}</pre>
      <pre
        v-if="difference.removed.length"
        class="post-conflict__removed"
        :aria-label="$t('admin-content.postConflict.removed')"
        >{{ difference.removed.join('\n') }}</pre>
      <pre
        v-if="difference.added.length"
        class="post-conflict__added"
        :aria-label="$t('admin-content.postConflict.added')"
        >{{ difference.added.join('\n') }}</pre>
      <pre>{{ difference.suffix.slice(0, 3).join('\n') }}</pre>
    </details>
    <button type="button" @click="$emit('useServer')">{{ useServerLabelText }}</button
    ><button type="button" @click="$emit('keepLocal')">{{ keepLocalLabelText }}</button>
  </section>
</template>
<script setup lang="ts">
import type { AdminPostDraft } from '~/features/post/adminTypes'
import { postDifference } from '~/utils/postDifference'
import { contentRelationSummary } from '~/features/content-relation/editor'
const props = defineProps<{
  local: AdminPostDraft
  server: AdminPostDraft
  title?: string
  description?: string
  localLabel?: string
  serverLabel?: string
  useServerLabel?: string
  keepLocalLabel?: string
}>()
const { t } = useI18n()
// 未传入的标题与按钮文案使用默认的服务器冲突说明，随界面语言变化
const titleText = computed(() => props.title ?? t('admin-content.postConflict.defaultTitle'))
const descriptionText = computed(() => props.description ?? t('admin-content.postConflict.defaultDescription'))
const localLabelText = computed(() => props.localLabel ?? t('admin-content.postConflict.defaultLocal'))
const serverLabelText = computed(() => props.serverLabel ?? t('admin-content.postConflict.defaultServer'))
const useServerLabelText = computed(() => props.useServerLabel ?? t('admin-content.postConflict.defaultUseServer'))
const keepLocalLabelText = computed(() => props.keepLocalLabel ?? t('admin-content.postConflict.defaultKeepLocal'))
defineEmits<{ useServer: []; keepLocal: [] }>()
const difference = computed(() => postDifference(props.server.contentRaw, props.local.contentRaw))
const versions = computed(() => [
  { label: localLabelText.value, draft: props.local },
  { label: serverLabelText.value, draft: props.server },
])
</script>
<style scoped lang="scss">
.post-conflict {
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1rem;
  margin: 1rem 0;
  background: var(--surface-2);
  overflow-wrap: anywhere;
}
.post-conflict__diff {
  margin-top: 1rem;
}
.post-conflict__diff pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 20rem;
  overflow: auto;
  padding: 0.5rem;
}
.post-conflict__removed {
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
.post-conflict__added {
  border-left: 3px solid #22c55e;
  background: rgba(34, 197, 94, 0.08);
}
h2 {
  font-size: 1.2rem;
  font-weight: 600;
}
h3 {
  margin: 1rem 0;
}
.post-conflict__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
textarea {
  width: 100%;
  color: var(--text-main);
  background: var(--surface-1);
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
button {
  padding: 0.65rem;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
}
@media (max-width: 700px) {
  .post-conflict__columns {
    grid-template-columns: 1fr;
  }
}
</style>
