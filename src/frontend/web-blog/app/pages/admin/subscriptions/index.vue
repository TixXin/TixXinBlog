<!-- @file index.vue @description 订阅管理列表：筛选、发布、撤回、版本化排序和软删除 -->
<template>
  <section class="subscription-ui subscription-stack">
    <header class="subscription-row">
      <div>
        <h1>订阅管理</h1>
        <p>订阅状态与发布状态分别维护。排序值越大越靠前。</p>
      </div>
      <NuxtLink to="/admin/subscriptions/new">新建订阅</NuxtLink><NuxtLink to="/subscriptions">查看平台订阅费</NuxtLink>
    </header>
    <ClientOnly>
      <SubscriptionFilters :query="admin.query.value" @change="admin.filter" />
      <div class="subscription-row">
        <label
          >发布状态<select
            :value="admin.query.value.status"
            aria-label="筛选订阅发布状态"
            @change="admin.filter({ status: ($event.target as HTMLSelectElement).value })"
          >
            <option value="all">全部发布状态</option>
            <option v-for="(label, value) in publicationLabels" :key="value" :value="value">{{ label }}</option>
          </select></label
        ><button
          type="button"
          @click="
            admin.filter({
              q: undefined,
              category: undefined,
              currency: undefined,
              subscriptionStatus: undefined,
              status: undefined,
              sort: undefined,
            })
          "
        >
          清除筛选
        </button>
      </div>
      <CommonRequestFeedback
        v-if="admin.pending.value || admin.error.value"
        :pending="admin.pending.value"
        :title="admin.error.value || '正在读取订阅'"
        @retry="admin.load"
      />
      <p v-if="admin.notice.value" role="status">{{ admin.notice.value }}</p>
      <p v-if="admin.data.value?.total === 0 && !admin.pending.value">当前条件下暂无订阅。</p>
      <p v-if="admin.data.value" class="subscription-note">共 {{ admin.data.value.total }} 条匹配订阅</p>
      <ul class="subscription-admin-list">
        <li v-for="item in admin.data.value?.items ?? []" :key="item.id" class="subscription-panel">
          <header class="subscription-row">
            <h2>{{ item.name }}</h2>
            <strong>{{ formatAmount(item.amount, item.currency) }} / {{ cycleLabels[item.billingCycle] }}</strong>
          </header>
          <p>
            {{ publicationLabels[item.status] }} · {{ stateLabels[item.subscriptionStatus] }} ·
            {{ categoryLabels[item.category] }} · 排序 {{ item.sortOrder }} · 版本 {{ item.revision }}
          </p>
          <p>{{ item.description || '暂无描述' }}</p>
          <div class="subscription-row">
            <NuxtLink :to="`/admin/subscriptions/${item.id}`">编辑订阅</NuxtLink
            ><button
              v-if="item.status !== 'published'"
              type="button"
              :disabled="busy(item.id)"
              @click="admin.mutate(item, { status: 'published' })"
            >
              发布订阅</button
            ><button
              v-else
              type="button"
              :disabled="busy(item.id)"
              @click="admin.mutate(item, { status: 'withdrawn' })"
            >
              撤回订阅</button
            ><button
              type="button"
              :disabled="busy(item.id) || item.sortOrder >= 1000000"
              @click="admin.mutate(item, { sortOrder: item.sortOrder + 1 }, true)"
            >
              提高排序</button
            ><button
              type="button"
              :disabled="busy(item.id) || item.sortOrder <= -1000000"
              @click="admin.mutate(item, { sortOrder: item.sortOrder - 1 }, true)"
            >
              降低排序</button
            ><button type="button" :disabled="busy(item.id)" @click="admin.mutate(item)">删除订阅</button>
          </div>
          <SubscriptionHistory :history="item.priceHistory" />
        </li>
      </ul>
      <nav
        v-if="admin.data.value && (admin.data.value.total > admin.query.value.pageSize || admin.query.value.page > 1)"
        class="subscription-row"
        aria-label="管理订阅分页"
      >
        <button
          type="button"
          :disabled="admin.pending.value || admin.query.value.page <= 1"
          @click="admin.filter({ page: admin.query.value.page - 1 })"
        >
          上一页</button
        ><span
          >{{ admin.query.value.page }} /
          {{ Math.max(1, Math.ceil(admin.data.value.total / admin.query.value.pageSize)) }}</span
        ><button
          type="button"
          :disabled="
            admin.pending.value || admin.query.value.page * admin.query.value.pageSize >= admin.data.value.total
          "
          @click="admin.filter({ page: admin.query.value.page + 1 })"
        >
          下一页
        </button>
      </nav>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabels, cycleLabels, stateLabels, publicationLabels } from '~/features/subscription/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '订阅管理', robots: 'noindex, nofollow' })
const admin = useAdminSubscriptions()
const busy = (id: number) => admin.pending.value || admin.busy.value.includes(id)
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-admin-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}
header > div {
  margin-right: auto;
}
</style>
