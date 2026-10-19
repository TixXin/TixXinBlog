/**
 * @file projectGalleryAboutI18n.test.ts
 * @description 项目、图库与关于页的英文冒烟：卡片、技术栈、灯箱、打赏卡与栏目名称随界面语言切换，
 *              图片地址校验在无翻译函数时保持中文兜底且与 zh-CN 字典逐字一致
 * @author TixXin
 * @since 2026-10-19
 */

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DonateCard from '../../app/components/about/DonateCard.vue'
import ProfileContent from '../../app/components/about/ProfileContent.vue'
import GalleryFilter from '../../app/components/gallery/GalleryFilter.vue'
import GalleryLightBox from '../../app/components/gallery/LightBox.vue'
import ProjectCard from '../../app/components/project/ProjectCard.vue'
import TechStackCard from '../../app/components/project/TechStackCard.vue'
import { galleryUrlError, galleryUrlErrorKey } from '../../app/features/gallery/editor'
import type { PhotoItem } from '../../app/features/gallery/types'
import type { ProjectItem } from '../../app/features/project/types'

// 按原文读取中文字典（?raw 绕过 i18n 插件的预编译）
const zhMisc = JSON.parse(
  Object.values(
    import.meta.glob<string>('../../i18n/locales/zh-CN/misc.json', { eager: true, query: '?raw', import: 'default' }),
  )[0]!,
) as { misc: { gallery: { url: Record<string, string> } } }

/** 用到时再取：收集阶段 Nuxt 测试应用尚未就绪 */
const i18n = () => useNuxtApp().$i18n

async function inEnglish(run: () => void | Promise<void>) {
  await i18n().setLocale('en')
  try {
    await run()
  } finally {
    await i18n().setLocale('zh-CN')
  }
}

const project: ProjectItem = {
  id: 3,
  title: 'TixXinBlog',
  description: 'Nuxt 与 NestJS 的个人博客',
  cover: null,
  width: null,
  height: null,
  progress: 'active',
  tags: [{ label: 'Vue', color: 'emerald' }],
  links: [{ kind: 'source', href: 'https://example.com/source', label: '源代码', icon: 'lucide:github' }],
  publishedAt: '2026-10-01T00:00:00.000Z',
}

const photo: PhotoItem = {
  id: 21,
  source: 'media',
  title: '海港晨光',
  description: '清晨的海面与停泊的小船',
  src: '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp',
  srcLarge: '/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp',
  width: 1000,
  height: 750,
  category: '风景',
  date: '2026-10-01',
  location: '海港',
}

describe('项目、图库与关于页英文界面', () => {
  it('项目卡片与技术栈显示英文进展、链接名称与项目数', async () => {
    const zh = await mountSuspended(ProjectCard, { props: { project, interactive: true } })
    expect(zh.text()).toContain('维护中')
    expect(zh.text()).toContain('源代码')
    zh.unmount()
    await inEnglish(async () => {
      const card = await mountSuspended(ProjectCard, { props: { project, interactive: true } })
      expect(card.text()).toContain('Maintained')
      expect(card.text()).toContain('Source code')
      expect(card.text()).toContain('No cover image')
      expect(card.get('.project-card__tag').attributes('aria-label')).toBe('Filter by technology: Vue')
      card.unmount()
      const stack = await mountSuspended(TechStackCard, {
        props: {
          interactive: true,
          stack: [
            { label: 'Vue', color: 'emerald', count: 1, percent: 50 },
            { label: 'NestJS', color: 'blue', count: 2, percent: 100 },
          ],
        },
      })
      expect(stack.text()).toContain('Tech stack')
      expect(stack.text()).toContain('1 project · 50%')
      expect(stack.text()).toContain('2 projects · 100%')
      stack.unmount()
    })
  })

  it('灯箱与关于页组件显示英文文案', async () => {
    await inEnglish(async () => {
      const box = await mountSuspended(GalleryLightBox, {
        props: { visible: true, photo, pending: false, error: '', canPrevious: true, canNext: true },
      })
      const dialog = document.body.querySelector('.lightbox')
      expect(dialog?.textContent).toContain('Taken on 2026-10-01')
      expect(dialog?.textContent).toContain('Next')
      expect(dialog?.querySelector('.lightbox__close')?.getAttribute('aria-label')).toBe('Close')
      box.unmount()
      const donate = await mountSuspended(DonateCard)
      expect(donate.text()).toContain('Thanks for your support')
      donate.unmount()
      const profile = await mountSuspended(ProfileContent, {
        props: {
          value: {
            visible: true,
            introduction: '',
            sections: [
              {
                kind: 'reading',
                visible: true,
                items: [{ title: '设计心理学', detail: '', period: '诺曼', visible: true }],
              },
            ],
          },
        },
      })
      expect(profile.text()).toContain('Reading list')
      profile.unmount()
    })
  })

  it('图库筛选的未分类名称与计数括号随界面语言，不使用接口返回的中文缺省标签', async () => {
    const props = {
      categories: [
        { label: '全部', value: undefined },
        { label: '未分类', value: '', count: 2 },
        { label: '风景', value: '风景', count: 5 },
      ],
      modelValue: undefined,
      disabled: false,
    }
    const zh = await mountSuspended(GalleryFilter, { props })
    expect(zh.findAll('button').map((item) => item.text())).toEqual(['全部', '未分类（2）', '风景（5）'])
    await inEnglish(async () => {
      const en = await mountSuspended(GalleryFilter, { props })
      // 博主维护的分类名称不翻译，只有空分类使用界面文案
      expect(en.findAll('button').map((item) => item.text())).toEqual(['全部', 'Uncategorized (2)', '风景 (5)'])
    })
  })

  it('图片地址校验：传入 t 时随语言，未传时为中文兜底且与字典一致', async () => {
    const cases = {
      required: '',
      invalidFormat: 'ftp://example.com/a.png',
      incompleteOrCredentials: 'https://user:secret@example.com/a.png',
      managedMedia: 'https://example.com/api/v1/media/3b8ada68-c31e-458a-9bde-12cf04e2473e.webp',
      invalid: 'https://[broken/a.png',
    }
    expect(Object.keys(cases).sort()).toEqual(Object.keys(zhMisc.misc.gallery.url).sort())
    for (const [name, input] of Object.entries(cases)) {
      expect(galleryUrlErrorKey(input)).toBe(`misc.gallery.url.${name}`)
      expect(galleryUrlError(input)).toBe(zhMisc.misc.gallery.url[name])
    }
    expect(galleryUrlErrorKey('https://images.example.com/a.webp')).toBe('')
    await inEnglish(() => {
      const t = (key: string) => i18n().t(key)
      expect(galleryUrlError('', t)).toBe('Please enter the full image URL')
    })
  })
})
