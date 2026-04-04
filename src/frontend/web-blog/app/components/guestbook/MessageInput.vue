<!--
  @file MessageInput.vue
  @description 留言输入区：富文本工具栏占位与可编辑区域、发送按钮（UI 占位）
  @author TixXin
  @since 2026-03-20
-->

<template>
  <div class="card message-input">
    <div class="message-input__toolbar" role="toolbar" aria-label="格式工具栏（占位）">
      <CommonTooltip v-for="btn in toolbarButtons" :key="btn.icon" :content="btn.title">
        <button type="button" class="message-input__tool" tabindex="-1">
          <Icon :name="btn.icon" size="16" />
        </button>
      </CommonTooltip>
      <div class="message-input__toolbar-spacer" />
      <button type="button" class="message-input__send" @click="handleAction">
        <Icon name="lucide:send" size="14" />
        发送
      </button>
    </div>
    <div class="message-input__editor-wrap">
      <div
        class="message-input__editor"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder="输入留言内容...（当前为 UI 演示，发送未接入接口）"
        spellcheck="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { info } = useToast()

function handleAction() {
  info('留言功能开发中，敬请期待！')
}

const toolbarButtons = [
  { icon: 'lucide:bold', title: '加粗' },
  { icon: 'lucide:italic', title: '斜体' },
  { icon: 'lucide:code', title: '行内代码' },
  { icon: 'lucide:link', title: '链接' },
  { icon: 'lucide:image', title: '图片' },
  { icon: 'lucide:quote', title: '引用' },
  { icon: 'lucide:smile', title: '表情' },
] as const
</script>

<style lang="scss" scoped>
.message-input {
  flex-shrink: 0;
  margin: 0;
  border-radius: 0;
  border: none;
  border-top: 1px solid var(--border-soft);
  background: var(--surface-1-alpha-90);
  backdrop-filter: blur(8px);
  box-shadow: none;
  padding: 0;
  overflow: hidden;
}

.message-input__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.125rem;
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--border-soft);
}

.message-input__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-soft);
  cursor: default;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: var(--surface-2);
    color: var(--text-main);
  }
}

.message-input__toolbar-spacer {
  flex: 1;
  min-width: 0.5rem;
}

.message-input__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 28px;
  padding: 0 0.875rem;
  border: none;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: #1e293b;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: default;
  transition:
    background 0.2s,
    box-shadow 0.2s,
    transform 0.15s;

  &:hover {
    background: #0f172a;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  &:active {
    transform: scale(0.96);
  }
}

:root.dark .message-input__send {
  background: var(--accent);
  color: #fff;

  &:hover {
    filter: brightness(1.08);
  }
}

.message-input__editor-wrap {
  padding: 0.75rem 1rem 1rem;
}

.message-input__editor {
  width: 100%;
  min-height: 100px;
  max-height: 160px;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-main);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: $radius-md;
  outline: none;
  overflow-y: auto;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:focus {
    border-color: var(--border-hover);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }

  &:empty::before {
    content: attr(data-placeholder);
    color: var(--text-faint);
    pointer-events: none;
  }
}
</style>
