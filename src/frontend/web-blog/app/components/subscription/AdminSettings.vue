<!-- @file AdminSettings.vue @description 后台订阅设置：手填参考汇率（公开页标注“估算”的折合金额）与私密续费日历链接 -->
<template>
  <section class="subscription-panel subscription-stack" :aria-label="$t('admin-media.subscriptionSettings.title')">
    <details>
      <summary>
        <strong>{{ $t('admin-media.subscriptionSettings.title') }}</strong>
        <span class="subscription-note">{{ summary }}</span>
      </summary>
      <CommonRequestFeedback
        v-if="loading || loadError"
        :pending="loading"
        :title="loadError || $t('admin-media.subscriptionSettings.loading')"
        @retry="load"
      />
      <form v-else-if="form" class="subscription-stack" @submit.prevent="saveRates">
        <h3>{{ $t('admin-media.subscriptionSettings.ratesTitle') }}</h3>
        <p class="subscription-note">{{ $t('admin-media.subscriptionSettings.ratesNote') }}</p>
        <div class="subscription-grid">
          <label
            >{{ $t('admin-media.subscriptionSettings.base')
            }}<select v-model="form.baseCurrency" :aria-label="$t('admin-media.subscriptionSettings.base')">
              <option :value="null">{{ $t('admin-media.subscriptionSettings.disabled') }}</option>
              <option v-for="code in currencyOptions" :key="code" :value="code">{{ code }}</option>
            </select></label
          >
          <label v-if="form.baseCurrency"
            >{{ $t('admin-media.subscriptionSettings.updatedAt')
            }}<CommonDatePicker
              :model-value="form.ratesUpdatedAt ?? ''"
              :aria-label="$t('admin-media.subscriptionSettings.updatedAt')"
              clearable
              @update:model-value="form.ratesUpdatedAt = $event || null"
          /></label>
        </div>
        <div v-if="form.baseCurrency" class="subscription-grid">
          <label v-for="code in otherCurrencies" :key="code"
            >{{ $t('admin-media.subscriptionSettings.rateFor', { code, base: form.baseCurrency })
            }}<input
              v-model.trim="form.rates[code]"
              inputmode="decimal"
              maxlength="16"
              :placeholder="$t('admin-media.subscriptionSettings.ratePlaceholder')"
          /></label>
        </div>
        <div class="subscription-row">
          <button type="submit" :disabled="saving">{{ $t('admin-media.subscriptionSettings.save') }}</button>
        </div>
      </form>
      <section
        v-if="form"
        class="subscription-stack"
        :aria-label="$t('admin-media.subscriptionSettings.calendarTitle')"
      >
        <h3>{{ $t('admin-media.subscriptionSettings.calendarTitle') }}</h3>
        <p class="subscription-note">{{ $t('admin-media.subscriptionSettings.calendarNote') }}</p>
        <p>
          {{
            calendarEnabled
              ? $t('admin-media.subscriptionSettings.calendarOn')
              : $t('admin-media.subscriptionSettings.calendarOff')
          }}
        </p>
        <div v-if="calendarUrl" class="subscription-stack">
          <p class="subscription-note">{{ $t('admin-media.subscriptionSettings.calendarOnce') }}</p>
          <input :value="calendarUrl" readonly :aria-label="$t('admin-media.subscriptionSettings.calendarUrl')" />
          <div class="subscription-row">
            <button type="button" @click="copy">{{ $t('admin-media.subscriptionSettings.copy') }}</button>
            <a :href="webcalUrl">{{ $t('admin-media.subscriptionSettings.subscribe') }}</a>
          </div>
        </div>
        <div class="subscription-row">
          <button type="button" :disabled="saving" @click="rotate">
            {{
              calendarEnabled
                ? $t('admin-media.subscriptionSettings.rotate')
                : $t('admin-media.subscriptionSettings.enable')
            }}</button
          ><button v-if="calendarEnabled" type="button" :disabled="saving" @click="disable">
            {{ $t('admin-media.subscriptionSettings.disable') }}
          </button>
        </div>
      </section>
      <p v-if="message" role="status">{{ message }}</p>
    </details>
  </section>
</template>
<script setup lang="ts">
import { useSubscriptionSettingsForm } from '~/features/subscription/useSubscriptionSettingsForm'
import { currencyOptions } from '~/features/subscription/types'

const {
  form,
  loading,
  loadError,
  saving,
  message,
  summary,
  otherCurrencies,
  calendarEnabled,
  calendarUrl,
  webcalUrl,
  load,
  saveRates,
  rotate,
  disable,
  copy,
} = useSubscriptionSettingsForm()
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem;
  cursor: pointer;
}
h3 {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}
</style>
