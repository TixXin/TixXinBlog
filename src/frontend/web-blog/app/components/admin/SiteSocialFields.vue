<!--
  @file SiteSocialFields.vue
  @description 站点设置的社交链接（最多 8 个）：名称、地址与 Lucide 图标，可增删；宽屏一行一条，窄屏纵向堆叠
-->
<template>
  <fieldset :disabled="disabled">
    <legend>{{ t('admin-system.site.page.socialsLegend', { max: 8 }) }}</legend>
    <div v-for="(link, index) in socials" :key="index" class="admin-site__social">
      <label>{{ t('admin-system.site.page.socialLabel') }}<input v-model="link.label" maxlength="40" required /></label>
      <label
        >{{ t('admin-system.site.page.socialHref')
        }}<input
          v-model="link.href"
          maxlength="1000"
          :placeholder="t('admin-system.site.page.socialHrefPlaceholder')"
          required
      /></label>
      <label
        >{{ t('admin-system.site.page.socialIcon')
        }}<select v-model="link.icon">
          <option v-for="icon in siteSocialIcons" :key="icon" :value="icon">
            {{ icon.replace('lucide:', '') }}
          </option>
        </select></label
      >
      <button
        type="button"
        class="admin-btn admin-btn--ghost"
        :aria-label="t('admin-system.site.page.removeSocial', { index: index + 1 })"
        @click="socials.splice(index, 1)"
      >
        {{ t('admin-system.site.page.remove') }}
      </button>
    </div>
    <button
      type="button"
      :disabled="socials.length >= 8"
      @click="socials.push({ label: '', href: '', icon: 'lucide:globe' })"
    >
      {{ t('admin-system.site.page.addSocial') }}
    </button>
  </fieldset>
</template>

<script setup lang="ts">
import { siteSocialIcons } from '~/features/site/settings'

defineProps<{ disabled: boolean }>()
const socials = defineModel<{ icon: string; label: string; href: string }[]>({ required: true })
const { t } = useI18n()
</script>

<style scoped lang="scss">
label {
  display: grid;
  gap: 0.375rem;
  margin: 0 0 1rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
}
.admin-site__social {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.75rem;

  button {
    margin-bottom: 1rem;
  }
}
.admin-site__social + button,
fieldset > button {
  margin-bottom: 1rem;
}
@media (max-width: 760px) {
  .admin-site__social {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-soft);
  }
}
</style>
