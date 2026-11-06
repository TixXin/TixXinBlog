<!-- @file MomentListItem.vue @description 朋友圈管理页的动态卡片：状态徽章、置顶与内容摘要；编辑、置顶、评论管理常驻，查看公开页、改状态与删除收进“更多” -->
<template>
  <li>
    <p class="admin-moments__meta">
      <AdminStatusBadge :status="note.status" :label="$t(`admin-content.moments.status.${note.status}`)" />
      <span v-if="note.isPinned">{{ $t('admin-content.moments.pinned') }}</span>
      <span>{{ note.updatedAt.slice(0, 10) }}</span>
    </p>
    <p class="admin-moments__content">{{ note.content }}</p>
    <p>{{ note.topics?.map((topicName) => '#' + topicName).join(' ') }}</p>
    <div class="admin-moments__actions">
      <NuxtLink :to="`/admin/moments/${note.id}`">{{ $t('admin-content.moments.edit') }}</NuxtLink>
      <button type="button" :disabled="busy || pending" @click="emit('update', { isPinned: !note.isPinned })">
        {{ note.isPinned ? $t('admin-content.moments.unpin') : $t('admin-content.moments.pin') }}
      </button>
      <button type="button" :disabled="busy" @click="emit('comments', $event)">
        {{ $t('admin-content.moments.manageComments') }}
      </button>
      <AdminMoreMenu>
        <NuxtLink v-if="note.status === 'published'" :to="`/moments/${note.id}`">{{
          $t('admin-content.moments.viewPublic')
        }}</NuxtLink>
        <button
          v-for="target in statusTargets"
          :key="target.status"
          type="button"
          :disabled="busy || pending"
          @click="emit('update', { status: target.status })"
        >
          {{ $t(target.label) }}
        </button>
        <button type="button" class="admin-more__danger" :disabled="busy || pending" @click="emit('remove')">
          {{ $t('admin-content.moments.remove') }}
        </button>
      </AdminMoreMenu>
    </div>
  </li>
</template>
<script setup lang="ts">
import type { ManagedMoment, MomentEditable } from '~/features/moment/types'

const props = defineProps<{ note: ManagedMoment; busy: boolean; pending: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<MomentEditable>]; comments: [event: Event]; remove: [] }>()
// 改到当前状态以外的三种状态
const statusTargets = computed(() =>
  (
    [
      { status: 'published', label: 'admin-content.moments.publish' },
      { status: 'draft', label: 'admin-content.moments.toDraft' },
      { status: 'archived', label: 'admin-content.moments.archive' },
    ] as const
  ).filter((target) => target.status !== props.note.status),
)
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-moments' as moments;

@include moments.page;
</style>
