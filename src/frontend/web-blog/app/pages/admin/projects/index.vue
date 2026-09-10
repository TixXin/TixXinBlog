<!-- @file index.vue @description 项目管理列表，项目进展与内容发布状态分别筛选和维护 -->
<template>
  <section class="admin-projects">
    <header>
      <div>
        <h1>项目管理</h1>
        <p>维护个人项目和作品。排序值越大越靠前，相同排序按项目编号倒序。</p>
      </div>
      <NuxtLink to="/admin/projects/new">新建项目</NuxtLink><NuxtLink to="/projects">查看项目展示</NuxtLink>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-projects__filters">
          <label
            >搜索项目<input
              :value="query.q ?? ''"
              aria-label="搜索管理项目"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >发布状态<select
              :value="query.status"
              aria-label="筛选项目发布状态"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">全部发布状态</option>
              <option v-for="(label, status) in projectStatusLabels" :key="status" :value="status">{{ label }}</option>
            </select></label
          ><label
            >项目进展<select
              :value="query.progress ?? ''"
              aria-label="筛选管理项目进展"
              @change="filter({ progress: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">全部进展</option>
              <option v-for="(label, progress) in projectProgressLabels" :key="progress" :value="progress">
                {{ label }}
              </option>
            </select></label
          ><label
            >技术标签<input
              :value="query.tag ?? ''"
              aria-label="筛选管理项目技术"
              maxlength="40"
              @change="filter({ tag: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><button
            type="button"
            @click="filter({ q: undefined, status: undefined, progress: undefined, tag: undefined })"
          >
            清除筛选
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || '正在读取项目'"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">当前筛选尚未成功读取，以下保留上一次查询的项目。</p>
        <p v-if="!pending && !error && data?.total === 0">当前条件下暂无项目。</p>
        <ul class="admin-projects__list">
          <li v-for="project in data?.items ?? []" :key="project.id">
            <CommonImageFrame
              v-if="project.cover"
              :src="project.cover"
              :alt="project.title"
              :width="project.width ?? undefined"
              :height="project.height ?? undefined"
              fit="contain"
            />
            <div v-else class="admin-projects__no-cover"><Icon name="lucide:panels-top-left" />未设置封面</div>
            <div>
              <h2>{{ project.title }}</h2>
              <p>
                {{ projectStatusLabels[project.status] }} · {{ projectProgressLabels[project.progress] }} · 排序
                {{ project.sortOrder }} · 版本 {{ project.revision }}
              </p>
              <p>{{ project.description }}</p>
              <p>{{ project.tags.map((tag) => tag.label).join('、') || '尚未填写技术标签' }}</p>
              <div class="admin-projects__actions">
                <NuxtLink :to="`/admin/projects/${project.id}`">编辑项目</NuxtLink
                ><NuxtLink
                  v-if="project.status === 'published'"
                  :to="`/projects?q=${encodeURIComponent(project.title)}`"
                  >查看公开项目</NuxtLink
                ><button
                  v-if="project.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(project.id)"
                  @click="mutate(project, { status: 'published' })"
                >
                  发布项目</button
                ><button
                  v-if="project.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(project.id)"
                  @click="mutate(project, { status: 'withdrawn' })"
                >
                  撤回项目</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(project.id) || project.sortOrder >= 1000000"
                  @click="mutate(project, { sortOrder: project.sortOrder + 1 })"
                >
                  提高排序</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(project.id) || project.sortOrder <= -1000000"
                  @click="mutate(project, { sortOrder: project.sortOrder - 1 })"
                >
                  降低排序</button
                ><button type="button" :disabled="pending || busy.includes(project.id)" @click="mutate(project)">
                  删除项目
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav
          v-if="data && (data.total > 12 || query.page > 1)"
          class="admin-projects__actions"
          aria-label="管理项目分页"
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
import { projectProgressLabels, projectStatusLabels } from '~/features/project/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '项目管理', robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminProjects()
</script>
<style scoped lang="scss">
.admin-projects {
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
header,
.admin-projects__filters,
.admin-projects__actions {
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
.admin-projects__list {
  display: grid;
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.admin-projects__list li {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
.admin-projects__list p {
  white-space: pre-wrap;
}
.admin-projects__no-cover {
  display: flex;
  min-height: 100px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface-2);
  color: var(--text-muted);
}
@media (max-width: 600px) {
  .admin-projects__list li {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-projects__list :deep(.image-frame) {
    max-width: 260px;
  }
}
</style>
