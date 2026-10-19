<!-- @file Fields.vue @description 订阅管理与访客本地共享展示字段，媒体与公开设置仅向管理模式开放 -->
<template>
  <fieldset class="subscription-ui" :disabled="disabled">
    <div class="subscription-grid">
      <label
        >{{ $t('misc.subscription.fields.name')
        }}<input
          :value="value.name"
          required
          maxlength="160"
          :aria-label="$t('misc.subscription.fields.name')"
          data-subscription-field="name"
          @input="change('name', input($event))"
      /></label>
      <label
        >{{ $t('misc.subscription.fields.platform')
        }}<input
          :value="value.platform ?? ''"
          maxlength="160"
          :aria-label="$t('misc.subscription.fields.platform')"
          @input="change('platform', input($event) || null)"
      /></label>
    </div>
    <label
      >{{ managed ? $t('misc.subscription.fields.publicDescription') : $t('misc.subscription.fields.description')
      }}<textarea
        :value="value.description"
        maxlength="5000"
        rows="3"
        :aria-label="$t('misc.subscription.fields.descriptionLabel')"
        @input="change('description', input($event))"
      />
    </label>
    <label
      >{{ $t('misc.subscription.fields.url')
      }}<input
        :value="value.url ?? ''"
        type="url"
        pattern="https?://.+"
        maxlength="2048"
        placeholder="https://"
        :aria-label="$t('misc.subscription.fields.url')"
        @input="change('url', input($event) || null)"
    /></label>
    <div class="subscription-grid">
      <label
        >{{ $t('misc.subscription.fields.category')
        }}<select
          :value="value.category"
          :aria-label="$t('misc.subscription.fields.categoryLabel')"
          @change="change('category', input($event) as SubscriptionForm['category'])"
        >
          <option v-for="key in categoryKeys" :key="key" :value="key">{{ categoryLabel(key, t) }}</option>
        </select></label
      >
      <label
        >{{ $t('misc.subscription.fields.currency')
        }}<select
          :value="value.currency"
          :aria-label="$t('misc.subscription.fields.currencyLabel')"
          @change="change('currency', input($event) as SubscriptionForm['currency'])"
        >
          <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
        </select></label
      >
      <label
        >{{ $t('misc.subscription.fields.amount')
        }}<input
          :value="value.amountInput"
          inputmode="decimal"
          required
          maxlength="40"
          :aria-label="$t('misc.subscription.fields.amountLabel')"
          @input="change('amountInput', input($event))"
      /></label>
      <label
        >{{ $t('misc.subscription.fields.cycle')
        }}<select
          :value="value.billingCycle"
          :aria-label="$t('misc.subscription.fields.cycle')"
          @change="change('billingCycle', input($event) as SubscriptionForm['billingCycle'])"
        >
          <option v-for="key in cycleKeys" :key="key" :value="key">{{ cycleLabel(key, t) }}</option>
        </select></label
      >
    </div>
    <p class="subscription-note">{{ $t('misc.subscription.fields.amountNote') }}</p>
    <div class="subscription-grid">
      <label
        >{{ $t('misc.subscription.fields.status')
        }}<select
          :value="value.subscriptionStatus"
          :aria-label="$t('misc.subscription.fields.status')"
          @change="change('subscriptionStatus', input($event) as SubscriptionForm['subscriptionStatus'])"
        >
          <option v-for="key in stateKeys" :key="key" :value="key">{{ stateLabel(key, t) }}</option>
        </select></label
      >
      <label
        >{{ $t('misc.subscription.fields.startDate')
        }}<input
          :value="value.startDate ?? ''"
          type="date"
          :aria-label="$t('misc.subscription.fields.startDate')"
          @input="change('startDate', input($event) || null)"
      /></label>
      <label
        >{{ $t('misc.subscription.fields.nextBillingDate')
        }}<input
          :value="value.nextBillingDate ?? ''"
          type="date"
          :min="value.startDate ?? undefined"
          :aria-label="$t('misc.subscription.fields.nextBillingDate')"
          @input="change('nextBillingDate', input($event) || null)"
      /></label>
    </div>
    <p class="subscription-note">{{ $t('misc.subscription.fields.dateNote') }}</p>
    <label v-if="changed"
      >{{ $t('misc.subscription.fields.priceChangeReason')
      }}<textarea
        :value="value.priceChangeReason ?? ''"
        rows="2"
        maxlength="500"
        :aria-label="$t('misc.subscription.fields.priceChangeReason')"
        :placeholder="$t('misc.subscription.fields.priceChangeReasonPlaceholder')"
        @input="change('priceChangeReason', input($event))"
      />
    </label>
    <p v-if="changed" class="subscription-note">{{ $t('misc.subscription.fields.priceChangeNote') }}</p>
    <label
      >{{ managed ? $t('misc.subscription.fields.managedNotes') : $t('misc.subscription.fields.localNotes')
      }}<textarea
        :value="value.notes"
        maxlength="5000"
        rows="3"
        :aria-label="$t('misc.subscription.fields.notesLabel')"
        @input="change('notes', input($event))"
      />
    </label>
    <template v-if="managed">
      <section :aria-label="$t('misc.subscription.fields.icon')" class="subscription-stack">
        <div class="subscription-row">
          <h3>{{ $t('misc.subscription.fields.icon') }}</h3>
          <button type="button" @click="mediaOpen = true">{{ $t('misc.subscription.fields.pickIcon') }}</button
          ><button v-if="value.iconMediaId" type="button" @click="change('iconMediaId', null)">
            {{ $t('misc.subscription.fields.removeIcon') }}</button
          ><button type="button" :disabled="!value.url || fetchingIcon" @click="$emit('favicon')">
            {{ fetchingIcon ? $t('misc.subscription.fields.fetchingIcon') : $t('misc.subscription.fields.fetchIcon') }}
          </button>
        </div>
        <img
          v-if="value.iconMediaId"
          class="subscription-icon-preview"
          :src="`/api/v1/media/${value.iconMediaId}.webp`"
          :alt="$t('misc.subscription.fields.manualIconAlt')"
        />
        <img
          v-else-if="faviconUrl"
          class="subscription-icon-preview"
          :src="faviconUrl"
          :alt="$t('misc.subscription.fields.faviconAlt')"
        />
        <p class="subscription-note">{{ $t('misc.subscription.fields.iconNote') }}</p>
        <p v-if="iconMessage" role="status">{{ iconMessage }}</p>
      </section>
      <div class="subscription-grid">
        <label
          >{{ $t('misc.subscription.fields.publication')
          }}<select
            :value="value.status"
            :aria-label="$t('misc.subscription.fields.publicationLabel')"
            @change="change('status', input($event) as SubscriptionForm['status'])"
          >
            <option v-for="key in publicationKeys" :key="key" :value="key">{{ publicationLabel(key, t) }}</option>
          </select></label
        >
        <label
          >{{ $t('misc.subscription.fields.sortOrder')
          }}<input
            :value="value.sortOrder"
            type="number"
            min="-1000000"
            max="1000000"
            step="1"
            :aria-label="$t('misc.subscription.fields.sortOrderLabel')"
            @input="change('sortOrder', Number(input($event)))"
        /></label>
      </div>
      <ClientOnly><AdminMediaPicker v-model:open="mediaOpen" @selected="selectMedia" /></ClientOnly>
    </template>
  </fieldset>
</template>
<script setup lang="ts">
import {
  categoryLabels,
  cycleLabels,
  stateLabels,
  publicationLabels,
  currencyOptions,
} from '~/features/subscription/types'
import type {
  SubscriptionCategory,
  SubscriptionCycle,
  SubscriptionForm,
  SubscriptionPublication,
  SubscriptionState,
} from '~/features/subscription/types'
import { categoryLabel, cycleLabel, publicationLabel, stateLabel } from '~/features/subscription/labels'
import type { MediaAsset } from '~/features/media/types'
defineProps<{
  value: SubscriptionForm
  managed?: boolean
  changed?: boolean
  disabled?: boolean
  fetchingIcon?: boolean
  faviconUrl?: string | null
  iconMessage?: string
}>()
const emit = defineEmits<{ change: [value: Partial<SubscriptionForm>]; favicon: [] }>()
const { t } = useI18n()
const categoryKeys = Object.keys(categoryLabels) as SubscriptionCategory[],
  cycleKeys = Object.keys(cycleLabels) as SubscriptionCycle[],
  stateKeys = Object.keys(stateLabels) as SubscriptionState[],
  publicationKeys = Object.keys(publicationLabels) as SubscriptionPublication[]
const mediaOpen = ref(false)
const input = (event: Event) => (event.target as HTMLInputElement).value
function change<K extends keyof SubscriptionForm>(key: K, value: SubscriptionForm[K]) {
  emit('change', { [key]: value })
}
function selectMedia(asset: MediaAsset) {
  change('iconMediaId', asset.id)
}
</script>
<style scoped lang="scss">
@use '~/features/subscription/styles';
.subscription-icon-preview {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 0.5rem;
}
</style>
