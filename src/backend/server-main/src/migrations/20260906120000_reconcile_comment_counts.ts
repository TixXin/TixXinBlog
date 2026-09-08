/**
 * @file 20260906120000_reconcile_comment_counts.ts
 * @description 将历史演示评论计数校正为真实评论数，保留全部文章和评论。
 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260906120000_reconcile_comment_counts extends Migration {
  override async up(): Promise<void> {
    // 与写评论使用的文章行锁互斥，避免回填期间覆盖并发增量。
    this.addSql('lock table "post" in share row exclusive mode;')
    this.addSql('update "post" p set "comment_count" = (select count(*) from "comment" c where c."post_id" = p."id");')
  }

  override async down(): Promise<void> {
    // 原演示值没有业务意义，不在回滚时重新制造错误计数。
  }
}
