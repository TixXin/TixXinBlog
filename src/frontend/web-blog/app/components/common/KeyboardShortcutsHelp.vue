<!-- @file KeyboardShortcutsHelp.vue @description 公开站点快捷键帮助，复用模态焦点与背景隔离能力 -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="shortcut-help-overlay" @click.self="close">
      <section
        ref="dialogRef"
        class="shortcut-help"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        tabindex="-1"
      >
        <header class="shortcut-help__header">
          <h2 :id="titleId">{{ $t('layout.shortcuts.title') }}</h2>
          <button
            type="button"
            class="shortcut-help__close"
            :aria-label="$t('layout.shortcuts.closeLabel')"
            @click="close"
          >
            <Icon name="lucide:x" size="20" aria-hidden="true" />
            {{ $t('layout.shortcuts.close') }}
          </button>
        </header>
        <div class="shortcut-help__body" tabindex="0" role="region" :aria-label="$t('layout.shortcuts.listLabel')">
          <p :id="descriptionId" class="shortcut-help__description">
            {{ $t('layout.shortcuts.descriptionBefore') }} <kbd>?</kbd> {{ $t('layout.shortcuts.descriptionAfter') }}
          </p>
          <section v-for="group in groups" :key="group.key" class="shortcut-help__group">
            <h3>{{ $t(`layout.shortcuts.groups.${group.key}`) }}</h3>
            <dl>
              <div v-for="shortcut in group.shortcuts" :key="shortcut.key" class="shortcut-help__row">
                <dt>{{ $t(`layout.shortcuts.items.${shortcut.key}`) }}</dt>
                <dd>
                  <kbd>{{ shortcut.keys }}</kbd>
                </dd>
              </div>
            </dl>
          </section>
          <p class="shortcut-help__description">{{ $t('layout.shortcuts.themeNote') }}</p>
        </div>
        <footer class="shortcut-help__footer">
          <button type="button" @click="close">{{ $t('layout.shortcuts.ok') }}</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const visible = defineModel<boolean>('visible', { default: false })
const dialogRef = ref<HTMLElement | null>(null)
const titleId = useId()
const descriptionId = useId()
const close = () => (visible.value = false)
useModalFocus(visible, dialogRef, { close })

// 仅记录源码实际处理的按键；作用域与限制随条目展示，避免把动作标签误作快捷键。
// 分组标题与说明为字典 key，模板渲染时按当前界面语言翻译。
const groups = [
  {
    key: 'general',
    shortcuts: [
      { key: 'help', keys: '?' },
      { key: 'search', keys: 'Ctrl / Cmd + K' },
      { key: 'closeDialog', keys: 'Esc' },
    ],
  },
  {
    key: 'searchBookmarks',
    shortcuts: [
      { key: 'commandPalette', keys: 'Ctrl / Cmd + K' },
      { key: 'selectResult', keys: '↑ / ↓' },
      { key: 'openResult', keys: 'Enter' },
      { key: 'moveBookmark', keys: 'Alt + ↑ / ↓' },
    ],
  },
  {
    key: 'reading',
    shortcuts: [
      { key: 'scroll', keys: 'j / k' },
      { key: 'top', keys: 't' },
      { key: 'adjacent', keys: '[ / ]' },
    ],
  },
  {
    key: 'imagesGuestbook',
    shortcuts: [
      { key: 'imageNav', keys: '← / →' },
      { key: 'sendMessage', keys: 'Ctrl / Cmd + Enter' },
    ],
  },
]
</script>

<style lang="scss" scoped>
.shortcut-help-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--overlay-bg);
}

.shortcut-help {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 36rem;
  max-height: calc(100dvh - 2rem);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface-1);
  color: var(--text-main);
  box-shadow: var(--shadow-card);

  &__header,
  &__footer {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    padding: 0.75rem 1rem;
  }

  &__header {
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);

    h2 {
      font-size: 1.125rem;
      font-weight: 600;
    }
  }

  &__close {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    min-height: 2.75rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  &__body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem;
  }

  &__description {
    color: var(--text-soft);
    font-size: 0.875rem;
    line-height: 1.7;
  }

  &__group {
    margin: 1.25rem 0;

    h3 {
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 0.875rem;
    line-height: 1.5;

    dt {
      flex: 1 1 12rem;
    }

    dd {
      margin: 0;
    }
  }

  kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--surface-2);
    color: var(--text-main);
    font-size: 0.8125rem;
  }

  &__footer {
    justify-content: flex-end;
    border-top: 1px solid var(--border);

    button {
      min-height: 2.75rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
    }
  }

  button:hover {
    background: var(--surface-2);
  }

  button:focus-visible,
  &__body:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
}
</style>
