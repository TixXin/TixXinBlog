<!--
  @file flash.vue
  @description 闪念主页：编辑器 + 笔记流；右栏 AI 搜索入口、标签云、统计
  @author TixXin
  @since 2026-04-11
-->

<template>
  <div class="main-inner flash-page">
    <div class="main-content__header">
      <div class="flash-page__title">
        <Icon name="lucide:zap" size="20" />
        <h1>闪念</h1>
        <span class="flash-page__sub">记录稍纵即逝的灵感</span>
      </div>
    </div>

    <CommonCustomScrollbar class="flash-page__body" viewport-class="flash-page__viewport" primary>
      <div class="flash-page__content">
        <template v-if="isLoggedIn">
          <FlashEditor @submit="onSubmit" />
          <FlashNoteList :notes="notes" :loading="loading" @remove="onRemove" />
        </template>
        <FlashEmptyState v-else />
      </div>
    </CommonCustomScrollbar>

    <!-- 右侧栏 -->
    <ClientOnly>
      <Teleport to="#right-sidebar-target">
        <SidebarRightSidebar>
          <div class="sidebar-list-group">
            <!-- AI 搜索入口 -->
            <button
              v-if="isLoggedIn"
              type="button"
              class="flash-ai-card"
              @click="aiModalVisible = true"
            >
              <Icon name="lucide:sparkles" size="18" class="flash-ai-card__icon" />
              <div class="flash-ai-card__body">
                <span class="flash-ai-card__title">AI 搜索闪念</span>
                <span class="flash-ai-card__desc">让 AI 帮你回顾过去的想法</span>
              </div>
              <Icon name="lucide:chevron-right" size="14" class="flash-ai-card__arrow" />
            </button>

            <!-- 统计卡片 -->
            <div v-if="isLoggedIn" class="flash-stat-card">
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">闪念总数</span>
                <span class="flash-stat-card__value">{{ notes.length }}</span>
              </div>
              <div class="flash-stat-card__divider" />
              <div class="flash-stat-card__row">
                <span class="flash-stat-card__label">本月新增</span>
                <span class="flash-stat-card__value">{{ monthlyCount }}</span>
              </div>
            </div>

            <!-- 标签云 -->
            <div v-if="isLoggedIn && tagCloud.length > 0" class="flash-tag-cloud">
              <div class="flash-tag-cloud__header">
                <Icon name="lucide:tags" size="14" />
                <span>标签云</span>
              </div>
              <div class="flash-tag-cloud__list">
                <span
                  v-for="t in tagCloud"
                  :key="t.name"
                  class="flash-tag-cloud__item"
                  :style="{ fontSize: tagFontSize(t.count) }"
                >
                  #{{ t.name }}
                  <span class="flash-tag-cloud__count">{{ t.count }}</span>
                </span>
              </div>
            </div>
          </div>
        </SidebarRightSidebar>
      </Teleport>
    </ClientOnly>

    <FlashAISearchModal v-model:visible="aiModalVisible" :notes="notes" />
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: '闪念',
  description: '记录每一个稍纵即逝的灵感，配合 AI 搜索回顾你的想法历史',
})

const { isLoggedIn } = useCurrentUser()
const { notes, loading, tagCloud, monthlyCount, load, add, remove } = useFlashNotes()

const aiModalVisible = ref(false)

onMounted(() => {
  void load()
})

// 登录态变化时重新加载（登入 / 切换用户）
watch(isLoggedIn, () => {
  void load(true)
})

async function onSubmit(draft: { content: string; tags: string[] }) {
  await add(draft)
}

async function onRemove(id: string) {
  await remove(id)
}

/** 标签云字号：count 越大字号越大，1.2x ~ 2x */
function tagFontSize(count: number): string {
  const max = Math.max(...tagCloud.value.map((t) => t.count), 1)
  const ratio = 0.7 + (count / max) * 0.5
  return `${ratio}rem`
}
</script>

<style lang="scss" scoped>
.flash-page {
  display: flex;
  flex-direction: column;
}

.flash-page__title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--accent);

  h1 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-main);
  }
}

.flash-page__sub {
  color: var(--text-soft);
  font-size: 0.75rem;
  font-weight: 500;
}

.flash-page__body {
  flex: 1;
  min-height: 0;
}

:deep(.flash-page__viewport) {
  padding: 1.25rem 1rem;

  @media (min-width: $breakpoint-md) {
    padding: 1.75rem;
  }
}

.flash-page__content {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

/* ---- 右栏卡片：AI 搜索入口 ---- */
.flash-ai-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  background: linear-gradient(135deg, var(--accent-soft), var(--surface-1));
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
}

.flash-ai-card__icon {
  flex-shrink: 0;
  color: var(--accent);
}

.flash-ai-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.flash-ai-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
}

.flash-ai-card__desc {
  font-size: 0.6875rem;
  color: var(--text-soft);
}

.flash-ai-card__arrow {
  flex-shrink: 0;
  color: var(--text-faint);
}

/* ---- 右栏卡片：统计 ---- */
.flash-stat-card {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-stat-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.flash-stat-card__label {
  color: var(--text-soft);
}

.flash-stat-card__value {
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  font-size: 1.0625rem;
}

.flash-stat-card__divider {
  height: 1px;
  background: var(--border-soft);
  margin: 0.625rem 0;
}

/* ---- 右栏卡片：标签云 ---- */
.flash-tag-cloud {
  padding: 1rem 1.125rem;
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: $radius-card;
  box-shadow: var(--shadow-card);
}

.flash-tag-cloud__header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.flash-tag-cloud__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.625rem;
  align-items: baseline;
}

.flash-tag-cloud__item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }
}

.flash-tag-cloud__count {
  font-size: 0.625rem;
  color: var(--text-faint);
}

.sidebar-list-group {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
