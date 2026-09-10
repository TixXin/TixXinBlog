/** @file editorRecoveryDetails.test.ts @description 异内容库恢复资料完整可读，旧封面与链接不会自动绑定或激活 */
import { expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectDetails from '../../app/components/admin/ProjectRecoveryDetails.vue'
import GalleryDetails from '../../app/components/admin/GalleryRecoveryDetails.vue'
import { projectForm } from '../../app/features/project/editor'
import { galleryForm } from '../../app/features/gallery/editor'
it('项目副本展示标签颜色、完整链接、进展状态排序和原封面编号', async () => {
  const wrapper = await mountSuspended(ProjectDetails, {
    props: {
      value: {
        ...projectForm(),
        title: '旧项目',
        description: '旧说明',
        progress: 'archived',
        status: 'withdrawn',
        sortOrder: 45,
        coverMediaId: '12345678-1234-4123-a123-123456789abc',
        tags: [{ label: 'UnstoredTech', color: 'rose' }],
        links: [{ kind: 'docs', href: 'https://example.com/OnlyInDraft?version=Original' }],
      },
    },
  })
  for (const text of [
    '旧项目',
    '旧说明',
    '已归档',
    '已撤回',
    '45',
    'UnstoredTech',
    'rose',
    'OnlyInDraft?version=Original',
    '12345678-1234-4123-a123-123456789abc',
  ])
    expect(wrapper.text()).toContain(text)
  expect(wrapper.findAll('img,a,input,button')).toHaveLength(0)
  wrapper.unmount()
})
it('图库副本展示分类日期地点器材排序及原媒体编号', async () => {
  const wrapper = await mountSuspended(GalleryDetails, {
    props: {
      value: {
        ...galleryForm(),
        title: '旧作品',
        description: '旧说明',
        category: '街头',
        takenOn: '2024-01-08',
        location: '旧地点',
        device: '旧器材',
        status: 'withdrawn',
        sortOrder: 9,
        mediaId: '12345678-1234-4123-a123-123456789abc',
      },
    },
  })
  for (const text of [
    '旧作品',
    '旧说明',
    '街头',
    '2024-01-08',
    '旧地点',
    '旧器材',
    '已撤回',
    '9',
    '12345678-1234-4123-a123-123456789abc',
  ])
    expect(wrapper.text()).toContain(text)
  expect(wrapper.findAll('img,a,input,button')).toHaveLength(0)
  wrapper.unmount()
})
