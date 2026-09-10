<!-- @file index.vue @description 图库管理入口，公开状态与媒体文件保留范围清晰分离 -->
<template>
  <section class="admin-gallery">
    <header>
      <div>
        <h1>图库管理</h1>
        <p>维护照片作品，排序值越大越靠前；相同排序按作品编号倒序。</p>
      </div>
      <NuxtLink to="/admin/gallery/new">新建照片作品</NuxtLink
      ><NuxtLink to="/admin/gallery/settings">摄影器材设置</NuxtLink><NuxtLink to="/gallery">查看画廊</NuxtLink>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn">
        <div class="admin-gallery__filters">
          <label
            >搜索作品<input
              :value="query.q ?? ''"
              aria-label="搜索作品"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >作品状态<select
              :value="query.status"
              aria-label="筛选作品状态"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已公开</option>
              <option value="withdrawn">已撤回</option>
            </select></label
          ><label
            >分类<input
              :value="query.category ?? ''"
              aria-label="筛选作品分类"
              maxlength="40"
              @change="filter({ category: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><button type="button" @click="filter({ category: '' })">仅未分类</button
          ><button type="button" @click="filter({ q: undefined, category: undefined, status: undefined })">
            清除筛选
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || '正在读取图库'"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">当前筛选尚未成功读取，以下保留上一次查询的作品。</p>
        <p v-if="!pending && !error && data?.total === 0">当前条件下暂无作品。</p>
        <ul class="admin-gallery__list">
          <li v-for="photo in data?.items ?? []" :key="photo.id">
            <CommonImageFrame
              :src="photo.src"
              :alt="photo.title"
              :width="photo.width"
              :height="photo.height"
              fit="contain"
            />
            <div>
              <h2>{{ photo.title }}</h2>
              <p>
                {{ labels[photo.status] }} · {{ photo.category || '未分类' }} · 排序 {{ photo.sortOrder }} · 版本
                {{ photo.revision }}
              </p>
              <p>{{ photo.description }}</p>
              <div class="admin-gallery__actions">
                <NuxtLink :to="`/admin/gallery/${photo.id}`">编辑作品</NuxtLink
                ><NuxtLink v-if="photo.status === 'published'" :to="`/gallery?photo=${photo.id}`">查看公开作品</NuxtLink
                ><button
                  v-if="photo.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(photo.id)"
                  @click="mutate(photo, { status: 'published' })"
                >
                  发布作品</button
                ><button
                  v-if="photo.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(photo.id)"
                  @click="mutate(photo, { status: 'withdrawn' })"
                >
                  撤回作品</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(photo.id) || photo.sortOrder >= 1000000"
                  @click="mutate(photo, { sortOrder: photo.sortOrder + 1 })"
                >
                  提高排序</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(photo.id) || photo.sortOrder <= -1000000"
                  @click="mutate(photo, { sortOrder: photo.sortOrder - 1 })"
                >
                  降低排序</button
                ><button type="button" :disabled="pending || busy.includes(photo.id)" @click="mutate(photo)">
                  删除作品
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav
          v-if="data && (data.total > 12 || query.page > 1)"
          class="admin-gallery__actions"
          aria-label="管理图库分页"
        >
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            上一页</button
          ><span>{{ query.page }} / {{ Math.max(1, Math.ceil(data.total / 12)) }} · 共 {{ data.total }} 项</span
          ><button
            type="button"
            :disabled="pending || query.page * 12 >= data.total"
            @click="filter({ page: query.page + 1 })"
          >
            下一页
          </button>
        </nav>
      </template>
      <p v-else-if="!restoringPending">请先登录博主账号。</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '图库管理', robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminGallery()
const labels = { draft: '草稿', published: '已公开', withdrawn: '已撤回' }
</script>
<style scoped lang="scss">
.admin-gallery {
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
header,
.admin-gallery__filters,
.admin-gallery__actions {
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
  background: var(--surface-2);
  color: var(--text-main);
}
button:disabled {
  opacity: 0.5;
}
.admin-gallery__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.admin-gallery__list li {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
.admin-gallery__list p {
  white-space: pre-wrap;
}
@media (max-width: 600px) {
  .admin-gallery__list li {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-gallery__list :deep(.image-frame) {
    max-width: 260px;
  }
}
</style>
