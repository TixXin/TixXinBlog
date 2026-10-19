/** @file post-preview.service.ts @description 无持久令牌的草稿分享预览，绑定内容代次并使用用途专用 HMAC 密钥。 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { isUUID } from 'class-validator'
import { ContentContext } from '../../entities/content-context.entity'
import { Post } from '../../entities/post.entity'
import { getAccessSecret } from '../auth/auth.constants'
import { ArticleDetailDto, PostService } from './post.service'
import { msg } from '../../common/i18n'

const PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60
const PREVIEW_KEY_PURPOSE = 'tixxinblog:post-preview:v1'

interface PreviewPayload {
  v: 1
  postId: number
  generation: string
  exp: number
}

export interface PostPreviewLink {
  token: string
  expiresAt: string
}

export interface ArticlePreviewDto extends ArticleDetailDto {
  commentEnabled: false
  seoNoindex: true
}

@Injectable()
export class PostPreviewService {
  private readonly signingKey: Buffer

  constructor(
    private readonly em: EntityManager,
    config: ConfigService,
    private readonly posts: PostService,
  ) {
    // 复用已校验的部署密钥，只用派生密钥签预览，避免与登录 JWT 混用。
    this.signingKey = createHmac('sha256', getAccessSecret(config.get<string>('JWT_ACCESS_SECRET')))
      .update(PREVIEW_KEY_PURPOSE)
      .digest()
  }

  async issue(id: number): Promise<PostPreviewLink> {
    await this.findDraft(id)
    const context = await this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
    const exp = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS
    const payload: PreviewPayload = { v: 1, postId: id, generation: context.generation, exp }
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    return {
      token: `${encoded}.${this.signature(encoded).toString('base64url')}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    }
  }

  async read(token: unknown): Promise<ArticlePreviewDto> {
    const payload = this.verify(token)
    const context = await this.em.findOneOrFail(ContentContext, { id: 'default' }, { refresh: true })
    if (payload.generation !== context.generation) throw this.unavailable()
    const post = await this.findDraft(payload.postId)
    // 不绑定内容修订号：保存后同一链接展示最新已保存内容，直到到期或文章不再是可预览草稿。
    return { ...(await this.posts.toArticleDetail(post)), commentEnabled: false, seoNoindex: true }
  }

  private async findDraft(id: number) {
    const post = await this.em.findOne(
      Post,
      { id, status: 'draft', deletedAt: null },
      { populate: ['tags'], fields: ['*', 'tags.label', 'tags.color'] },
    )
    if (!post) throw this.unavailable()
    return post
  }

  private verify(token: unknown): PreviewPayload {
    if (typeof token !== 'string' || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token))
      throw this.unavailable()
    const [encoded, encodedSignature] = token.split('.') as [string, string]
    const signature = Buffer.from(encodedSignature, 'base64url')
    if (signature.toString('base64url') !== encodedSignature || !timingSafeEqual(signature, this.signature(encoded)))
      throw this.unavailable()
    try {
      const bytes = Buffer.from(encoded, 'base64url')
      if (bytes.toString('base64url') !== encoded) throw this.unavailable()
      const value: unknown = JSON.parse(bytes.toString('utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw this.unavailable()
      const payload = value as PreviewPayload
      if (
        payload.v !== 1 ||
        !Number.isSafeInteger(payload.postId) ||
        payload.postId <= 0 ||
        typeof payload.generation !== 'string' ||
        !isUUID(payload.generation) ||
        !Number.isSafeInteger(payload.exp) ||
        payload.exp <= Math.floor(Date.now() / 1000)
      )
        throw this.unavailable()
      return payload
    } catch {
      // 无效格式、签名、过期和不存在统一处理，不泄露文章当前状态。
      throw this.unavailable()
    }
  }

  private signature(encoded: string) {
    return createHmac('sha256', this.signingKey).update(encoded).digest()
  }

  private unavailable() {
    return new NotFoundException(msg('post.previewUnavailable'))
  }
}
