<!--
  @file SiteProfileFields.vue
  @description 站点设置的公开资料：站名、简介、博主身份、头像、在线状态（含到期时间）、站点时区与建站日期；头像可从媒体库选择
-->
<template>
  <fieldset class="admin-site__grid" :disabled="disabled">
    <legend>{{ t('admin-system.site.page.profileLegend') }}</legend>
    <label>{{ t('admin-system.site.editor.fields.name') }}<input v-model="draft.name" maxlength="80" required /></label>
    <label
      >{{ t('admin-system.site.editor.fields.description')
      }}<textarea v-model="draft.description" maxlength="300" rows="3" />
    </label>
    <label
      >{{ t('admin-system.site.editor.fields.ownerName') }}<input v-model="draft.ownerName" maxlength="80" required
    /></label>
    <label
      >{{ t('admin-system.site.editor.fields.ownerTitle') }}<input v-model="draft.ownerTitle" maxlength="200"
    /></label>
    <label>{{ t('admin-system.site.editor.fields.avatar') }}<input v-model="draft.avatar" maxlength="1000" /></label>
    <button type="button" class="admin-site__pick" @click="emit('pick')">
      <Icon name="lucide:image" aria-hidden="true" />{{ t('admin-system.site.page.pickAvatar') }}
    </button>
    <label
      >{{ t('admin-system.site.editor.fields.avatarAlt') }}<input v-model="draft.avatarAlt" maxlength="300"
    /></label>
    <label
      >{{ t('admin-system.site.editor.fields.presenceLabel')
      }}<input
        v-model="draft.presenceLabel"
        maxlength="20"
        :placeholder="t('admin-system.site.page.presenceLabelPlaceholder')"
    /></label>
    <label
      >{{ t('admin-system.site.editor.fields.presenceSignature')
      }}<input
        v-model="draft.presenceSignature"
        maxlength="60"
        :placeholder="t('admin-system.site.page.presenceSignaturePlaceholder')"
    /></label>
    <label
      >{{ t('admin-system.site.editor.fields.presenceStatus')
      }}<select v-model="draft.presenceStatus">
        <option v-for="option in presenceStatusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select></label
    >
    <label
      >{{ t('admin-system.site.editor.fields.presenceExpiresAt')
      }}<input v-model="expiresLocal" type="datetime-local" :aria-describedby="expiresHintId" />
      <small :id="expiresHintId" class="admin-site__hint">{{ t('admin-system.site.page.presenceExpiresHint') }}</small>
      <button v-if="draft.presenceExpiresAt" type="button" class="admin-site__pick" @click="expiresLocal = ''">
        {{ t('admin-system.site.page.presenceExpiresClear') }}
      </button></label
    >
    <label
      >{{ t('admin-system.site.editor.fields.timeZone')
      }}<select v-model="draft.timeZone" :aria-describedby="timeZoneHintId">
        <option v-for="zone in timeZoneOptions" :key="zone" :value="zone">{{ zone }}</option>
      </select>
      <small :id="timeZoneHintId" class="admin-site__hint">{{ t('admin-system.site.page.timeZoneHint') }}</small></label
    >
    <label
      >{{ t('admin-system.site.editor.fields.launchedAt')
      }}<CommonDatePicker
        v-model="draft.launchedAt"
        :placeholder="t('admin-system.site.page.launchedAtPlaceholder')"
        clearable
    /></label>
  </fieldset>
</template>
<script setup lang="ts">
import { presenceStatusOptions, type SiteSettingsData } from '~/features/site/settings'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '~/features/presence/manualExpiry'
import { siteTimeZoneOptions } from '~/features/site/timeZone'

defineProps<{ disabled: boolean }>()
const draft = defineModel<SiteSettingsData>({ required: true })
const emit = defineEmits<{ pick: [] }>()
const { t } = useI18n()
const expiresHintId = useId()
const timeZoneHintId = useId()
const timeZoneOptions = computed(() => siteTimeZoneOptions(draft.value.timeZone))
// 输入框按本机时区显示与编辑，保存为 UTC 的 ISO 字符串；清空表示长期有效。
const expiresLocal = computed({
  get: () => toLocalDateTimeInput(draft.value.presenceExpiresAt ?? ''),
  set: (value: string) => (draft.value.presenceExpiresAt = fromLocalDateTimeInput(value)),
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/admin-site' as site;

@include site.page;
</style>
