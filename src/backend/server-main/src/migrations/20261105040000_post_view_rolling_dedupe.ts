/** @file 20261105040000_post_view_rolling_dedupe.ts @description 文章浏览去重由整点小时桶改为 30 分钟滚动窗口：去掉小时桶列与联合唯一约束，按文章、访客与时间建索引 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261105040000_post_view_rolling_dedupe extends Migration {
  override async up(): Promise<void> {
    // 去重改由应用层在文章行锁内查询最近 30 分钟的记录完成；已有浏览记录与计数保持不变。
    this.addSql(`alter table "post_view" drop constraint "post_view_post_id_visitor_id_hash_hour_bucket_unique";`)
    this.addSql(`alter table "post_view" drop column "hour_bucket";`)
    this.addSql(
      `create index "post_view_post_id_visitor_id_hash_created_at_index" on "post_view" ("post_id", "visitor_id_hash", "created_at");`,
    )
  }
  override async down(): Promise<void> {
    this.addSql(`drop index "post_view_post_id_visitor_id_hash_created_at_index";`)
    this.addSql(`alter table "post_view" add column "hour_bucket" timestamptz null;`)
    this.addSql(`update "post_view" set "hour_bucket" = date_trunc('hour', "created_at");`)
    // 30 分钟窗口允许同一小时内计两次；回退到小时桶唯一约束前只保留每小时最早一条，计数字段不回滚。
    this.addSql(
      `delete from "post_view" a using "post_view" b where a."post_id" = b."post_id" and a."visitor_id_hash" = b."visitor_id_hash" and a."hour_bucket" = b."hour_bucket" and a."id" > b."id";`,
    )
    this.addSql(`alter table "post_view" alter column "hour_bucket" set not null;`)
    this.addSql(
      `alter table "post_view" add constraint "post_view_post_id_visitor_id_hash_hour_bucket_unique" unique ("post_id", "visitor_id_hash", "hour_bucket");`,
    )
  }
}
