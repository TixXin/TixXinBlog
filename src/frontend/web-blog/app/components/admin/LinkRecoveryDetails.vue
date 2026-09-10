<!-- @file LinkRecoveryDetails.vue @description 友链恢复副本完整只读显示，不自动访问旧URL或绑定旧Logo -->
<template>
  <dl class="recovery-details">
    <dt>站点名称</dt>
    <dd>{{ value.name || '未填写' }}</dd>
    <dt>站点介绍</dt>
    <dd>{{ value.description || '未填写' }}</dd>
    <dt>站点地址</dt>
    <dd>{{ value.url || '未填写' }}</dd>
    <dt>发布状态 / 推荐 / 排序值</dt>
    <dd>{{ linkStatusLabels[value.status] }} / {{ value.isFeatured ? '推荐' : '未推荐' }} / {{ value.sortOrder }}</dd>
    <dt>原Logo媒体编号</dt>
    <dd>{{ value.logoMediaId || '未设置' }}</dd>
    <dt>原外部Logo地址</dt>
    <dd>{{ value.logoUrl || '未设置' }}</dd>
    <dd>跨内容库的副本不直接绑定旧Logo，请核对当前媒体或HTTPS图片地址后重新填写。</dd>
  </dl>
</template>
<script setup lang="ts">
import { linkStatusLabels } from '~/features/link/types'
import type { LinkEditable } from '~/features/link/types'
defineProps<{ value: LinkEditable }>()
</script>
<style scoped>
.recovery-details {
  display: grid;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}
dt {
  font-weight: 600;
  margin-top: 0.5rem;
}
dd {
  margin: 0;
  color: var(--text-muted);
  white-space: pre-wrap;
}
</style>
