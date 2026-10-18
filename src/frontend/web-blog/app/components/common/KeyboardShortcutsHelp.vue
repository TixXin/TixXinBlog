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
          <h2 :id="titleId">键盘快捷键</h2>
          <button type="button" class="shortcut-help__close" aria-label="关闭快捷键帮助" @click="close">
            <Icon name="lucide:x" size="20" aria-hidden="true" />
            关闭
          </button>
        </header>
        <div class="shortcut-help__body" tabindex="0" role="region" aria-label="快捷键列表">
          <p :id="descriptionId" class="shortcut-help__description">
            在公开页面按 <kbd>?</kbd> 打开此帮助。输入文字时不会触发问号帮助或文章阅读快捷键。 Mac 使用 Cmd，Windows /
            Linux 使用 Ctrl。
          </p>
          <section v-for="group in groups" :key="group.title" class="shortcut-help__group">
            <h3>{{ group.title }}</h3>
            <dl>
              <div v-for="shortcut in group.shortcuts" :key="shortcut.description" class="shortcut-help__row">
                <dt>{{ shortcut.description }}</dt>
                <dd>
                  <kbd>{{ shortcut.keys }}</kbd>
                </dd>
              </div>
            </dl>
          </section>
          <p class="shortcut-help__description">主题切换请使用「界面设置」，目前没有独立快捷键。</p>
        </div>
        <footer class="shortcut-help__footer">
          <button type="button" @click="close">知道了</button>
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
const groups = [
  {
    title: '通用',
    shortcuts: [
      { description: '打开快捷键帮助', keys: '?' },
      { description: '打开站内搜索（输入框内也可用）', keys: 'Ctrl / Cmd + K' },
      { description: '关闭当前对话框或外观设置', keys: 'Esc' },
    ],
  },
  {
    title: '搜索与书签',
    shortcuts: [
      { description: '书签页：打开命令面板（需在书签设置中启用；关闭时打开站内搜索）', keys: 'Ctrl / Cmd + K' },
      { description: '搜索或命令面板输入框：选择上一个 / 下一个结果', keys: '↑ / ↓' },
      { description: '搜索或命令面板输入框：打开结果 / 执行命令', keys: 'Enter' },
      { description: '书签页：上移 / 下移当前聚焦的书签或分类（博主登录后）', keys: 'Alt + ↑ / ↓' },
    ],
  },
  {
    title: '文章阅读',
    shortcuts: [
      { description: '向下 / 向上滚动', keys: 'j / k' },
      { description: '回到顶部', keys: 't' },
      { description: '上一篇 / 下一篇（仅内置演示文章）', keys: '[ / ]' },
    ],
  },
  {
    title: '图片与留言',
    shortcuts: [
      { description: '图片查看器或提示词详情：上一张 / 下一张', keys: '← / →' },
      { description: '留言输入框：发送留言', keys: 'Ctrl / Cmd + Enter' },
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
