<!-- @file index.vue @description 项目管理列表，项目进展与内容发布状态分别筛选和维护 -->
<template>
  <section class="admin-projects">
    <header class="admin-page-header">
      <div>
        <h1>{{ $t('admin-media.projectList.title') }}</h1>
        <p>{{ $t('admin-media.projectList.intro') }}</p>
      </div>
      <div class="admin-toolbar">
        <NuxtLink class="admin-btn admin-btn--primary" to="/admin/projects/new">{{
          $t('admin-media.projectList.create')
        }}</NuxtLink
        ><NuxtLink class="admin-btn admin-btn--ghost" to="/projects">{{
          $t('admin-media.projectList.viewPublic')
        }}</NuxtLink>
      </div>
    </header>
    <ClientOnly
      ><template v-if="isLoggedIn"
        ><div class="admin-card admin-toolbar admin-projects__filters">
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
        <ul class="admin-collection-list">
          <AdminCollectionItem
            v-for="project in data?.items ?? []"
            :key="project.id"
            :title="project.title"
            :meta="
              $t('admin-media.projectList.meta', {
                status: projectStatusLabel(project.status, t),
                progress: projectProgressLabel(project.progress, t),
                sort: project.sortOrder,
                revision: project.revision,
              })
            "
            :description="project.description"
          >
            <template #media>
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
            </template>
            <p>
              {{
                project.tags.map((tag) => tag.label).join($t('admin-media.projectList.tagSeparator')) ||
                $t('admin-media.projectList.noTags')
              }}
            </p>
            <template #actions>
              <AdminCollectionActions
                :edit-to="`/admin/projects/${project.id}`"
                :view-to="`/projects?q=${encodeURIComponent(project.title)}`"
                :published="project.status === 'published'"
                :sort-order="project.sortOrder"
                :disabled="pending || busy.includes(project.id)"
                :labels="actionLabels"
                @update="mutate(project, $event)"
                @remove="mutate(project)"
              />
            </template>
          </AdminCollectionItem>
        </ul>
        <AdminCollectionPagination
          v-if="data"
          :page="query.page"
          :total="data.total"
          :disabled="pending"
          :label="$t('admin-media.projectList.pagination')"
          :prev-label="$t('admin-media.projectList.prev')"
          :next-label="$t('admin-media.projectList.next')"
          :summary="
            $t('admin-media.projectList.pageInfo', {
              page: query.page,
              pages: Math.max(1, Math.ceil(data.total / 12)),
              total: data.total,
            })
          "
          @go="filter({ page: $event })"
        />
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
const actionLabels = computed(() => ({
  edit: t('admin-media.projectList.edit'),
  view: t('admin-media.projectList.viewProject'),
  publish: t('admin-media.projectList.publish'),
  withdraw: t('admin-media.projectList.withdraw'),
  raise: t('admin-media.projectList.raise'),
  lower: t('admin-media.projectList.lower'),
  remove: t('admin-media.projectList.remove'),
}))
</script>
<style scoped lang="scss">
.admin-projects__filters {
  align-items: flex-end;
  padding: 0.75rem;
}
.admin-projects {
  display: grid;
  min-width: 0;
  gap: 1rem;
  overflow-wrap: anywhere;
}
p {
  color: var(--text-muted);
  margin-block: 0.5rem;
}
label {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
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
}
</style>
