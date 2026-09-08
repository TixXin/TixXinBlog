/**
 * @file dev.seeder.ts
 * @description 开发数据 Seeder：从前端 features/post/mock.ts 读取种子，保证前后端数据同源
 * @author TixXin
 * @since 2026-07-20
 *
 * 跨 workspace 直接引用前端 mock（development.md §8.2 约定），由 tsx 运行，
 * 因此本目录被排除在 tsc build 之外（tsconfig.build.json）。
 */

import type { EntityManager } from '@mikro-orm/postgresql'
import { Seeder } from '@mikro-orm/seeder'
import * as argon2 from 'argon2'
import { defaultFlashNoteSeeds } from '../../../../frontend/web-blog/app/features/flash/mock'
import { mockArticleDetail, mockPosts } from '../../../../frontend/web-blog/app/features/post/mock'
import { AdminUser } from '../entities/admin-user.entity'
import { FlashNote } from '../entities/flash-note.entity'
import { Post, PostContentSection } from '../entities/post.entity'
import { PostTag, PostTagColor } from '../entities/post-tag.entity'

/** 单博主场景,闪念种子统一归属博主 */
import { SITE_OWNER_ID as FLASH_OWNER_ID } from '../common/constants/site'

export class DevSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    await this.seedAdmin(em)
    await this.seedPosts(em)
    await em.execute('insert into post_folder (label) select distinct folder from post on conflict (label) do nothing')
    await this.seedFlashNotes(em)
  }

  /** 闪念种子:与前端 features/flash/mock.ts 同源(前端 LocalStorage 模式也用同一份 seed) */
  private async seedFlashNotes(em: EntityManager): Promise<void> {
    const existing = await em.count(FlashNote, {})
    if (existing > 0) {
      process.stdout.write(`flash_note 表已有 ${existing} 条数据，跳过 seed\n`)
      return
    }
    for (const seed of defaultFlashNoteSeeds) {
      const createdAt = seed.createdAt ? new Date(seed.createdAt) : new Date()
      em.create(FlashNote, {
        // seed 均带稳定 id,保证 RSS 与详情页链接与前端 mock 一致
        id: seed.id ?? undefined,
        userId: FLASH_OWNER_ID,
        content: seed.content,
        tags: [...seed.tags],
        images: seed.images ? [...seed.images] : [],
        type: seed.type ?? 'memo',
        likes: 0,
        isPinned: !!seed.isPinned,
        isArchived: !!seed.isArchived,
        isDraft: !!seed.isDraft,
        createdAt,
        updatedAt: createdAt,
      })
    }
    await em.flush()
    process.stdout.write(`seeded ${defaultFlashNoteSeeds.length} flash notes\n`)
  }

  /** 新建管理员必须显式配置密码；已有账号不重置密码。 */
  private async seedAdmin(em: EntityManager): Promise<void> {
    const username = process.env.ADMIN_DEFAULT_USERNAME ?? 'admin'
    const exists = await em.findOne(AdminUser, { username })
    if (exists) {
      process.stdout.write(`管理员 ${username} 已存在，跳过\n`)
      return
    }
    const password = process.env.ADMIN_DEFAULT_PASSWORD
    if (!password || password === '<required>' || password.length < 12) {
      throw new Error('新建管理员需要配置至少 12 位的 ADMIN_DEFAULT_PASSWORD')
    }
    em.create(AdminUser, {
      username,
      sessionVersion: 0,
      passwordHash: await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      }),
      createdAt: new Date(),
    })
    await em.flush()
    process.stdout.write(`seeded 管理员 ${username}\n`)
  }

  private async seedPosts(em: EntityManager): Promise<void> {
    const existing = await em.count(Post, {})
    if (existing > 0) {
      process.stdout.write(`post 表已有 ${existing} 条数据，跳过 seed\n`)
      return
    }

    // 1. 聚合去重标签
    const tagMap = new Map<string, PostTag>()
    for (const item of mockPosts) {
      for (const tag of item.tags) {
        if (!tagMap.has(tag.label)) {
          tagMap.set(
            tag.label,
            em.create(PostTag, {
              label: tag.label,
              slug: tag.label,
              color: tag.color as PostTagColor,
              count: 0,
            }),
          )
        }
      }
    }

    // 2. 写入文章：正文块统一复用 mockArticleDetail.content（与前端 mock 行为一致）
    const sections = mockArticleDetail.content as PostContentSection[]
    for (const item of mockPosts) {
      const post = em.create(Post, {
        id: item.id,
        title: item.title,
        summary: item.summary,
        cover: item.cover,
        category: item.category === 'life' ? 'life' : 'tech',
        folder: item.folder,
        readTimeMinutes: item.readTime,
        contentSections: sections,
        pinned: !!item.pinned,
        status: 'published',
        publishedAt: new Date(item.date),
        views: item.views,
        likes: item.likes,
        commentCount: 0,
        createdAt: new Date(item.date),
        updatedAt: new Date(item.date),
      })
      for (const tag of item.tags) {
        const tagEntity = tagMap.get(tag.label)
        if (tagEntity) {
          post.tags.add(tagEntity)
          tagEntity.count += 1
        }
      }
    }

    await em.flush()
    // 显式指定过 id，主键序列需要同步到最大值，否则后续插入会撞主键
    await em.execute(`select setval(pg_get_serial_sequence('post', 'id'), (select max(id) from post))`)
    process.stdout.write(`seeded ${mockPosts.length} posts / ${tagMap.size} tags\n`)
  }
}
