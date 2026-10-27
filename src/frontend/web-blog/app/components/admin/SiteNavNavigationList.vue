<!-- @file SiteNavNavigationList.vue @description 站点导航编辑列表：内置模块显隐、外链导航的增删与按钮排序 -->
<template>
  <fieldset>
    <legend>{{ t('admin-system.siteNav.navLegend') }}</legend>
    <p v-if="errors.navigation" :id="navigationId" role="alert">{{ errors.navigation }}</p>
    <ol class="site-nav-fields__list">
      <li
        v-for="(entry, index) in value.navigation"
        :key="itemKey(entry)"
        class="site-nav-fields__row"
        :data-row="`nav-${index}`"
      >
        <template v-if="entry.type === 'route'">
          <label class="site-nav-fields__toggle">
            <input
              v-model="entry.visible"
              type="checkbox"
              :disabled="entry.key === 'home'"
              :aria-describedby="entry.key === 'home' ? hintId : undefined"
            />
            <Icon :name="navRouteCatalog[entry.key].icon" aria-hidden="true" />
            {{ t('admin-system.siteNav.showRoute', { label: navRouteCatalog[entry.key].label })
            }}<span class="site-nav-fields__path">{{ navRouteCatalog[entry.key].to }}</span>
          </label>
        </template>
        <template v-else>
          <label
            >{{ t('admin-system.siteNav.externalLabel')
            }}<input
              v-model="entry.label"
              :maxlength="SITE_EXTRA_LIMITS.navLabel"
              required
              :aria-invalid="!!errors[`nav-${index}-label`]"
              :aria-describedby="errors[`nav-${index}-label`] ? errorId(`nav-${index}-label`) : undefined"
          /></label>
          <p v-if="errors[`nav-${index}-label`]" :id="errorId(`nav-${index}-label`)" class="site-nav-fields__error">
            {{ errors[`nav-${index}-label`] }}
          </p>
          <label
            >{{ t('admin-system.siteNav.externalUrl')
            }}<input
              v-model="entry.url"
              type="url"
              inputmode="url"
              :maxlength="SITE_EXTRA_LIMITS.url"
              placeholder="https://"
              required
              :aria-invalid="!!errors[`nav-${index}-url`]"
              :aria-describedby="errors[`nav-${index}-url`] ? errorId(`nav-${index}-url`) : undefined"
          /></label>
          <p v-if="errors[`nav-${index}-url`]" :id="errorId(`nav-${index}-url`)" class="site-nav-fields__error">
            {{ errors[`nav-${index}-url`] }}
          </p>
          <label class="site-nav-fields__toggle"
            ><input v-model="entry.newTab" type="checkbox" />{{ t('admin-system.siteNav.newTab') }}</label
          >
          <label class="site-nav-fields__toggle"
            ><input v-model="entry.visible" type="checkbox" />{{ t('admin-system.siteNav.showExternal') }}</label
          >
        </template>
        <AdminSiteNavRowActions
          :index="index"
          :count="value.navigation.length"
          :name="navName(entry)"
          :removable="entry.type === 'external'"
          @move="move(value.navigation, index, $event, navName(entry))"
          @remove="remove(value.navigation, index, navName(entry))"
        />
      </li>
    </ol>
    <button
      type="button"
      :disabled="externalCount >= MAX_EXTERNAL_NAV"
      @click="value.navigation.push({ type: 'external', label: '', url: '', newTab: true, visible: true })"
    >
      {{ t('admin-system.siteNav.addExternal', { count: externalCount, max: MAX_EXTERNAL_NAV }) }}
    </button>
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import type { SiteNavEntry } from '~/features/nav/types'
import { MAX_EXTERNAL_NAV, navRouteCatalog } from '~/features/nav/routes'
import { SITE_EXTRA_LIMITS } from '~/features/site/extras'
import { useSiteNavRows } from '~/features/site/useSiteNavRows'

const props = defineProps<{ uid: string; errors: Record<string, string> }>()
const emit = defineEmits<{ announce: [message: string] }>()
const value = defineModel<SiteSettingsData>({ required: true })
const { t } = useI18n()
const hintId = `${props.uid}-hint`,
  navigationId = `${props.uid}-navigation`
const errorId = (field: string) => `${props.uid}-${field}-error`
const externalCount = computed(() => value.value.navigation.filter((entry) => entry.type === 'external').length)
const { itemKey, move, remove } = useSiteNavRows('nav', (message) => emit('announce', message))
function navName(entry: SiteNavEntry) {
  return entry.type === 'route'
    ? t('admin-system.siteNav.routeName', { label: navRouteCatalog[entry.key].label })
    : t('admin-system.siteNav.externalName', { label: entry.label || '' })
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
