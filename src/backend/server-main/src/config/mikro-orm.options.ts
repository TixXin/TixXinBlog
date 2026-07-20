/**
 * @file mikro-orm.options.ts
 * @description MikroORM 配置单一来源：显式实体注册、迁移与 Seeder 路径
 * @author TixXin
 * @since 2026-07-20
 *
 * 实体使用显式类引用而非目录扫描：tsx/esbuild 运行环境不产出装饰器元数据，
 * 目录扫描 + 反射推断在该环境下不可靠，显式注册对 CLI / Nest / 脚本三方都稳定。
 */

import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'
import { AdminUser } from '../entities/admin-user.entity'
import { Comment } from '../entities/comment.entity'
import { CommentLike } from '../entities/comment-like.entity'
import { Post } from '../entities/post.entity'
import { PostLike } from '../entities/post-like.entity'
import { PostTag } from '../entities/post-tag.entity'
import { PostView } from '../entities/post-view.entity'
import { RefreshToken } from '../entities/refresh-token.entity'

export const ORM_ENTITIES = [Post, PostTag, PostLike, PostView, Comment, CommentLike, AdminUser, RefreshToken] as const

export const mikroOrmOptions = defineConfig({
  clientUrl: process.env.DATABASE_URL ?? 'postgres://tixxin:tixxin@localhost:5432/tixxin_blog',
  entities: [...ORM_ENTITIES],
  extensions: [Migrator, SeedManager],
  migrations: {
    path: './dist/migrations',
    pathTs: './src/migrations',
    // 迁移文件手工命名：YYYYMMDDHHMMSS_<动词>_<对象>（见 development.md §8.1）
    fileName: (timestamp: string, name?: string) => `${timestamp}_${name ?? 'migration'}`,
  },
  seeder: {
    path: './dist/seeders',
    pathTs: './src/seeders',
  },
  // 慢查询排查：开发期打印 SQL（见 development.md §13）
  debug: process.env.NODE_ENV === 'development' ? ['query'] : false,
})
