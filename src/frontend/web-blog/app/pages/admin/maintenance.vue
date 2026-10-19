<!--
  @file maintenance.vue
  @description 内容包下载和安全迁入，明确媒体范围、冲突策略与持久化操作结果。
-->
<template>
  <section class="maintenance">
    <h1>{{ t('admin-system.maintenance.title') }}</h1>
    <ClientOnly>
      <section :aria-label="t('admin-system.maintenance.diagnostics.title')">
        <h2>{{ t('admin-system.maintenance.diagnostics.title') }}</h2>
        <p>{{ t('admin-system.maintenance.diagnostics.intro') }}</p>
        <div class="maintenance__actions">
          <button type="button" :disabled="diagnostics.pending.value" @click="diagnostics.load">
            {{ t('admin-system.maintenance.diagnostics.refresh') }}
          </button>
          <button type="button" :disabled="diagnostics.pending.value" @click="diagnostics.checkMedia">
            {{ t('admin-system.maintenance.diagnostics.checkMedia') }}
          </button>
        </div>
        <p v-if="diagnostics.pending.value" role="status">{{ t('admin-system.maintenance.diagnostics.checking') }}</p>
        <p v-if="diagnostics.error.value" role="alert">{{ diagnostics.error.value }}</p>
        <ul v-if="diagnostics.data.value">
          <li>
            {{
              t('admin-system.maintenance.diagnostics.database', {
                state: t(
                  diagnostics.data.value.databaseReachable
                    ? 'admin-system.maintenance.diagnostics.available'
                    : 'admin-system.maintenance.diagnostics.unavailable',
                ),
              })
            }}
          </li>
          <li>
            {{
              t('admin-system.maintenance.diagnostics.migrations', {
                count: diagnostics.data.value.pendingMigrations,
                drift: t(
                  diagnostics.data.value.schemaDrift
                    ? 'admin-system.maintenance.diagnostics.schemaDrifted'
                    : 'admin-system.maintenance.diagnostics.schemaAligned',
                ),
              })
            }}
          </li>
          <li>
            {{
              t('admin-system.maintenance.diagnostics.storage', {
                state: t(
                  diagnostics.data.value.storage.readable &&
                    diagnostics.data.value.storage.writable &&
                    diagnostics.data.value.storage.cleaned
                    ? 'admin-system.maintenance.diagnostics.storagePassed'
                    : 'admin-system.maintenance.diagnostics.storageFailed',
                ),
                count: diagnostics.data.value.mediaRecords,
              })
            }}
          </li>
          <li>
            {{
              t('admin-system.maintenance.diagnostics.runtime', {
                environment: diagnostics.data.value.runtime.environment,
                node: diagnostics.data.value.runtime.node,
                unsupported: diagnostics.data.value.runtime.nodeSupported
                  ? ''
                  : t('admin-system.maintenance.diagnostics.nodeUnsupported'),
              })
            }}
          </li>
        </ul>
        <template v-if="diagnostics.media.value"
          ><p role="status">
            {{
              t('admin-system.maintenance.diagnostics.mediaSummary', {
                checked: diagnostics.media.value.checked,
                problems: diagnostics.media.value.problems.length,
              })
            }}
          </p>
          <ul>
            <li v-for="item in diagnostics.media.value.problems" :key="item.id">
              <NuxtLink :to="`/admin/media?search=${item.id}&deleted=${item.deleted}`">{{ item.id }}</NuxtLink> ·
              {{ item.reason }}
            </li>
          </ul></template
        >
      </section>
      <section :aria-label="t('admin-system.maintenance.fullBackup.title')">
        <h2>{{ t('admin-system.maintenance.fullBackup.title') }}</h2>
        <p>{{ t('admin-system.maintenance.fullBackup.intro') }}</p>
        <p>{{ t('admin-system.maintenance.fullBackup.generateHint') }}</p>
        <pre><code>corepack pnpm --filter server-main run backup:full</code></pre>
        <p>{{ t('admin-system.maintenance.fullBackup.verifyHint') }}</p>
        <pre><code>corepack pnpm --filter server-main run backup:verify --directory &lt;{{ t('admin-system.maintenance.fullBackup.directory') }}&gt;
corepack pnpm --filter server-main run backup:restore --directory &lt;{{ t('admin-system.maintenance.fullBackup.directory') }}&gt;</code></pre>
        <p>{{ t('admin-system.maintenance.fullBackup.afterRestore') }}</p>
      </section>
      <section :aria-label="t('admin-system.maintenance.export.title')">
        <h2>{{ t('admin-system.maintenance.export.title') }}</h2>
        <p>{{ t('admin-system.maintenance.export.scope') }}</p>
        <p>{{ t('admin-system.maintenance.export.excluded') }}</p>
        <label
          ><input v-model="mediaIncluded" type="checkbox" :disabled="pending" />{{
            t('admin-system.maintenance.export.includeMedia')
          }}</label
        >
        <p>
          {{
            mediaIncluded
              ? t('admin-system.maintenance.export.withMedia')
              : t('admin-system.maintenance.export.withoutMedia')
          }}
        </p>
        <button type="button" :disabled="pending" @click="exportPackage">
          {{ t('admin-system.maintenance.export.download') }}
        </button>
      </section>
      <section :aria-label="t('admin-system.maintenance.import.choosePackage')">
        <h2>{{ t('admin-system.maintenance.import.title') }}</h2>
        <p>{{ t('admin-system.maintenance.import.formats') }}</p>
        <p>{{ t('admin-system.maintenance.import.guestbookNote') }}</p>
        <label class="maintenance__field"
          >{{ t('admin-system.maintenance.import.choosePackage')
          }}<input type="file" accept="application/json,.json" :disabled="pending" @change="chooseFile"
        /></label>
        <p v-if="file">
          {{
            t('admin-system.maintenance.import.selectedFile', { name: file.name, size: (file.size / 1024).toFixed(1) })
          }}
        </p>
        <label class="maintenance__field"
          >{{ t('admin-system.maintenance.import.strategy')
          }}<select v-model="strategy" :disabled="pending">
            <option value="skip">{{ t('admin-system.maintenance.import.strategySkip') }}</option>
            <option value="copy">{{ t('admin-system.maintenance.import.strategyCopy') }}</option>
          </select></label
        >
        <label
          ><input v-model="includeSettings" type="checkbox" :disabled="pending" />{{
            t('admin-system.maintenance.import.includeSettings')
          }}</label
        >
        <p>{{ t('admin-system.maintenance.import.duplicateRule') }}</p>
        <p>{{ t('admin-system.maintenance.import.linkRule') }}</p>
        <div class="maintenance__actions">
          <button type="button" :disabled="pending || !file" @click="preview">
            {{ t('admin-system.maintenance.import.preview') }}
          </button>
          <button v-if="requestId" type="button" :disabled="pending" @click="read(requestId)">
            {{ t('admin-system.maintenance.import.queryTicket') }}
          </button>
        </div>
      </section>
      <p v-if="pending" role="status">{{ t('admin-system.maintenance.processing') }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <section v-if="job" :aria-label="t('admin-system.maintenance.job.label')">
        <h2>
          {{
            job.completed
              ? t('admin-system.maintenance.job.resultTitle')
              : t('admin-system.maintenance.job.previewTitle')
          }}
        </h2>
        <p>
          {{
            t('admin-system.maintenance.job.ticketLine', {
              ticket: job.ticket,
              strategy: t(
                job.strategy === 'skip'
                  ? 'admin-system.maintenance.job.strategySkip'
                  : 'admin-system.maintenance.job.strategyCopy',
              ),
              settings: t(
                job.includeSettings
                  ? 'admin-system.maintenance.job.settingsIncluded'
                  : 'admin-system.maintenance.job.settingsKept',
              ),
            })
          }}
        </p>
        <p>
          {{
            t('admin-system.maintenance.job.planCore', {
              posts: job.plan.counts.posts,
              flashes: job.plan.counts.flashes,
              moments: job.plan.counts.moments ?? 0,
              comments: job.plan.counts.comments,
              skipped: job.plan.counts.skipped,
            })
          }}
        </p>
        <p>{{ t('admin-system.maintenance.job.planGuestbook', { count: job.plan.counts.guestbook ?? 0 }) }}</p>
        <p>{{ t('admin-system.maintenance.job.planGallery', { count: job.plan.counts.gallery ?? 0 }) }}</p>
        <p>{{ t('admin-system.maintenance.job.planProjects', { count: job.plan.counts.projects ?? 0 }) }}</p>
        <p>{{ t('admin-system.maintenance.job.planLinks', { count: job.plan.counts.links ?? 0 }) }}</p>
        <p>{{ t('admin-system.maintenance.job.planPrompts', { count: job.plan.counts.prompts ?? 0 }) }}</p>
        <p>{{ t('admin-system.maintenance.job.planSubscriptions', { count: job.plan.counts.subscriptions ?? 0 }) }}</p>
        <p>
          {{
            t('admin-system.maintenance.job.planMedia', { media: job.plan.counts.media, files: job.plan.counts.files })
          }}
        </p>
        <p>{{ t('admin-system.maintenance.job.relationsNote') }}</p>
        <p v-if="job.plan.omittedRelations" role="status">
          {{ t('admin-system.maintenance.job.omittedRelations', { count: job.plan.omittedRelations }) }}
        </p>
        <p v-if="job.error" role="alert">{{ job.error }}</p>
        <p v-if="job.expired">{{ t('admin-system.maintenance.job.expired') }}</p>
        <ul>
          <li v-for="issue in job.plan.errors" :key="issue">{{ issue }}</li>
        </ul>
        <details>
          <summary>{{ t('admin-system.maintenance.job.itemsSummary') }}</summary>
          <ul>
            <li v-for="post in job.plan.posts" :key="`post-${post.sourceId}`">
              {{ post.title }} · {{ post.reason
              }}{{ post.slug ? t('admin-system.maintenance.job.slugSuffix', { slug: post.slug }) : '' }}
            </li>
            <li v-for="flash in job.plan.flashes" :key="flash.sourceId">{{ flash.title }} · {{ flash.reason }}</li>
            <li v-for="moment in job.plan.moments ?? []" :key="`moment-${moment.sourceId}`">
              {{ moment.title }} · {{ moment.reason }}
            </li>
            <li v-for="message in job.plan.guestbook ?? []" :key="`guestbook-${message.sourceId}`">
              {{ message.title }} · {{ message.reason }}
            </li>
            <li v-for="photo in job.plan.gallery ?? []" :key="`gallery-${photo.sourceId}`">
              {{ photo.title }} · {{ photo.reason }}
            </li>
            <li v-for="project in job.plan.projects ?? []" :key="`project-${project.sourceId}`">
              {{ project.title }} · {{ project.reason }}
            </li>
            <li v-for="subscription in job.plan.subscriptions ?? []" :key="`subscription-${subscription.sourceId}`">
              {{
                t('admin-system.maintenance.job.subscriptionItem', {
                  title: subscription.title,
                  reason: subscription.reason,
                })
              }}
            </li>
            <li v-for="prompt in job.plan.prompts ?? []" :key="`prompt-${prompt.sourceId}`">
              {{ t('admin-system.maintenance.job.promptItem', { title: prompt.title, reason: prompt.reason }) }}
            </li>
            <li v-for="link in job.plan.links ?? []" :key="`link-${link.sourceId}`">
              {{ link.title }} · {{ link.reason }}
            </li>
          </ul>
        </details>
        <AdminSiteSettingsPreview
          v-if="job.settingsPreview && !job.completed"
          :value="job.settingsPreview"
          :label="t('admin-system.maintenance.job.settingsPreview')"
        />
        <section
          v-if="job.gallerySettingsPreview && !job.completed"
          :aria-label="t('admin-system.maintenance.job.gearPreview')"
        >
          <h3>{{ t('admin-system.maintenance.job.gearPreview') }}</h3>
          <GalleryGearCard :gear="job.gallerySettingsPreview.gear" />
        </section>
        <section
          v-if="job.linkSettingsPreview && !job.completed"
          :aria-label="t('admin-system.maintenance.job.linkRulesPreview')"
        >
          <LinkRules :rules="job.linkSettingsPreview.rules" />
        </section>
        <template v-if="job.result">
          <p role="status">
            {{
              t('admin-system.maintenance.job.resultCore', {
                posts: job.result.posts.length,
                flashes: job.result.flashes.length,
                moments: job.result.moments?.length ?? 0,
                comments: job.result.comments,
              })
            }}
          </p>
          <p>{{ t('admin-system.maintenance.job.resultGuestbook', { count: job.result.guestbook?.length ?? 0 }) }}</p>
          <p>{{ t('admin-system.maintenance.job.resultGallery', { count: job.result.gallery?.length ?? 0 }) }}</p>
          <p>{{ t('admin-system.maintenance.job.resultProjects', { count: job.result.projects?.length ?? 0 }) }}</p>
          <p>{{ t('admin-system.maintenance.job.resultPrompts', { count: job.result.prompts?.length ?? 0 }) }}</p>
          <p>
            {{
              t('admin-system.maintenance.job.resultSubscriptions', { count: job.result.subscriptions?.length ?? 0 })
            }}
          </p>
          <p>{{ t('admin-system.maintenance.job.resultLinks', { count: job.result.links?.length ?? 0 }) }}</p>
          <p v-if="job.result.relations">
            {{
              t('admin-system.maintenance.job.resultRelations', {
                applied: job.result.relations.applied,
                omitted: job.result.relations.omitted,
              })
            }}
          </p>
          <ul>
            <li v-for="post in job.result.posts" :key="post.id">
              <NuxtLink :to="`/admin/posts/${post.id}`">{{
                t('admin-system.maintenance.job.checkPost', { id: post.id })
              }}</NuxtLink
              >{{ t('admin-system.maintenance.job.postSource', { id: post.sourceId }) }}
            </li>
          </ul>
          <NuxtLink v-if="job.result.flashes.length" to="/admin/flashes?status=draft">{{
            t('admin-system.maintenance.job.checkFlashes')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.moments?.length" to="/admin/moments?status=draft">{{
            t('admin-system.maintenance.job.checkMoments')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.guestbook?.length" to="/admin/guestbook">{{
            t('admin-system.maintenance.job.checkGuestbook')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.gallery?.length" to="/admin/gallery?status=draft">{{
            t('admin-system.maintenance.job.checkGallery')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.projects?.length" to="/admin/projects?status=draft">{{
            t('admin-system.maintenance.job.checkProjects')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.subscriptions?.length" to="/admin/subscriptions?status=draft">{{
            t('admin-system.maintenance.job.checkSubscriptions')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.prompts?.length" to="/prompts?view=manage">{{
            t('admin-system.maintenance.job.checkPrompts')
          }}</NuxtLink>
          <NuxtLink v-if="job.result.links?.length" to="/admin/links?status=draft">{{
            t('admin-system.maintenance.job.checkLinks')
          }}</NuxtLink>
        </template>
        <template v-if="!job.completed && !job.expired">
          <p>
            {{
              t('admin-system.maintenance.job.expiresAt', { time: formatDateTime(job.expiresAt, { hour12: false }) })
            }}
          </p>
          <label class="maintenance__field"
            >{{ t('admin-system.maintenance.job.acknowledge', { phrase: t(IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY) })
            }}<input v-model="acknowledgement" :disabled="pending" autocomplete="off"
          /></label>
          <div class="maintenance__actions">
            <button
              type="button"
              :disabled="pending || !job.plan.ready || !importAcknowledgement(acknowledgement, t)"
              @click="execute"
            >
              {{ t('admin-system.maintenance.job.execute') }}
            </button>
            <button type="button" :disabled="pending" @click="repreview">
              {{ t('admin-system.maintenance.job.repreview') }}
            </button>
          </div>
        </template>
        <button type="button" :disabled="pending" @click="read()">
          {{ t('admin-system.maintenance.job.readResult') }}
        </button>
      </section>
      <section :aria-label="t('admin-system.maintenance.recent.title')">
        <h2>{{ t('admin-system.maintenance.recent.title') }}</h2>
        <p v-if="recentError" role="alert">
          {{ recentError }}
          <button type="button" @click="loadRecent">{{ t('admin-system.maintenance.recent.retry') }}</button>
        </p>
        <p v-else-if="!recent.length">{{ t('admin-system.maintenance.recent.empty') }}</p>
        <ul>
          <li v-for="item in recent" :key="item.ticket">
            <button type="button" :disabled="pending" @click="read(item.ticket)">
              {{ formatDateTime(item.createdAt, { hour12: false }) }} ·
              {{
                t(
                  item.completed
                    ? 'admin-system.maintenance.recent.completed'
                    : item.expired
                      ? 'admin-system.maintenance.recent.expired'
                      : 'admin-system.maintenance.recent.running',
                )
              }}
            </button>
          </li>
        </ul>
      </section>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { IMPORT_ACKNOWLEDGEMENT_PHRASE_KEY, importAcknowledgement } from '~/features/backup/types'
import { formatDateTime } from '~/utils/format'

definePageMeta({ layout: 'admin', key: '/admin/maintenance' })
const { t } = useI18n()
useSeoMeta({ title: () => t('admin-system.maintenance.title'), robots: 'noindex, nofollow' })
const {
  pending,
  error,
  mediaIncluded,
  file,
  strategy,
  includeSettings,
  requestId,
  job,
  acknowledgement,
  recent,
  recentError,
  exportPackage,
  choose,
  preview,
  read,
  repreview,
  execute,
  loadRecent,
} = useContentBackup()
const diagnostics = useMaintenanceDiagnostics()
function chooseFile(event: Event) {
  choose((event.target as HTMLInputElement).files?.[0] ?? null)
}
</script>
<style scoped>
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 0.75rem;
  background: var(--surface-2);
  border-radius: 0.5rem;
  font-size: 0.8rem;
}
.maintenance {
  min-width: 0;
  overflow-wrap: anywhere;
}
.maintenance__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-block: 0.5rem;
}
.maintenance__actions button {
  margin: 0;
}
.maintenance__field {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
}
.maintenance__field input,
.maintenance__field select {
  width: 100%;
  min-width: 0;
}
h1 {
  font-size: 1.6rem;
}
h2 {
  font-size: 1.2rem;
  margin-bottom: 0.75rem;
}
section {
  padding: 1rem;
  margin-block: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
label {
  display: block;
  margin-block: 0.8rem;
}
p {
  margin-block: 0.65rem;
  color: var(--text-muted);
}
input,
select,
button {
  max-width: 100%;
  padding: 0.6rem;
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
}
button {
  margin: 0.4rem 0.5rem 0.4rem 0;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
button:disabled {
  opacity: 0.5;
}
a {
  color: var(--accent);
}
ul {
  padding-left: 1.2rem;
}
details {
  margin-block: 1rem;
}
summary {
  cursor: var(--interaction-cursor, pointer);
}
@media (max-width: 760px) {
  .maintenance,
  .maintenance > section {
    padding: 0.75rem;
  }
}
</style>
