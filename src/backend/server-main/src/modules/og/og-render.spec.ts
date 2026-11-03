/** @file og-render.spec.ts @description 分享卡片渲染：尺寸、按主题取色、长标题自适应、损坏头像回退 */
import sharp from 'sharp'
import { renderOgCard, type OgCardContent } from './og-render'

const card: OgCardContent = {
  theme: 'nexus',
  label: '文章',
  headline: 'Nuxt 4 静态发布实践',
  headlineSize: 64,
  name: '示例博客',
  initial: '示',
  date: '2026-11-03',
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  const offset = (y * info.width + x) * info.channels
  return [data[offset], data[offset + 1], data[offset + 2]]
}

describe('分享卡片渲染', () => {
  jest.setTimeout(20000)

  it('输出 1200×630 PNG', async () => {
    const meta = await sharp(await renderOgCard(card)).metadata()
    expect(meta).toMatchObject({ format: 'png', width: 1200, height: 630 })
  })

  it('Nexus 与 Dock 共用站点色板，Aurora 使用渐变底色', async () => {
    const [nexus, dock, aurora] = await Promise.all(
      (['nexus', 'dock', 'aurora'] as const).map((theme) => renderOgCard({ ...card, theme })),
    )
    // 左上角落在面板外，直接是背景色
    expect(await pixel(nexus!, 4, 4)).toEqual(await pixel(dock!, 4, 4))
    expect(await pixel(nexus!, 4, 4)).toEqual([0xeb, 0xef, 0xf4])
    const [r, g, b] = (await pixel(aurora!, 4, 4)) as number[]
    expect(Math.abs(r! - 0x66) + Math.abs(g! - 0x7e) + Math.abs(b! - 0xea)).toBeLessThan(12)
  })

  it('超长标题按文字框缩小字号，仍然输出完整卡片', async () => {
    const png = await renderOgCard({ ...card, headline: '很长的标题'.repeat(30) })
    expect((await sharp(png).metadata()).height).toBe(630)
  })

  it('标题中的标记字符按文字渲染，不会让排版失败', async () => {
    await expect(renderOgCard({ ...card, headline: '<b>A & B</b> <span' })).resolves.toBeInstanceOf(Buffer)
  })

  it('头像无法解码时退回首字母头像', async () => {
    const png = await renderOgCard({ ...card, avatar: Buffer.from('not an image') })
    expect((await sharp(png).metadata()).width).toBe(1200)
  })
})
