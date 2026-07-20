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
import { mockArticleDetail, mockPosts } from '../../../../frontend/web-blog/app/features/post/mock'
import { Post, PostContentSection } from '../entities/post.entity'
import { PostTag, PostTagColor } from '../entities/post-tag.entity'

export class DevSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
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
        commentCount: item.comments,
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
