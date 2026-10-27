<!-- @file LinkApplicationForm.vue @description 公开友链申请表单，仅在博主开放申请时渲染；提交后展示申请编号，不承诺回信 -->
<template>
  <section class="link-application" :aria-labelledby="headingId">
    <h2 :id="headingId"><Icon name="lucide:send" size="18" />{{ $t('interaction.linkApplication.title') }}</h2>
    <p>{{ $t('interaction.linkApplication.intro') }}</p>
    <div v-if="requestId" class="link-application__done" role="status">
      <p>
        <Icon name="lucide:circle-check" size="16" aria-hidden="true" />{{
          $t('interaction.linkApplication.submitted')
        }}
      </p>
      <p>
        {{ $t('interaction.linkApplication.requestId') }}<code>{{ requestId }}</code>
      </p>
      <button type="button" @click="again">{{ $t('interaction.linkApplication.again') }}</button>
    </div>
    <form v-else @submit.prevent="submit">
      <CommonSubmissionTrap v-model="website" />
      <fieldset :disabled="!hydrated || submitting">
        <label
          >{{ $t('interaction.linkApplication.name')
          }}<input
            :value="draft.name"
            :maxlength="linkApplicationLimits.name"
            required
            @input="change({ name: ($event.target as HTMLInputElement).value })" /></label
        ><label
          >{{ $t('interaction.linkApplication.url')
          }}<input
            :value="draft.url"
            type="url"
            pattern="https?://.+"
            :maxlength="linkApplicationLimits.url"
            required
            placeholder="https://example.com"
            @input="change({ url: ($event.target as HTMLInputElement).value })" /></label
        ><label
          >{{ $t('interaction.linkApplication.description')
          }}<input
            :value="draft.description"
            :maxlength="linkApplicationLimits.description"
            @input="change({ description: ($event.target as HTMLInputElement).value })" /></label
        ><label
          >{{ $t('interaction.linkApplication.contact')
          }}<input
            :value="draft.contact"
            :maxlength="linkApplicationLimits.contact"
            autocomplete="email"
            :placeholder="$t('interaction.linkApplication.contactPlaceholder')"
            @input="change({ contact: ($event.target as HTMLInputElement).value })" /></label
        ><label class="link-application__wide"
          >{{ $t('interaction.linkApplication.message')
          }}<textarea
            :value="draft.message"
            rows="3"
            :maxlength="linkApplicationLimits.message"
            @input="change({ message: ($event.target as HTMLTextAreaElement).value })"
          />
        </label>
      </fieldset>
      <button type="submit" :disabled="!valid || submitting" :aria-busy="submitting">
        {{ submitting ? $t('interaction.linkApplication.submitting') : $t('interaction.linkApplication.submit') }}
      </button>
      <p v-if="error" role="alert">{{ error }}</p>
      <p class="link-application__privacy">{{ $t('interaction.linkApplication.privacy') }}</p>
    </form>
  </section>
</template>
<script setup lang="ts">
import { linkApplicationLimits } from '~/features/link/application'
const headingId = useId()
const { draft, website, submitting, error, requestId, valid, change, submit, again } = useLinkApplicationForm()
// 水合前输入只落在服务端渲染的 DOM 上，水合时会被空草稿覆盖；在此之前禁用输入，无 JavaScript 时同样不可提交。
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
</script>
<style scoped lang="scss">
.link-application {
  border: 1px solid var(--border);
  border-radius: $radius-card;
  background: var(--surface-2);
  padding: 1.25rem;
  margin-top: 1.5rem;
  overflow-wrap: anywhere;
}
h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
}
p {
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.7;
  margin-block: 0.75rem;
}
.link-application__done p {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-main);
}
code {
  font-size: 0.8125rem;
  user-select: all;
}
.link-application__privacy {
  font-size: 0.75rem;
  color: var(--text-soft);
}
fieldset {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  min-width: 0;
  padding: 0;
  border: 0;
  margin-bottom: 1rem;
  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.link-application__wide {
  @media (min-width: 640px) {
    grid-column: 1 / -1;
  }
}
label {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
input,
textarea,
button {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--surface-1);
}
input,
textarea {
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.18s;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
}
textarea {
  resize: vertical;
}
button {
  width: auto;
  padding-inline: 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: var(--interaction-cursor, pointer);

  &:not(:disabled):hover {
    border-color: var(--accent);
    color: var(--accent-text);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
button:disabled {
  opacity: 0.5;
  cursor: var(--interaction-cursor, not-allowed);
}
</style>
