<!-- @file GuestbookFilters.vue @description 留言管理的筛选栏：关键词、审核状态、仅看未回复与日期，提交时由页面重新读取 -->
<template>
  <AdminFilterBar class="admin-guestbook__filters" :label="$t('admin-system.layout.filters')" @submit="$emit('apply')">
    <input
      v-model="q"
      :aria-label="$t('admin-media.guestbook.searchLabel')"
      :placeholder="$t('admin-media.guestbook.searchPlaceholder')"
      maxlength="200"
    />
    <select v-model="status" :aria-label="$t('admin-media.guestbook.statusLabel')">
      <option value="all">{{ $t('admin-media.guestbook.allStatus') }}</option>
      <option value="published">{{ $t('admin-media.guestbook.status.published') }}</option>
      <option value="pending">{{ $t('admin-media.guestbook.status.pending') }}</option>
      <option value="hidden">{{ $t('admin-media.guestbook.status.hidden') }}</option>
    </select>
    <label><input v-model="unanswered" type="checkbox" />{{ $t('admin-media.guestbook.unanswered') }}</label>
    <label
      >{{ $t('admin-media.guestbook.date')
      }}<CommonDatePicker v-model="date" :aria-label="$t('admin-media.guestbook.dateLabel')" clearable /></label
    ><template #actions
      ><button type="submit">{{ $t('admin-media.guestbook.filter') }}</button></template
    >
  </AdminFilterBar>
</template>
<script setup lang="ts">
defineEmits<{ apply: [] }>()
const q = defineModel<string>('q', { required: true })
const status = defineModel<string>('status', { required: true })
const unanswered = defineModel<boolean>('unanswered', { required: true })
const date = defineModel<string>('date', { required: true })
</script>
