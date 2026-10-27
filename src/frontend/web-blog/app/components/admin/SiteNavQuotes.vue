<!-- @file SiteNavQuotes.vue @description 站点每日一言编辑列表：逐条编辑、去重校验与按钮排序 -->
<template>
  <fieldset>
    <legend>{{ t('admin-system.siteNav.quotesLegend', { max: MAX_QUOTES }) }}</legend>
    <p>{{ t('admin-system.siteNav.quotesHint') }}</p>
    <p v-if="errors.quotes" role="alert">{{ errors.quotes }}</p>
    <ol class="site-nav-fields__list">
      <li
        v-for="(_quote, index) in value.quotes"
        :key="`${index}-${value.quotes.length}`"
        class="site-nav-fields__row"
        :data-row="`quote-${index}`"
      >
        <label
          >{{ t('admin-system.siteNav.quoteItem', { index: index + 1 })
          }}<input
            v-model="value.quotes[index]"
            :maxlength="MAX_QUOTE_LENGTH"
            required
            :aria-invalid="!!errors[`quote-${index}`]"
            :aria-describedby="errors[`quote-${index}`] ? errorId(`quote-${index}`) : undefined"
        /></label>
        <p v-if="errors[`quote-${index}`]" :id="errorId(`quote-${index}`)" class="site-nav-fields__error">
          {{ errors[`quote-${index}`] }}
        </p>
        <AdminSiteNavRowActions
          :index="index"
          :count="value.quotes.length"
          :name="quoteName(index)"
          @move="move(value.quotes, index, $event, t('admin-system.siteNav.quote'))"
          @remove="remove(value.quotes, index, quoteName(index))"
        />
      </li>
    </ol>
    <button type="button" :disabled="value.quotes.length >= MAX_QUOTES" @click="value.quotes.push('')">
      {{ t('admin-system.siteNav.addQuote') }}
    </button>
  </fieldset>
</template>

<script setup lang="ts">
import type { SiteSettingsData } from '~/features/site/settings'
import { MAX_QUOTES, MAX_QUOTE_LENGTH } from '~/features/site/footer'
import { useSiteNavRows } from '~/features/site/useSiteNavRows'

const props = defineProps<{ uid: string; errors: Record<string, string> }>()
const emit = defineEmits<{ announce: [message: string] }>()
const value = defineModel<SiteSettingsData>({ required: true })
const { t } = useI18n()
const errorId = (field: string) => `${props.uid}-${field}-error`
const { move, remove } = useSiteNavRows('quote', (message) => emit('announce', message))
const quoteName = (index: number) => t('admin-system.siteNav.quoteName', { index: index + 1 })
</script>

<style scoped lang="scss">
@use '~/assets/styles/site-nav-fields' as nav;

@include nav.fields;
</style>
