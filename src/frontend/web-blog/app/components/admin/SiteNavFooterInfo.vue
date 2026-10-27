<!-- @file SiteNavFooterInfo.vue @description 站点页脚信息：ICP 备案号与查询地址、版权文案及页脚效果预览 -->
<template>
  <fieldset>
    <legend>{{ t('admin-system.siteNav.icpLegend') }}</legend>
    <label
      >{{ t('admin-system.siteNav.icpNumber')
      }}<input
        v-model="value.icpNumber"
        :maxlength="SITE_EXTRA_LIMITS.icpNumber"
        :placeholder="t('admin-system.siteNav.icpNumberPlaceholder')"
        :aria-invalid="!!errors.icpNumber"
        :aria-describedby="errors.icpNumber ? errorId('icpNumber') : undefined"
    /></label>
    <p v-if="errors.icpNumber" :id="errorId('icpNumber')" class="site-nav-fields__error">{{ errors.icpNumber }}</p>
    <label
      >{{ t('admin-system.siteNav.icpUrl')
      }}<input
        v-model="value.icpUrl"
        type="url"
        inputmode="url"
        :maxlength="SITE_EXTRA_LIMITS.icpUrl"
        :placeholder="DEFAULT_ICP_URL"
        :aria-invalid="!!errors.icpUrl"
        :aria-describedby="[icpHintId, errors.icpUrl ? errorId('icpUrl') : ''].filter(Boolean).join(' ')"
    /></label>
    <p :id="icpHintId">{{ t('admin-system.siteNav.icpHint') }}</p>
    <p v-if="errors.icpUrl" :id="errorId('icpUrl')" class="site-nav-fields__error">{{ errors.icpUrl }}</p>
    <label
      >{{ t('admin-system.siteNav.copyright')
      }}<input
        v-model="value.copyright"
        :maxlength="SITE_EXTRA_LIMITS.copyright"
        :placeholder="`© {year} ${value.name || '{siteName}'}. All rights reserved.`"
        :aria-invalid="!!errors.copyright"
        :aria-describedby="[copyrightHintId, errors.copyright ? errorId('copyright') : ''].filter(Boolean).join(' ')"
    /></label>
    <p :id="copyrightHintId">
      {{
        t('admin-system.siteNav.copyrightHint', {
          format: formatCopyright('', year, value.name),
          year: '{year}',
          siteName: '{siteName}',
        })
      }}
    </p>
    <p v-if="errors.copyright" :id="errorId('copyright')" class="site-nav-fields__error">{{ errors.copyright }}</p>
    <p>
      {{ t('admin-system.siteNav.footerPreview', { text: formatCopyright(value.copyright, year, value.name) })
      }}<template v-if="value.icpNumber.trim()"> · {{ value.icpNumber.trim() }}</template>
    </p>
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { DEFAULT_ICP_URL, formatCopyright } from '~/features/site/footer'
import { SITE_EXTRA_LIMITS } from '~/features/site/extras'

const props = defineProps<{ uid: string; errors: Record<string, string> }>()
const value = defineModel<SiteSettingsData>({ required: true })
const { t } = useI18n()
const icpHintId = `${props.uid}-icp-hint`,
  copyrightHintId = `${props.uid}-copyright-hint`
const errorId = (field: string) => `${props.uid}-${field}-error`
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
