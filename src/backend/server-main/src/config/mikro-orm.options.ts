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
import { AdminSession } from '../entities/admin-session.entity'
import { AuditEntry } from '../entities/audit-entry.entity'
import { ContentContext } from '../entities/content-context.entity'
import { ContentImport } from '../entities/content-import.entity'
import { Comment } from '../entities/comment.entity'
import { CommentLike } from '../entities/comment-like.entity'
import { CommentPolicy } from '../entities/comment-policy.entity'
import { SiteSettings, SiteSettingsRevision } from '../entities/site-settings.entity'
import { FlashComment } from '../entities/flash-comment.entity'
import { FlashLike } from '../entities/flash-like.entity'
import { FlashNote } from '../entities/flash-note.entity'
import { Moment } from '../entities/moment.entity'
import { MomentComment } from '../entities/moment-comment.entity'
import { MomentLike } from '../entities/moment-like.entity'
import { Post } from '../entities/post.entity'
import { PostFolder } from '../entities/post-folder.entity'
import { PostRevision } from '../entities/post-revision.entity'
import { TaxonomyAlias } from '../entities/taxonomy-alias.entity'
import { PostAddress } from '../entities/post-address.entity'
import { MediaAsset } from '../entities/media-asset.entity'
import { MediaReference } from '../entities/media-reference.entity'
import { PostBatchOperation } from '../entities/post-batch-operation.entity'
import { PostLike } from '../entities/post-like.entity'
import { PostTag } from '../entities/post-tag.entity'
import { PostView } from '../entities/post-view.entity'
import { RefreshToken } from '../entities/refresh-token.entity'
import { loadLocalEnvironment, requireDatabaseUrl } from './environment'
import { join } from 'node:path'

// 迁移和 Seeder 不经过 Nest 引导，同样必须先读取配置再构造连接参数。
loadLocalEnvironment()

export const ORM_ENTITIES = [
  Post,
  PostFolder,
  PostRevision,
  TaxonomyAlias,
  PostAddress,
  MediaAsset,
  MediaReference,
  PostBatchOperation,
  PostTag,
  PostLike,
  PostView,
  Comment,
  CommentLike,
  CommentPolicy,
  SiteSettings,
  SiteSettingsRevision,
  AdminUser,
  AdminSession,
  AuditEntry,
  ContentContext,
  ContentImport,
  RefreshToken,
  FlashNote,
  FlashComment,
  FlashLike,
  Moment,
  MomentComment,
  MomentLike,
] as const

export const mikroOrmOptions = defineConfig({
  clientUrl: requireDatabaseUrl(),
  entities: [...ORM_ENTITIES],
  extensions: [Migrator, SeedManager],
  migrations: {
    // 隔离测试只回放已有迁移，不向源码目录生成临时数据库快照。
    snapshot: process.env.NODE_ENV !== 'test',
    path: join(__dirname, '../migrations'),
    pathTs: './src/migrations',
    // 迁移文件手工命名：YYYYMMDDHHMMSS_<动词>_<对象>（见 development.md §8.1）
    fileName: (timestamp: string, name?: string) => `${timestamp}_${name ?? 'migration'}`,
  },
  seeder: {
    path: './dist/seeders',
    pathTs: './src/seeders',
  },
  // 慢查询排查：开发期打印 SQL（见 development.md §13）
  debug: process.env.LOG_SQL === 'true' ? ['query'] : false,
})
