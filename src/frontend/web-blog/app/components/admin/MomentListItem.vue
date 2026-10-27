<!-- @file MomentListItem.vue @description 朋友圈管理页的动态卡片：状态、置顶与内容摘要，编辑、置顶、改状态、评论管理与删除入口 -->
<template>
  <li>
    <p>
      {{ $t(`admin-content.moments.status.${note.status}`) }}
      <span v-if="note.isPinned">· {{ $t('admin-content.moments.pinned') }}</span> ·
      {{ note.updatedAt.slice(0, 10) }}
    </p>
    <p class="admin-moments__content">{{ note.content }}</p>
    <p>{{ note.topics?.map((topicName) => '#' + topicName).join(' ') }}</p>
    <div class="admin-moments__actions">
      <NuxtLink :to="`/admin/moments/${note.id}`">{{ $t('admin-content.moments.edit') }}</NuxtLink>
      <NuxtLink v-if="note.status === 'published'" :to="`/moments/${note.id}`">{{
        $t('admin-content.moments.viewPublic')
      }}</NuxtLink>
      <button type="button" :disabled="busy || pending" @click="emit('update', { isPinned: !note.isPinned })">
        {{ note.isPinned ? $t('admin-content.moments.unpin') : $t('admin-content.moments.pin') }}
      </button>
      <button
        v-if="note.status !== 'published'"
        type="button"
        :disabled="busy || pending"
        @click="emit('update', { status: 'published' })"
      >
        {{ $t('admin-content.moments.publish') }}
      </button>
      <button
        v-if="note.status !== 'draft'"
        type="button"
        :disabled="busy || pending"
        @click="emit('update', { status: 'draft' })"
      >
        {{ $t('admin-content.moments.toDraft') }}
      </button>
      <button
        v-if="note.status !== 'archived'"
        type="button"
        :disabled="busy || pending"
        @click="emit('update', { status: 'archived' })"
      >
        {{ $t('admin-content.moments.archive') }}
      </button>
      <button type="button" :disabled="busy" @click="emit('comments', $event)">
        {{ $t('admin-content.moments.manageComments') }}
      </button>
      <button type="button" :disabled="busy || pending" @click="emit('remove')">
        {{ $t('admin-content.moments.remove') }}
      </button>
    </div>
  </li>
</template>
<script setup lang="ts">
import type { ManagedMoment, MomentEditable } from '~/features/moment/types'

defineProps<{ note: ManagedMoment; busy: boolean; pending: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<MomentEditable>]; comments: [event: Event]; remove: [] }>()
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-moments' as moments;

@include moments.page;
</style>
