<!-- @file SiteNavFooterLinks.vue @description 站点页脚链接编辑列表：站内路径或 http(s) 地址，按钮排序，数量有上限 -->
<template>
  <fieldset>
    <legend>{{ t('admin-system.siteNav.footerLegend', { max: MAX_FOOTER_LINKS }) }}</legend>
    <p v-if="errors.footerLinks" role="alert">{{ errors.footerLinks }}</p>
    <p v-if="!value.footerLinks.length">{{ t('admin-system.siteNav.footerEmpty') }}</p>
    <ol class="site-nav-fields__list">
      <li
        v-for="(link, index) in value.footerLinks"
        :key="itemKey(link)"
        class="site-nav-fields__row"
        :data-row="`footer-${index}`"
      >
        <label
          >{{ t('admin-system.siteNav.linkLabel')
          }}<input
            v-model="link.label"
            :maxlength="SITE_EXTRA_LIMITS.footerLabel"
            required
            :aria-invalid="!!errors[`footer-${index}-label`]"
            :aria-describedby="errors[`footer-${index}-label`] ? errorId(`footer-${index}-label`) : undefined"
        /></label>
        <p v-if="errors[`footer-${index}-label`]" :id="errorId(`footer-${index}-label`)" class="site-nav-fields__error">
          {{ errors[`footer-${index}-label`] }}
        </p>
        <label
          >{{ t('admin-system.siteNav.linkUrl')
          }}<input
            v-model="link.url"
            :maxlength="SITE_EXTRA_LIMITS.url"
            :placeholder="t('admin-system.siteNav.linkUrlPlaceholder')"
            required
            :aria-invalid="!!errors[`footer-${index}-url`]"
            :aria-describedby="
              [footerHintId, errors[`footer-${index}-url`] ? errorId(`footer-${index}-url`) : '']
                .filter(Boolean)
                .join(' ')
            "
        /></label>
        <p v-if="errors[`footer-${index}-url`]" :id="errorId(`footer-${index}-url`)" class="site-nav-fields__error">
          {{ errors[`footer-${index}-url`] }}
        </p>
        <label class="site-nav-fields__toggle"
          ><input v-model="link.newTab" type="checkbox" />{{ t('admin-system.siteNav.newTab') }}</label
        >
        <AdminSiteNavRowActions
          :index="index"
          :count="value.footerLinks.length"
          :name="footerName(link.label, index)"
          @move="move(value.footerLinks, index, $event, footerName(link.label, index))"
          @remove="remove(value.footerLinks, index, footerName(link.label, index))"
        />
      </li>
    </ol>
    <p :id="footerHintId">{{ t('admin-system.siteNav.footerHint') }}</p>
    <button
      type="button"
      :disabled="value.footerLinks.length >= MAX_FOOTER_LINKS"
      @click="value.footerLinks.push({ label: '', url: '', newTab: false })"
    >
      {{ t('admin-system.siteNav.addFooter') }}
    </button>
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { MAX_FOOTER_LINKS } from '~/features/site/footer'
import { SITE_EXTRA_LIMITS } from '~/features/site/extras'
import { useSiteNavRows } from '~/features/site/useSiteNavRows'

const props = defineProps<{ uid: string; errors: Record<string, string> }>()
const emit = defineEmits<{ announce: [message: string] }>()
const value = defineModel<SiteSettingsData>({ required: true })
const { t } = useI18n()
const footerHintId = `${props.uid}-footer-hint`
const errorId = (field: string) => `${props.uid}-${field}-error`
const { itemKey, move, remove } = useSiteNavRows('footer', (message) => emit('announce', message))
const footerName = (label: string, index: number) => t('admin-system.siteNav.footerName', { label: label || index + 1 })
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
