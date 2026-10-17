/**
 * @file useAdminSaveShortcut.ts
 * @description 后台编辑器 Ctrl/⌘+S 保存：拦截浏览器“保存网页”，复用表单主保存按钮的提交逻辑；
 * 保存中、按钮禁用、无改动或有模态对话框时不重复提交，冲突与校验沿用按钮原有处理。
 */
import type { Ref } from 'vue'

export interface AdminSaveShortcutOptions {
  /** 编辑器表单；快捷键通过 requestSubmit 触发与点击保存按钮相同的 submit 处理 */
  form: Ref<HTMLFormElement | null | undefined>
  /** 主保存按钮；缺省取表单内第一个 submit 按钮 */
  submitter?: () => HTMLButtonElement | null | undefined
  /** 返回 false 表示当前没有可保存的改动，快捷键只给出提示 */
  dirty?: () => boolean
  /** 返回 false 时快捷键只阻止浏览器默认行为，不提交 */
  enabled?: () => boolean
}

/** 判断按键是否为 Ctrl/⌘+S（排除 Shift/Alt 组合与输入法合成中的按键） */
export function isSaveShortcut(event: KeyboardEvent) {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing &&
    (event.key === 's' || event.key === 'S' || event.code === 'KeyS')
  )
}

/** 按平台显示快捷键文字；服务端渲染与首屏统一为 Ctrl+S，挂载后再按平台修正，避免水合不一致 */
export function useSaveShortcutLabel() {
  const label = ref('Ctrl+S')
  onMounted(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent
    if (/mac|iphone|ipad|ipod/i.test(platform)) label.value = '⌘S'
  })
  return label
}

export function useAdminSaveShortcut(options: AdminSaveShortcutOptions) {
  const { info } = useToast()
  const label = useSaveShortcutLabel()
  function resolveSubmitter() {
    return options.submitter?.() ?? options.form.value?.querySelector<HTMLButtonElement>('button[type="submit"]')
  }
  function handle(event: KeyboardEvent) {
    if (!isSaveShortcut(event)) return
    // 同一页面若注册了多个编辑器，第一个处理者生效，其余跳过，避免重复提交。
    if (event.defaultPrevented) return
    event.preventDefault()
    if (event.repeat) return
    const form = options.form.value
    if (!form?.isConnected || options.enabled?.() === false) return
    // 模态对话框（发布前检查、媒体选择、冲突比较等）打开时由对话框自身处理，不在其背后提交。
    if (document.querySelector('dialog[open]')) return
    const submitter = resolveSubmitter()
    if (!submitter || submitter.disabled || submitter.getAttribute('aria-busy') === 'true') return
    if (options.dirty && !options.dirty()) {
      info('当前没有需要保存的修改')
      return
    }
    form.requestSubmit(submitter)
  }
  onMounted(() => window.addEventListener('keydown', handle))
  onBeforeUnmount(() => window.removeEventListener('keydown', handle))
  return { label, handle }
}
