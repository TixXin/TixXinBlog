/** @file useVisitorSubmissionForm.ts @description 访客表单的客户端计时与蜜罐，独立于草稿恢复和提交去重 */
import { onMounted, ref, watch } from 'vue'
import type { VisitorSubmissionFields } from '~/features/visitor/types'

export function useVisitorSubmissionForm(
  options: {
    active?: () => boolean
    submitting?: () => boolean
    error?: () => string | undefined
  } = {},
) {
  const website = ref('')
  const formRenderedAt = ref<number>()
  let mounted = false
  function restart() {
    if (!mounted) return
    website.value = ''
    formRenderedAt.value = Date.now()
  }
  onMounted(() => {
    mounted = true
    if (options.active?.() !== false) restart()
  })
  if (options.active)
    watch(options.active, (active) => {
      if (active) restart()
    })
  if (options.submitting)
    watch(options.submitting, (submitting, previous) => {
      if (previous && !submitting && !options.error?.()) restart()
    })
  // 不裁剪或清空蜜罐值；服务端必须能收到机器人实际填写的内容。
  function fields(): VisitorSubmissionFields {
    return { website: website.value, formRenderedAt: formRenderedAt.value }
  }
  return { website, fields, restart }
}
