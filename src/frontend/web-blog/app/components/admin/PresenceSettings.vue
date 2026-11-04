<!--
  @file PresenceSettings.vue
  @description 后台“实时在线与访问统计”开关：切换即保存（独立于站点资料版本），显示博主最后在线时间
-->

<template>
  <fieldset class="presence-settings" :disabled="pending || !loaded">
    <legend>{{ t('admin-system.presence.title') }}</legend>
    <p class="presence-settings__hint">{{ t('admin-system.presence.hint') }}</p>
    <label class="presence-settings__toggle">
      <input
        type="checkbox"
        :checked="settings.autoPresence"
        @change="save({ autoPresence: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('admin-system.presence.autoPresence') }}
    </label>
    <label class="presence-settings__toggle">
      <input
        type="checkbox"
        :checked="settings.publicStats"
        @change="save({ publicStats: ($event.target as HTMLInputElement).checked })"
      />
      {{ t('admin-system.presence.publicStats') }}
    </label>
    <p class="presence-settings__meta">
      {{
        settings.ownerLastSeenAt
          ? t('admin-system.presence.lastSeen', { time: formatDateTime(settings.ownerLastSeenAt, { hour12: false }) })
          : t('admin-system.presence.neverSeen')
      }}
    </p>
    <p v-if="error" class="presence-settings__error" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script setup lang="ts">
import { formatDateTime } from '~/utils/format'

interface PresenceSettingsData {
  autoPresence: boolean
  publicStats: boolean
  ownerLastSeenAt: string | null
}

const { t } = useI18n()
const adminApi = useAdminApi()
const settings = ref<PresenceSettingsData>({ autoPresence: true, publicStats: true, ownerLastSeenAt: null })
const loaded = ref(false)
const pending = ref(false)
const error = ref('')

async function load() {
  try {
    settings.value = await adminApi<PresenceSettingsData>('/admin/presence')
    loaded.value = true
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('admin-system.presence.loadFailed')
  }
}

async function save(patch: Partial<Pick<PresenceSettingsData, 'autoPresence' | 'publicStats'>>) {
  const previous = settings.value
  settings.value = { ...previous, ...patch }
  pending.value = true
  try {
    settings.value = await adminApi<PresenceSettingsData>('/admin/presence', { method: 'PATCH', body: patch })
    error.value = ''
  } catch (cause) {
    // 保存失败时恢复原值，不让界面显示未生效的开关状态。
    settings.value = previous
    error.value = cause instanceof Error ? cause.message : t('admin-system.presence.saveFailed')
  } finally {
    pending.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.presence-settings {
  display: grid;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}

.presence-settings__hint,
.presence-settings__meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.presence-settings__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.presence-settings__error {
  margin: 0;
  color: var(--danger-text);
}
</style>
