<!-- @file index.vue @description 订阅管理列表：筛选、发布、撤回、版本化排序和软删除 -->
<template>
  <section class="subscription-ui subscription-stack">
    <header class="subscription-row">
      <div>
        <h1>{{ $t('admin-media.subscriptionList.title') }}</h1>
        <p>{{ $t('admin-media.subscriptionList.intro') }}</p>
      </div>
      <NuxtLink to="/admin/subscriptions/new">{{ $t('admin-media.subscriptionList.create') }}</NuxtLink
      ><NuxtLink to="/subscriptions">{{ $t('admin-media.subscriptionList.viewPublic') }}</NuxtLink>
    </header>
    <ClientOnly>
      <SubscriptionFilters :query="admin.query.value" @change="admin.filter" />
      <div class="subscription-row">
        <label
          >{{ $t('admin-media.subscriptionList.status')
          }}<select
            :value="admin.query.value.status"
            :aria-label="$t('admin-media.subscriptionList.statusLabel')"
            @change="admin.filter({ status: ($event.target as HTMLSelectElement).value })"
          >
            <option value="all">{{ $t('admin-media.subscriptionList.allStatus') }}</option>
            <option v-for="value in publications" :key="value" :value="value">{{ publicationLabel(value, t) }}</option>
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
          {{ $t('admin-media.subscriptionList.clearFilters') }}
        </button>
      </div>
      <CommonRequestFeedback
        v-if="admin.pending.value || admin.error.value"
        :pending="admin.pending.value"
        :title="admin.error.value || $t('admin-media.subscriptionList.loading')"
        @retry="admin.load"
      />
      <p v-if="admin.notice.value" role="status">{{ admin.notice.value }}</p>
      <p v-if="admin.data.value?.total === 0 && !admin.pending.value">
        {{ $t('admin-media.subscriptionList.empty') }}
      </p>
      <p v-if="admin.data.value" class="subscription-note">
        {{ $t('admin-media.subscriptionList.total', { total: admin.data.value.total }, admin.data.value.total) }}
      </p>
      <ul class="subscription-admin-list">
        <li v-for="item in admin.data.value?.items ?? []" :key="item.id" class="subscription-panel">
          <header class="subscription-row">
            <h2>{{ item.name }}</h2>
            <strong>{{ formatAmount(item.amount, item.currency) }} / {{ cycleLabel(item.billingCycle, t) }}</strong>
          </header>
          <p>
            {{
              $t('admin-media.subscriptionList.meta', {
                publication: publicationLabel(item.status, t),
                state: stateLabel(item.subscriptionStatus, t),
                category: categoryLabel(item.category, t),
                sort: item.sortOrder,
                revision: item.revision,
              })
            }}
          </p>
          <p>{{ item.description || $t('admin-media.subscriptionList.noDescription') }}</p>
          <div class="subscription-row">
            <NuxtLink :to="`/admin/subscriptions/${item.id}`">{{ $t('admin-media.subscriptionList.edit') }}</NuxtLink
            ><button
              v-if="item.status !== 'published'"
              type="button"
              :disabled="busy(item.id)"
              @click="admin.mutate(item, { status: 'published' })"
            >
              {{ $t('admin-media.subscriptionList.publish') }}</button
            ><button
              v-else
              type="button"
              :disabled="busy(item.id)"
              @click="admin.mutate(item, { status: 'withdrawn' })"
            >
              {{ $t('admin-media.subscriptionList.withdraw') }}</button
            ><button
              type="button"
              :disabled="busy(item.id) || item.sortOrder >= 1000000"
              @click="admin.mutate(item, { sortOrder: item.sortOrder + 1 }, true)"
            >
              {{ $t('admin-media.subscriptionList.raise') }}</button
            ><button
              type="button"
              :disabled="busy(item.id) || item.sortOrder <= -1000000"
              @click="admin.mutate(item, { sortOrder: item.sortOrder - 1 }, true)"
            >
              {{ $t('admin-media.subscriptionList.lower') }}</button
            ><button type="button" :disabled="busy(item.id)" @click="admin.mutate(item)">
              {{ $t('admin-media.subscriptionList.remove') }}
            </button>
          </div>
          <SubscriptionHistory :history="item.priceHistory" />
        </li>
      </ul>
      <nav
        v-if="admin.data.value && (admin.data.value.total > admin.query.value.pageSize || admin.query.value.page > 1)"
        class="subscription-row"
        :aria-label="$t('admin-media.subscriptionList.pagination')"
      >
        <button
          type="button"
          :disabled="admin.pending.value || admin.query.value.page <= 1"
          @click="admin.filter({ page: admin.query.value.page - 1 })"
        >
          {{ $t('admin-media.subscriptionList.prev') }}</button
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
          {{ $t('admin-media.subscriptionList.next') }}
        </button>
      </nav>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { formatAmount } from '@tixxin/subscription-domain'
import { categoryLabel, cycleLabel, publicationLabel, stateLabel } from '~/features/subscription/labels'
import { publicationLabels, type SubscriptionPublication } from '~/features/subscription/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
const publications = Object.keys(publicationLabels) as SubscriptionPublication[]
useSeoMeta({ title: () => t('admin-media.subscriptionList.title'), robots: 'noindex, nofollow' })
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
