/**
 * @file og-render.ts
 * @description 用 sharp（libvips + Pango）把分享卡片排版成 1200×630 PNG：背景与面板为 SVG，文字由 Pango 排版，
 * 中英混排自动换行，超出文字框时按框自动缩小字号。字体随镜像交付（assets/fonts），不依赖系统字体。
 * @author TixXin
 * @since 2026-11-03
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { OG_HEIGHT, OG_PALETTES, OG_WIDTH, type OgPalette, type OgTheme } from './og-theme'
import { escapeMarkup } from './og-text'

/** 源码（src/modules/og）与构建产物（dist/modules/og）到包根目录的层级相同 */
export const OG_FONT_DIRECTORY = join(__dirname, '../../../assets/fonts')
const FONT_FILE = join(OG_FONT_DIRECTORY, 'NotoSansSC-Bold.otf')
const FONT_FAMILY = 'Noto Sans SC Bold'
/** 与 assets/fonts/fonts.conf 的 cachedir 一致 */
const FONT_CACHE_DIRECTORY = '/tmp/tixxin-fontconfig'

/** 卡片内容：所有文字已清理与截断，由服务层从公开数据组装 */
export interface OgCardContent {
  theme: OgTheme
  /** 左上角类型标签；站点卡不显示 */
  label?: string
  headline: string
  /** 主文字的首选字号（像素），放不下时自动缩小 */
  headlineSize: number
  /** 主文字下方的辅助文字（站点简介） */
  body?: string
  /** 页脚名称 */
  name: string
  /** 没有受管头像时的首字母 */
  initial: string
  date?: string
  /** 受管头像的图片字节 */
  avatar?: Buffer
}

interface TextSpec {
  text: string
  size: number
  color: string
  alpha?: number
  width: number
  height: number
  spacing?: number
}

interface Layer {
  input: Buffer
  left: number
  top: number
}

const PANEL = { x: 48, y: 48, width: OG_WIDTH - 96, height: OG_HEIGHT - 96, radius: 32 }
const CONTENT_X = 104
const CONTENT_WIDTH = OG_WIDTH - CONTENT_X * 2
const PILL = { y: 104, height: 48, padding: 20, size: 22 }
const FOOTER = { divider: 462, avatarTop: 486, avatarSize: 64 }

let fontConfigReady = false

/**
 * 首次渲染前指向随镜像交付的 fontconfig 配置（环境已显式设置时不覆盖），并预先建好缓存目录：
 * 目录不存在时 fontconfig 会先报“没有可写缓存目录”，本次也不落缓存。
 */
function ensureFontConfig() {
  if (fontConfigReady) return
  fontConfigReady = true
  process.env.FONTCONFIG_FILE ??= join(OG_FONT_DIRECTORY, 'fonts.conf')
  try {
    mkdirSync(FONT_CACHE_DIRECTORY, { recursive: true })
  } catch {
    // 临时目录不可写时只是不落缓存，渲染照常进行
  }
}

function markup(spec: TextSpec) {
  const alpha = spec.alpha !== undefined && spec.alpha < 100 ? ` alpha="${spec.alpha}%"` : ''
  return `<span foreground="${spec.color}"${alpha}>${escapeMarkup(spec.text)}</span>`
}

/** 先按首选字号排版；高度超出文字框时改用宽高自适应，让 Pango 缩小字号直到放得下 */
async function renderText(spec: TextSpec) {
  ensureFontConfig()
  const base = {
    text: markup(spec),
    font: `${FONT_FAMILY} ${spec.size}`,
    fontfile: FONT_FILE,
    width: spec.width,
    rgba: true,
    wrap: 'word-char' as const,
    spacing: spec.spacing ?? 0,
  }
  const fixed = await sharp({ text: { ...base, dpi: 72 } })
    .png()
    .toBuffer({ resolveWithObject: true })
  if (fixed.info.height <= spec.height) return { data: fixed.data, width: fixed.info.width, height: fixed.info.height }
  const fitted = await sharp({ text: { ...base, height: spec.height } })
    .png()
    .toBuffer({ resolveWithObject: true })
  return { data: fitted.data, width: fitted.info.width, height: fitted.info.height }
}

async function circleAvatar(image: Buffer, size: number): Promise<Buffer | undefined> {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  )
  try {
    return await sharp(image, { limitInputPixels: 40000000 })
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
  } catch {
    // 头像文件损坏时退回首字母头像，不让分享卡片失败
    return undefined
  }
}

/** 主文字区可用的纵向范围：类型标签下方（或面板顶部）到页脚分隔线上方 */
const MAIN_BOTTOM = FOOTER.divider - 24

async function pillLayer(label: string, palette: OgPalette) {
  const text = await renderText({ text: label, size: PILL.size, color: palette.pillText, width: 400, height: 40 })
  const layer: Layer = {
    input: text.data,
    left: CONTENT_X + PILL.padding,
    top: PILL.y + Math.round((PILL.height - text.height) / 2),
  }
  return { layer, width: text.width + PILL.padding * 2 }
}

/** 主文字区：类型标签、标题或正文摘录、站点简介；站点卡没有标签，文字块在面板上部垂直居中 */
async function mainLayers(card: OgCardContent, palette: OgPalette) {
  const pill = card.label ? await pillLayer(card.label, palette) : undefined
  const headline = await renderText({
    text: card.headline,
    size: card.headlineSize,
    color: palette.text,
    width: CONTENT_WIDTH,
    height: card.body ? 170 : 236,
    spacing: Math.round(card.headlineSize * 0.22),
  })
  const body = card.body
    ? await renderText({
        text: card.body,
        size: 32,
        color: palette.muted,
        alpha: palette.mutedAlpha,
        width: CONTENT_WIDTH,
        height: 100,
        spacing: 10,
      })
    : undefined
  const gap = body ? 28 : 0
  const blockHeight = headline.height + gap + (body?.height ?? 0)
  const top = pill ? 184 : PANEL.y + Math.max(48, Math.round((MAIN_BOTTOM - PANEL.y - blockHeight) / 2))
  const layers: Layer[] = [{ input: headline.data, left: CONTENT_X, top }]
  if (pill) layers.unshift(pill.layer)
  if (body) layers.push({ input: body.data, left: CONTENT_X, top: top + headline.height + gap })
  return { layers, pillWidth: pill?.width ?? 0 }
}

/** 页脚：头像（受管图片或首字母）、名称与日期 */
async function footerLayers(card: OgCardContent, palette: OgPalette) {
  const layers: Layer[] = []
  const { avatarTop, avatarSize } = FOOTER
  const centerY = avatarTop + avatarSize / 2
  const avatar = card.avatar ? await circleAvatar(card.avatar, avatarSize) : undefined
  if (avatar) layers.push({ input: avatar, left: CONTENT_X, top: avatarTop })
  else {
    const letter = await renderText({ text: card.initial, size: 30, color: palette.avatarText, width: 60, height: 48 })
    layers.push({
      input: letter.data,
      left: CONTENT_X + Math.round((avatarSize - letter.width) / 2),
      top: Math.round(centerY - letter.height / 2),
    })
  }
  const nameLeft = CONTENT_X + avatarSize + 20
  const date = card.date
    ? await renderText({
        text: card.date,
        size: 26,
        color: palette.muted,
        alpha: palette.mutedAlpha,
        width: 300,
        height: 44,
      })
    : undefined
  const nameWidth = CONTENT_X + CONTENT_WIDTH - nameLeft - (date ? date.width + 32 : 0)
  const name = await renderText({ text: card.name, size: 28, color: palette.text, width: nameWidth, height: 44 })
  layers.push({ input: name.data, left: nameLeft, top: Math.round(centerY - name.height / 2) })
  if (date)
    layers.push({
      input: date.data,
      left: CONTENT_X + CONTENT_WIDTH - date.width,
      top: Math.round(centerY - date.height / 2),
    })
  return { layers, letterAvatar: !avatar }
}

function backgroundSvg(palette: OgPalette, pillWidth: number, letterAvatar: boolean) {
  const { x, y, width, height, radius } = PANEL
  const { avatarTop, avatarSize, divider } = FOOTER
  const r = avatarSize / 2
  return Buffer.from(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">`,
      palette.background,
      '<defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">',
      '<feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.10"/></filter></defs>',
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${palette.panelFill}"`,
      ` stroke="${palette.panelStroke}" stroke-width="2" filter="url(#shadow)"/>`,
      pillWidth
        ? `<rect x="${CONTENT_X}" y="${PILL.y}" width="${pillWidth}" height="${PILL.height}" rx="${PILL.height / 2}" fill="${palette.pillFill}"/>`
        : '',
      `<rect x="${CONTENT_X}" y="${divider}" width="${CONTENT_WIDTH}" height="2" fill="${palette.divider}"/>`,
      letterAvatar ? `<circle cx="${CONTENT_X + r}" cy="${avatarTop + r}" r="${r}" fill="${palette.avatarFill}"/>` : '',
      '</svg>',
    ].join(''),
  )
}

/** 渲染分享卡片 PNG */
export async function renderOgCard(card: OgCardContent): Promise<Buffer> {
  const palette = OG_PALETTES[card.theme]
  const main = await mainLayers(card, palette)
  const footer = await footerLayers(card, palette)
  return sharp(backgroundSvg(palette, main.pillWidth, footer.letterAvatar))
    .composite([...main.layers, ...footer.layers])
    .png({ compressionLevel: 9 })
    .toBuffer()
}
