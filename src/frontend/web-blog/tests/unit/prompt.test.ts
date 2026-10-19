/** @file prompt.test.ts @description 提示词查询边界、图片源互斥、输入验证及恢复白名单 */
import { describe, expect, it } from 'vitest'
import {
  parsePromptRecovery,
  promptForm,
  promptFormError,
  promptFormErrors,
  promptPayload,
  promptUrlError,
} from '../../app/features/prompt/editor'
import { promptId, promptQuery } from '../../app/features/prompt/query'
describe('灵感图鉴输入契约', () => {
  it('约束查询长度、有效页码和详情编号，保留模型与标签写法', () => {
    expect(promptQuery({ q: ' 光影 ', model: ' GPT Image ', tag: ' 极简 ', page: '2' })).toEqual({
      q: '光影',
      model: 'GPT Image',
      tag: '极简',
      page: 2,
      pageSize: 12,
    })
    expect(promptQuery({ page: '1.5', q: ['bad'], tag: '', model: '' })).toEqual({
      q: undefined,
      model: undefined,
      tag: undefined,
      page: 1,
      pageSize: 12,
    })
    for (const id of ['0', '-1', '1.2', '1abc', '9007199254740992', ['1']]) expect(promptId(id)).toBeNull()
    expect(promptId('42')).toBe(42)
  })
  it('切换图片源保留表单的未提交输入，只发送当前选定的来源', () => {
    const form = promptForm({
      imageSource: 'external',
      mediaId: 'managed-image',
      externalImageUrl: 'https://example.com/a?sig=Ab%2F',
    })
    expect(promptPayload(form)).toMatchObject({ mediaId: null, externalImageUrl: 'https://example.com/a?sig=Ab%2F' })
    form.imageSource = 'media'
    expect(promptPayload(form)).toMatchObject({ mediaId: 'managed-image', externalImageUrl: null })
    expect(form.externalImageUrl).toBe('https://example.com/a?sig=Ab%2F')
    expect(promptPayload(form)).not.toHaveProperty('imageSource')
  })
  it('不让空内容、无图片、过长标签和非HTTP地址进入保存', () => {
    const form = promptForm()
    expect(promptFormError(form)).toContain('标题')
    form.title = '光影'
    expect(promptFormError(form)).toContain('提示词')
    form.prompt = 'A quiet room'
    expect(promptFormError(form)).toContain('效果图片')
    form.mediaId = 'image'
    expect(promptFormError(form)).toBe('')
    form.tags = ['a'.repeat(33)]
    expect(promptFormError(form)).toContain('32')
    for (const url of ['javascript:alert(1)', 'file:///secret', 'https://user:password@example.com/a'])
      expect(promptUrlError(url)).toBeTruthy()
    expect(promptUrlError('https://example.com/a?token=x')).toBe('')
  })
  it('英文冒烟：校验提示在调用时按当前界面语言生成', async () => {
    const i18n = useNuxtApp().$i18n
    await i18n.setLocale('en')
    try {
      expect(promptFormError(promptForm())).toBe('Give this prompt a title.')
      expect(promptFormErrors(promptForm({ model: 'M'.repeat(81) })).model).toBe(
        'Model can be at most 80 characters. Please shorten it before saving.',
      )
    } finally {
      await i18n.setLocale('zh-CN')
    }
    expect(promptFormError(promptForm())).toBe('为这份灵感取一个标题。')
  })
  it('恢复的超长输入逐字段报错而不截断，并使用与服务端一致的UTF-16边界', () => {
    const form = promptForm({
      title: '📷'.repeat(81),
      prompt: '字'.repeat(30001),
      negativePrompt: '字'.repeat(10001),
      description: '字'.repeat(2001),
      model: 'M'.repeat(81),
      imageAlt: '图'.repeat(241),
      mediaId: 'image',
    })
    const errors = promptFormErrors(form)
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['title', 'prompt', 'negativePrompt', 'description', 'model', 'imageAlt']),
    )
    expect(form.prompt).toHaveLength(30001)
    expect(form.title).toHaveLength(162)
    expect(
      promptFormErrors(promptForm({ title: '📷'.repeat(80), prompt: '  保留内部\n换行  ', mediaId: 'image' })),
    ).toEqual({})
  })
  it('恢复副本不引入任意表单字段，数组独立并拒绝损坏状态', () => {
    const raw = {
      version: 1,
      context: 'library',
      id: null,
      revision: null,
      requestId: 'create-id',
      savedAt: '2026-10-03',
      form: { ...promptForm(), prompt: 'unsaved', tags: ['静物'], unauthorized: true },
      pendingCreate: null,
    }
    const recovery = parsePromptRecovery(JSON.stringify(raw))!
    expect(recovery.form.prompt).toBe('unsaved')
    expect(recovery.form).not.toHaveProperty('unauthorized')
    expect(recovery.form.tags).not.toBe(raw.form.tags)
    expect(parsePromptRecovery(JSON.stringify({ ...raw, form: { ...raw.form, status: 'private' } }))).toBeNull()
    expect(parsePromptRecovery(JSON.stringify({ ...raw, id: -1 }))).toBeNull()
    expect(parsePromptRecovery(JSON.stringify({ ...raw, id: 1, revision: 0 }))?.revision).toBe(0)
  })
})
