<!--
  @file CommentPolicy.vue
  @description 评论审核设置卡片：开关「新游客评论需审核」并保存，显示服务器当前模式与版本、读取失败的重试与通知说明
-->
<template>
  <section class="admin-card admin-comment-policy" :aria-label="t('admin-content.comments.policy.label')">
    <div class="admin-comment-policy__main">
      <h2>{{ t('admin-content.comments.policy.heading') }}</h2>
      <p>{{ t('admin-content.comments.policy.intro') }}</p>
      <p v-if="policy" class="admin-comment-policy__meta" role="status">
        {{
          t('admin-content.comments.policy.current', {
            mode: t(
              policy.requireApproval
                ? 'admin-content.comments.policy.modeApproval'
                : 'admin-content.comments.policy.modeDirect',
            ),
            revision: policy.revision,
          })
        }}
      </p>
      <p class="admin-comment-policy__meta">{{ t('admin-content.comments.policy.noNotification') }}</p>
      <p v-if="error" role="alert">
        {{ error }}
        <button type="button" :disabled="pending" @click="emit('reload')">
          {{ t('admin-content.comments.policy.reload') }}
        </button>
      </p>
    </div>
    <div class="admin-comment-policy__actions">
      <label
        ><input v-model="requireApproval" type="checkbox" :disabled="!policy || pending" />{{
          t('admin-content.comments.policy.requireApproval')
        }}</label
      >
      <button
        type="button"
        class="admin-btn admin-btn--primary"
        :disabled="!policy || pending || requireApproval === policy.requireApproval"
        @click="emit('save')"
      >
        {{ t('admin-content.comments.policy.save') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CommentPolicy } from '~/features/article/useCommentPolicy'

defineProps<{ policy: CommentPolicy | null; pending: boolean; error: string }>()
const requireApproval = defineModel<boolean>('requireApproval', { required: true })
const emit = defineEmits<{ save: []; reload: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
.admin-comment-policy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.5rem;

  h2 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
  }
  p {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  p.admin-comment-policy__meta {
    color: var(--text-soft);
    font-size: 0.75rem;
  }
}
.admin-comment-policy__main {
  flex: 1 1 22rem;
  min-width: 0;
}
.admin-comment-policy__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;

  label {
    display: inline-flex;
    align-items: center;
    font-size: 0.875rem;
  }
}
</style>
