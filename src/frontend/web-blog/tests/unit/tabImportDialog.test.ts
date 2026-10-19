/**
 * @file tabImportDialog.test.ts
 * @description 书签导入对话框的文件预览、策略提交、错误恢复与关闭状态回归
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import TabImportDialog from '../../app/components/tab/TabImportDialog.vue'
import { MAX_IMPORT_BYTES } from '../../app/features/tab/validation'
import type { TabExportFormat } from '../../app/features/tab/export'

const mocks = vi.hoisted(() => ({ importBulk: vi.fn(), success: vi.fn(), error: vi.fn() }))
mockNuxtImport('useTabBookmarks', () => () => ({ importBulk: mocks.importBulk }))
mockNuxtImport('useToast', () => () => ({ success: mocks.success, error: mocks.error }))

const exported: TabExportFormat = {
  version: 1,
  exportedAt: '2026-10-18T00:00:00Z',
  categories: [
    { id: 'source-category', userId: 'source-user', name: '开发', icon: 'lucide:code', color: '', sortOrder: 0 },
  ],
  bookmarks: [
    {
      id: 'source-bookmark',
      userId: 'source-user',
      categoryId: 'source-category',
      name: 'Vue 文档',
      url: 'https://vuejs.org',
      icon: 'lucide:book-open',
      color: '#abcdef',
      description: '常用参考',
      sortOrder: 0,
    },
  ],
}
const imported = {
  categories: [{ name: '开发', icon: 'lucide:code', color: '' }],
  bookmarks: [
    {
      categoryName: '开发',
      name: 'Vue 文档',
      url: 'https://vuejs.org',
      icon: 'lucide:book-open',
      color: '#abcdef',
      description: '常用参考',
    },
  ],
}
const wrappers: { unmount(): void }[] = []
const hosts: HTMLElement[] = []

beforeEach(() => {
  mocks.importBulk.mockReset().mockResolvedValue(true)
  mocks.success.mockReset()
  mocks.error.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  hosts.splice(0).forEach((host) => host.remove())
  vi.restoreAllMocks()
})

async function setup() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  hosts.push(host)
  const wrapper = await mountSuspended(TabImportDialog, {
    props: { visible: true },
    attachTo: host,
    global: { stubs: { Teleport: true, Icon: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}

async function chooseFile(wrapper: VueWrapper, file = new File([JSON.stringify(exported)], '书签.JSON')) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]')
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
  // 模拟浏览器完成文件选择后的路径，确保清空断言能检出 finally 中的回归。
  Object.defineProperty(input.element, 'value', {
    configurable: true,
    writable: true,
    value: `C:\\fakepath\\${file.name}`,
  })
  await input.trigger('change')
  await flushPromises()
  return input
}

describe('书签导入对话框', () => {
  it('未选文件时提供有名称的模态对话框，禁止提交且取消文件选择不导入', async () => {
    const wrapper = await setup()
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('导入书签')
    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(true)
    await wrapper.get('input[type="file"]').trigger('change')
    expect(wrapper.find('.tid-preview').exists()).toBe(false)
    expect(wrapper.find('.tid-error').exists()).toBe(false)
    expect(mocks.importBulk).not.toHaveBeenCalled()
  })

  it.each(['merge', 'append', 'replace'])('JSON 预览后按 %s 提交，不沿用来源账号或记录 ID', async (mode) => {
    const wrapper = await setup()
    const input = await chooseFile(wrapper)
    expect(wrapper.findAll('.tid-preview__num').map((stat) => stat.text())).toEqual(['1', '1'])
    expect(input.element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('input[value="merge"]').element.checked).toBe(true)
    await wrapper.get(`input[value="${mode}"]`).setValue()
    await wrapper.get('.tid-btn--primary').trigger('click')
    await flushPromises()

    expect(mocks.importBulk).toHaveBeenCalledExactlyOnceWith(imported, mode)
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('已导入 1 个分类、1 个书签')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('浏览器 HTML 文件通过相同预览与导入流程提交', async () => {
    const wrapper = await setup()
    await chooseFile(wrapper, new File(['<DL><DT><A HREF="https://nuxt.com">Nuxt</A></DT></DL>'], '浏览器书签.html'))
    expect(wrapper.findAll('.tid-preview__num').map((stat) => stat.text())).toEqual(['1', '1'])
    await wrapper.get('.tid-btn--primary').trigger('click')
    await flushPromises()
    expect(mocks.importBulk).toHaveBeenCalledExactlyOnceWith(
      {
        categories: [{ name: '导入', icon: 'lucide:folder', color: '' }],
        bookmarks: [{ categoryName: '导入', name: 'Nuxt', url: 'https://nuxt.com', icon: undefined }],
      },
      'merge',
    )
  })

  it('重新选择非法文件会清除旧预览并禁用提交，修正文件后可重试', async () => {
    const wrapper = await setup()
    await chooseFile(wrapper)
    await chooseFile(wrapper, new File(['{"version":99,"categories":[],"bookmarks":[]}'], '不支持的版本.json'))
    expect(wrapper.get('.tid-error').text()).toContain('不支持此导出格式版本')
    expect(wrapper.find('.tid-preview').exists()).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(true)
    expect(mocks.importBulk).not.toHaveBeenCalled()

    await chooseFile(wrapper)
    expect(wrapper.find('.tid-error').exists()).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(false)
  })

  it('读取内容之前拒绝超大文件，文件读取失败也显示原因并保持禁止提交', async () => {
    const wrapper = await setup()
    const oversized = new File(['{}'], '超大文件.json')
    Object.defineProperty(oversized, 'size', { value: MAX_IMPORT_BYTES + 1 })
    const readLarge = vi.spyOn(oversized, 'text')
    await chooseFile(wrapper, oversized)
    expect(readLarge).not.toHaveBeenCalled()
    expect(wrapper.get('.tid-error').text()).toContain('5 MB')

    const unreadable = new File(['{}'], '无法读取.json')
    vi.spyOn(unreadable, 'text').mockRejectedValueOnce(new Error('文件读取失败'))
    await chooseFile(wrapper, unreadable)
    expect(wrapper.get('.tid-error').text()).toContain('文件读取失败')
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(true)
    expect(mocks.importBulk).not.toHaveBeenCalled()
  })

  it('提交期间禁止重复点击，存储失败保留预览和策略供重试', async () => {
    const wrapper = await setup()
    await chooseFile(wrapper)
    await wrapper.get('input[value="append"]').setValue()
    let rejectImport!: (reason: Error) => void
    mocks.importBulk.mockImplementationOnce(() => new Promise<boolean>((_resolve, reject) => (rejectImport = reject)))
    const confirm = wrapper.get<HTMLButtonElement>('.tid-btn--primary')
    await confirm.trigger('click')
    expect(confirm.element.disabled).toBe(true)
    confirm.element.click()
    expect(mocks.importBulk).toHaveBeenCalledTimes(1)

    rejectImport(new Error('浏览器存储不可用，尚未保存'))
    await flushPromises()
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith('浏览器存储不可用，尚未保存')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(wrapper.find('.tid-preview').exists()).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[value="append"]').element.checked).toBe(true)
    expect(confirm.element.disabled).toBe(false)

    await confirm.trigger('click')
    await flushPromises()
    expect(mocks.importBulk).toHaveBeenLastCalledWith(imported, 'append')
    expect(mocks.success).toHaveBeenCalledTimes(1)
  })

  it('只读调用被拒绝时不宣称成功，也不关闭导入窗口', async () => {
    mocks.importBulk.mockResolvedValueOnce(false)
    const wrapper = await setup()
    await chooseFile(wrapper)
    await wrapper.get('.tid-btn--primary').trigger('click')
    await flushPromises()
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith('导入失败，请先登录后再试')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(false)
  })

  it.each([false, true])('导入期间关闭后重新打开为 %s，旧任务不误报失败或关闭新预览', async (reopen) => {
    const wrapper = await setup()
    await chooseFile(wrapper)
    let finishImport!: (ok: boolean) => void
    mocks.importBulk.mockImplementationOnce(() => new Promise<boolean>((resolve) => (finishImport = resolve)))
    await wrapper.get('.tid-btn--primary').trigger('click')
    await wrapper.get('button[aria-label="关闭"]').trigger('click')
    await wrapper.setProps({ visible: false })
    if (reopen) {
      await wrapper.setProps({ visible: true })
      await chooseFile(wrapper, new File(['<DL></DL>'], '新的书签.html'))
    }

    finishImport(true)
    await flushPromises()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('已导入 1 个分类、1 个书签')
    expect(mocks.error).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    if (reopen) {
      expect(wrapper.findAll('.tid-preview__num').map((stat) => stat.text())).toEqual(['1', '0'])
      expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(false)
    } else {
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    }
  })

  it('Escape 请求关闭，重新打开时清除文件预览并恢复合并策略', async () => {
    const wrapper = await setup()
    await chooseFile(wrapper)
    await wrapper.get('input[value="replace"]').setValue()
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    expect(wrapper.find('.tid-preview').exists()).toBe(false)
    expect(wrapper.get<HTMLButtonElement>('.tid-btn--primary').element.disabled).toBe(true)
    await chooseFile(wrapper)
    expect(wrapper.get<HTMLInputElement>('input[value="merge"]').element.checked).toBe(true)
  })

  it('英文界面下对话框、预览单位、策略与导入提示跟随语言', async () => {
    const i18n = useNuxtApp().$i18n
    await i18n.setLocale('en')
    try {
      const wrapper = await setup()
      expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Import bookmarks')
      await chooseFile(wrapper)
      expect(wrapper.findAll('.tid-preview__label').map((label) => label.text())).toEqual(['category', 'bookmark'])
      expect(wrapper.text()).toContain('Merge (recommended)')
      await wrapper.get('.tid-btn--primary').trigger('click')
      await flushPromises()
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith('Imported 1 category and 1 bookmark')
    } finally {
      await i18n.setLocale('zh-CN')
    }
  })
})
