/** @file searchExcerpt.test.ts @description 搜索命中片段：正文命中窗口与后端规则一致，摘录去掉 Markdown 并截取关键词前后，找不到时退回摘要 */
import { describe, expect, it } from 'vitest'
import { CONTENT_MATCH_AFTER, CONTENT_MATCH_BEFORE, contentMatchWindow } from '../../app/features/search/contentMatch'
import { EXCERPT_AFTER, EXCERPT_BEFORE, buildExcerpt, markdownToPlain } from '../../app/features/search/excerpt'
import { noteDescription, postDescription } from '../../app/features/search/sources'

describe('正文命中窗口（与后端 post-search-match 同一组用例）', () => {
  it('不区分大小写定位首个命中，中文按前后字符数截取', () => {
    expect(contentMatchWindow('Intro: Nuxt static PUBLISH guide', 'publish')).toBe('Intro: Nuxt static PUBLISH guide')
    const raw = '前'.repeat(200) + '关键词' + '后'.repeat(300)
    expect(contentMatchWindow(raw, '关键词')).toBe(
      '前'.repeat(CONTENT_MATCH_BEFORE) + '关键词' + '后'.repeat(CONTENT_MATCH_AFTER),
    )
  })

  it('窗口边界落在代理对中间时向外扩展', () => {
    const emoji = '😀'
    const raw = emoji.repeat(41) + 'a' + '关键词' + 'b' + emoji.repeat(100)
    const window = contentMatchWindow(raw, '关键词')!
    expect(window).toBe(raw.slice(83 - CONTENT_MATCH_BEFORE - 1, 83 + 3 + CONTENT_MATCH_AFTER + 1))
  })

  it.each([
    ['没有关键词', '其他'],
    ['', '关键词'],
    ['正文', '  '],
  ])('未命中或为空时返回 undefined：%j / %j', (raw, keyword) => {
    expect(contentMatchWindow(raw, keyword)).toBeUndefined()
  })
})

describe('命中摘录', () => {
  it('去掉标题、强调、代码围栏（含语言标注）、图片与链接地址，保留链接文字与代码', () => {
    expect(
      markdownToPlain(
        '## 部署\n> **注意**：见 [静态发布](https://example.com/a) 一节\n![图](/x.webp)\n```sh\npnpm build\n```',
      ),
    ).toBe('部署 注意：见 静态发布 一节 pnpm build')
  })

  it('窗口从链接地址中间截断时丢弃残段', () => {
    expect(markdownToPlain('ample.com/path) 之后的正文')).toBe('之后的正文')
    expect(markdownToPlain('文字](https://example.com) 后面')).toBe('文字 后面')
  })

  it('截取关键词前后并补省略号', () => {
    const source = '甲'.repeat(100) + '静态搜索' + '乙'.repeat(200)
    expect(buildExcerpt(source, '静态搜索')).toBe(
      '…' + '甲'.repeat(EXCERPT_BEFORE) + '静态搜索' + '乙'.repeat(EXCERPT_AFTER) + '…',
    )
    expect(buildExcerpt('开头就是静态搜索', '静态搜索')).toBe('开头就是静态搜索')
  })

  it('关键词只出现在语法里（如链接地址）时返回 null', () => {
    expect(buildExcerpt('见 [文档](https://example.com/static)', 'example')).toBeNull()
    expect(buildExcerpt('', '关键词')).toBeNull()
    expect(buildExcerpt('正文', ' ')).toBeNull()
  })

  it('文章正文命中时显示摘录，否则显示摘要；闪念与朋友圈命中在标签时显示正文', () => {
    expect(postDescription({ summary: '摘要', contentMatch: '前文 **静态** 搜索 后文' }, '静态')).toBe(
      '前文 静态 搜索 后文',
    )
    expect(postDescription({ summary: '摘要' }, '静态')).toBe('摘要')
    expect(postDescription({ summary: '摘要', contentMatch: '[链接](https://static.example)' }, 'static')).toBe('摘要')
    expect(noteDescription('今天写了 #笔记', '写了')).toBe('今天写了 #笔记')
    expect(noteDescription('只有正文', '标签')).toBe('只有正文')
  })
})
