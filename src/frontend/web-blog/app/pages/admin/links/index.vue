<!-- @file index.vue @description 友链管理入口，发布、推荐、排序与删除均使用服务端版本校验 -->
<template>
  <section class="admin-links">
    <header>
      <div>
        <h1>友链管理</h1>
        <p>推荐优先，排序值越大越靠前；相同排序按编号倒序。</p>
      </div>
      <NuxtLink to="/admin/links/new">新建友链</NuxtLink><NuxtLink to="/admin/links/settings">友链须知设置</NuxtLink
      ><NuxtLink to="/links">查看友情链接</NuxtLink>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-links__filters">
          <label
            >搜索友链<input
              :value="query.q ?? ''"
              aria-label="搜索管理友链"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >发布状态<select
              :value="query.status"
              aria-label="筛选友链发布状态"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">全部状态</option>
              <option v-for="(label, status) in linkStatusLabels" :key="status" :value="status">{{ label }}</option>
            </select></label
          ><label
            >推荐<select
              :value="query.featured ?? ''"
              aria-label="筛选管理推荐"
              @change="filter({ featured: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">全部</option>
              <option value="true">推荐</option>
              <option value="false">未推荐</option>
            </select></label
          ><button type="button" @click="filter({ q: undefined, status: undefined, featured: undefined })">
            清除筛选
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || '正在读取友链'"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">当前筛选尚未成功读取，以下保留上一次查询的友链。</p>
        <p v-if="!pending && !error && data?.total === 0">当前条件下暂无友链。</p>
        <ul class="admin-links__list">
          <li v-for="link in data?.items ?? []" :key="link.id">
            <div>
              <h2>{{ link.name }}</h2>
              <p>
                {{ linkStatusLabels[link.status] }} · {{ link.isFeatured ? '推荐' : '未推荐' }} · 排序
                {{ link.sortOrder }} · 版本 {{ link.revision }}
              </p>
              <p>{{ link.description }}</p>
              <p class="admin-links__url">{{ link.url }}</p>
              <div class="admin-links__actions">
                <NuxtLink :to="`/admin/links/${link.id}`">编辑友链</NuxtLink
                ><NuxtLink v-if="link.status === 'published'" :to="`/links?q=${encodeURIComponent(link.name)}`"
                  >查看公开友链</NuxtLink
                ><button
                  v-if="link.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { status: 'published' })"
                >
                  上架友链</button
                ><button
                  v-if="link.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { status: 'withdrawn' })"
                >
                  下架友链</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id)"
                  @click="mutate(link, { isFeatured: !link.isFeatured })"
                >
                  {{ link.isFeatured ? '取消推荐' : '设为推荐' }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id) || link.sortOrder >= 1000000"
                  @click="mutate(link, { sortOrder: link.sortOrder + 1 })"
                >
                  提高排序</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(link.id) || link.sortOrder <= -1000000"
                  @click="mutate(link, { sortOrder: link.sortOrder - 1 })"
                >
                  降低排序</button
                ><button type="button" :disabled="pending || busy.includes(link.id)" @click="mutate(link)">
                  删除友链
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav v-if="data && (data.total > 12 || query.page > 1)" class="admin-links__actions" aria-label="管理友链分页">
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            上一页</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(data.total / 12)) }} · 共 {{ data.total }} 条</span
          ><button
            type="button"
            :disabled="pending || query.page * 12 >= data.total"
            @click="filter({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav></template
      >
      <p v-else-if="!restoringPending">请先登录博主账号。</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
import { linkStatusLabels } from '~/features/link/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '友链管理', robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminLinks()
</script>
<style scoped lang="scss">
.admin-links {
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
header,
.admin-links__filters,
.admin-links__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
header > div {
  margin-right: auto;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
a {
  color: var(--accent);
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
input,
select,
button {
  max-width: 100%;
  min-height: 44px;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-2);
}
button:disabled {
  opacity: 0.5;
}
.admin-links__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.admin-links__list li {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
}
.admin-links__url {
  font-size: 0.8125rem;
}
</style>
