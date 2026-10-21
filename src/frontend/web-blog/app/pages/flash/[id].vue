<!--
  @file [id].vue
  @description 闪念单条详情页：独立 URL、OG 卡、上下条导航，展示博主公开闪念
  @author TixXin
  @since 2026-04-17
-->

<template>
  <CommonPageFrame class="main-inner flash-detail-page" header-key="flash-return">
    <template #header>
      <div class="main-content__header flash-detail-header">
        <h1 class="sr-only">{{ pageTitle }}</h1>
        <NuxtLink to="/flash" class="back-btn" :aria-label="$t('flash-moment.flashDetail.back')">
          <Icon name="lucide:arrow-left" size="16" />
          <span>{{ $t('flash-moment.flashDetail.back') }}</span>
        </NuxtLink>
      </div>
    </template>
    <template #default>
      <CommonCustomScrollbar class="flash-detail-body" viewport-class="flash-detail-viewport" primary>
        <div class="flash-detail-content">
          <CommonRequestFeedback
            v-if="loadError"
            :pending="detailResult.pending.value"
            :title="$t('flash-moment.flashDetail.loadFailed')"
            :description="$t('flash-moment.flashDetail.loadFailedDesc')"
            @retry="refreshNotes()"
          />
          <CommonStateBlock
            v-else-if="loadFinished && !note"
            icon="lucide:search-x"
            :title="$t('flash-moment.flashDetail.notFound')"
            :description="$t('flash-moment.flashDetail.notFoundDesc')"
          >
            <NuxtLink to="/flash" class="back-link">
              <Icon name="lucide:arrow-left" size="14" />
              {{ $t('flash-moment.flashDetail.back') }}
            </NuxtLink>
          </CommonStateBlock>

          <template v-else-if="note">
            <article class="flash-detail-card">
              <FlashNoteCard :note="note" read-only :interactive="false" />
            </article>

            <p class="flash-detail-hint">
              <Icon name="lucide:info" size="12" class="flash-detail-hint__icon" />
              <i18n-t keypath="flash-moment.flashDetail.readOnlyHint" tag="span" scope="global">
                <template #link>
                  <NuxtLink to="/flash" class="flash-detail-hint__link">
                    {{ $t('flash-moment.flashDetail.readOnlyHintLink') }}
                  </NuxtLink>
                </template>
              </i18n-t>
            </p>

            <FlashDetailNav :prev-note="prevNote" :next-note="nextNote" />
          </template>

          <div v-else class="flash-detail-loading">
            <Icon name="lucide:loader-2" size="20" class="flash-detail-loading__icon" />
            <span>{{ $t('flash-moment.flashDetail.loading') }}</span>
          </div>
        </div>
      </CommonCustomScrollbar>
    </template>
    <template #overlays> </template>
  </CommonPageFrame>
</template>

<script setup lang="ts">
import { useFlashDetail } from '~/features/flash/useFlashDetail'

definePageMeta({ rightSidebar: false })

const { pageTitle, note, prevNote, nextNote, loadError, loadFinished, detailResult, refreshNotes, assertReady } =
  useFlashDetail()

await detailResult
assertReady()
</script>

<style lang="scss" scoped>
.flash-detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.flash-detail-header {
  display: flex;
  align-items: center;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  color: var(--text-soft);
  font-size: 0.875rem;
  border-radius: $radius-sm;
  text-decoration: none;
  transition: $transition-colors;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  &:hover {
    color: var(--text-main);
    background: var(--surface-2);
  }
}

.flash-detail-body {
  flex: 1;
  min-height: 0;
}

:deep(.flash-detail-viewport) {
  padding: 1.5rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 2rem;
  }
}

.flash-detail-content {
  max-width: 720px;
  margin: 0 auto;
}

.flash-detail-card {
  margin-bottom: 0.5rem;
}

.flash-detail-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0 0 1.25rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-soft);
  background: var(--surface-2);
  border-radius: $radius-sm;
}

.flash-detail-hint__icon {
  flex-shrink: 0;
}

.flash-detail-hint__link {
  margin-left: 0.25rem;
  color: var(--accent-text);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.flash-detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 0;
  color: var(--text-faint);
  font-size: 0.875rem;
}

.flash-detail-loading__icon {
  animation: flash-spin 1s linear infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes flash-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 1rem;
  color: var(--accent-text);
  text-decoration: none;
  font-size: 0.875rem;

  &:hover {
    text-decoration: underline;
  }
}
</style>
