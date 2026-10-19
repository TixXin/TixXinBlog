<!-- @file index.vue @description 项目管理列表，项目进展与内容发布状态分别筛选和维护 -->
<template>
  <section class="admin-projects">
    <header>
      <div>
        <h1>{{ $t('admin-media.projectList.title') }}</h1>
        <p>{{ $t('admin-media.projectList.intro') }}</p>
      </div>
      <NuxtLink to="/admin/projects/new">{{ $t('admin-media.projectList.create') }}</NuxtLink
      ><NuxtLink to="/projects">{{ $t('admin-media.projectList.viewPublic') }}</NuxtLink>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-projects__filters">
          <label
            >{{ $t('admin-media.projectList.search')
            }}<input
              :value="query.q ?? ''"
              :aria-label="$t('admin-media.projectList.searchLabel')"
              maxlength="200"
              @change="filter({ q: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><label
            >{{ $t('admin-media.projectList.status')
            }}<select
              :value="query.status"
              :aria-label="$t('admin-media.projectList.statusLabel')"
              @change="filter({ status: ($event.target as HTMLSelectElement).value })"
            >
              <option value="all">{{ $t('admin-media.projectList.allStatus') }}</option>
              <option v-for="status in projectStatuses" :key="status" :value="status">
                {{ projectStatusLabel(status, t) }}
              </option>
            </select></label
          ><label
            >{{ $t('admin-media.projectList.progress')
            }}<select
              :value="query.progress ?? ''"
              :aria-label="$t('admin-media.projectList.progressLabel')"
              @change="filter({ progress: ($event.target as HTMLSelectElement).value || undefined })"
            >
              <option value="">{{ $t('admin-media.projectList.allProgress') }}</option>
              <option v-for="progress in projectProgresses" :key="progress" :value="progress">
                {{ projectProgressLabel(progress, t) }}
              </option>
            </select></label
          ><label
            >{{ $t('admin-media.projectList.tag')
            }}<input
              :value="query.tag ?? ''"
              :aria-label="$t('admin-media.projectList.tagLabel')"
              maxlength="40"
              @change="filter({ tag: ($event.target as HTMLInputElement).value || undefined })" /></label
          ><button
            type="button"
            @click="filter({ q: undefined, status: undefined, progress: undefined, tag: undefined })"
          >
            {{ $t('admin-media.projectList.clearFilters') }}
          </button>
        </div>
        <CommonRequestFeedback
          v-if="pending || error"
          :pending="pending"
          :compact="!!data"
          :title="error || $t('admin-media.projectList.loading')"
          @retry="load"
        />
        <p v-if="notice" role="status">{{ notice }}</p>
        <p v-if="stale" role="status">{{ $t('admin-media.projectList.stale') }}</p>
        <p v-if="!pending && !error && data?.total === 0">{{ $t('admin-media.projectList.empty') }}</p>
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
            <div v-else class="admin-projects__no-cover">
              <Icon name="lucide:panels-top-left" />{{ $t('admin-media.projectList.noCover') }}
            </div>
            <div>
              <h2>{{ project.title }}</h2>
              <p>
                {{
                  $t('admin-media.projectList.meta', {
                    status: projectStatusLabel(project.status, t),
                    progress: projectProgressLabel(project.progress, t),
                    sort: project.sortOrder,
                    revision: project.revision,
                  })
                }}
              </p>
              <p>{{ project.description }}</p>
              <p>
                {{
                  project.tags.map((tag) => tag.label).join($t('admin-media.projectList.tagSeparator')) ||
                  $t('admin-media.projectList.noTags')
                }}
              </p>
              <div class="admin-projects__actions">
                <NuxtLink :to="`/admin/projects/${project.id}`">{{ $t('admin-media.projectList.edit') }}</NuxtLink
                ><NuxtLink
                  v-if="project.status === 'published'"
                  :to="`/projects?q=${encodeURIComponent(project.title)}`"
                  >{{ $t('admin-media.projectList.viewProject') }}</NuxtLink
                ><button
                  v-if="project.status !== 'published'"
                  type="button"
                  :disabled="pending || busy.includes(project.id)"
                  @click="mutate(project, { status: 'published' })"
                >
                  {{ $t('admin-media.projectList.publish') }}</button
                ><button
                  v-if="project.status === 'published'"
                  type="button"
                  :disabled="pending || busy.includes(project.id)"
                  @click="mutate(project, { status: 'withdrawn' })"
                >
                  {{ $t('admin-media.projectList.withdraw') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(project.id) || project.sortOrder >= 1000000"
                  @click="mutate(project, { sortOrder: project.sortOrder + 1 })"
                >
                  {{ $t('admin-media.projectList.raise') }}</button
                ><button
                  type="button"
                  :disabled="pending || busy.includes(project.id) || project.sortOrder <= -1000000"
                  @click="mutate(project, { sortOrder: project.sortOrder - 1 })"
                >
                  {{ $t('admin-media.projectList.lower') }}</button
                ><button type="button" :disabled="pending || busy.includes(project.id)" @click="mutate(project)">
                  {{ $t('admin-media.projectList.remove') }}
                </button>
              </div>
            </div>
          </li>
        </ul>
        <nav
          v-if="data && (data.total > 12 || query.page > 1)"
          class="admin-projects__actions"
          :aria-label="$t('admin-media.projectList.pagination')"
        >
          <button type="button" :disabled="pending || query.page <= 1" @click="filter({ page: query.page - 1 })">
            {{ $t('admin-media.projectList.prev') }}</button
          ><span>{{
            $t('admin-media.projectList.pageInfo', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / 12)),
              total: data.total,
            })
          }}</span
          ><button
            type="button"
            :disabled="pending || query.page * 12 >= data.total"
            @click="filter({ page: query.page + 1 })"
          >
            {{ $t('admin-media.projectList.next') }}
          </button>
        </nav>
      </template>
      <p v-else-if="!restoringPending">{{ $t('admin-media.projectList.loginRequired') }}</p></ClientOnly
    >
  </section>
</template>
<script setup lang="ts">
import {
  projectProgresses,
  projectProgressLabel,
  projectStatusLabel,
  projectStatusLabels,
  type ProjectPublicationStatus,
} from '~/features/project/types'
definePageMeta({ layout: 'admin' })
const { t } = useI18n()
const projectStatuses = Object.keys(projectStatusLabels) as ProjectPublicationStatus[]
useSeoMeta({ title: () => t('admin-media.projectList.title'), robots: 'noindex, nofollow' })
const { data, pending, error, notice, busy, query, filter, load, mutate, isLoggedIn, restoringPending, stale } =
  useAdminProjects()
</script>
<style scoped lang="scss">
.admin-projects {
  display: grid;
  min-width: 0;
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
  min-width: 0;
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
  .admin-projects__filters > label,
  .admin-projects__filters > button {
    flex: 1 1 100%;
  }
  .admin-projects__filters input,
  .admin-projects__filters select,
  .admin-projects__filters button {
    width: 100%;
  }
  .admin-projects__list li {
    grid-template-columns: minmax(0, 1fr);
  }
  .admin-projects__list :deep(.image-frame) {
    max-width: 260px;
  }
}
</style>
