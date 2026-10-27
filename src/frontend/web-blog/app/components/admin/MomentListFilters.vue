<!-- @file MomentListFilters.vue @description 朋友圈管理页的筛选表单：关键词、话题、发布日期与状态；提交事件由页面监听根元素 -->
<template>
  <form class="admin-moments__filters">
    <input
      v-model="search"
      :aria-label="$t('admin-content.moments.searchLabel')"
      maxlength="200"
      :placeholder="$t('admin-content.moments.searchPlaceholder')"
    />
    <input
      v-model="topic"
      :aria-label="$t('admin-content.moments.topicLabel')"
      maxlength="40"
      :placeholder="$t('admin-content.moments.topicPlaceholder')"
    />
    <label
      >{{ $t('admin-content.moments.dateLabel')
      }}<CommonDatePicker v-model="date" :aria-label="$t('admin-content.moments.dateFilterLabel')" clearable
    /></label>
    <select v-model="status" :aria-label="$t('admin-content.moments.statusFilterLabel')">
      <option value="all">{{ $t('admin-content.moments.statusAll') }}</option>
      <option value="published">{{ $t('admin-content.moments.status.published') }}</option>
      <option value="draft">{{ $t('admin-content.moments.status.draft') }}</option>
      <option value="archived">{{ $t('admin-content.moments.status.archived') }}</option>
    </select>
    <button type="submit">{{ $t('admin-content.moments.filter') }}</button>
  </form>
</template>
<script setup lang="ts">
const search = defineModel<string>('search', { required: true }),
  topic = defineModel<string>('topic', { required: true }),
  date = defineModel<string>('date', { required: true }),
  status = defineModel<string>('status', { required: true })
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-moments' as moments;

@include moments.page;
</style>
