import { Migration } from '@mikro-orm/migrations'

export class Migration20261017204325_post_search_trgm_indexes extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists pg_trgm;`)
    this.addSql(`create index "post_content_raw_trgm_idx" on "post" using gin ("content_raw" gin_trgm_ops);`)
    this.addSql(`create index "post_summary_trgm_idx" on "post" using gin ("summary" gin_trgm_ops);`)
    this.addSql(`create index "post_title_trgm_idx" on "post" using gin ("title" gin_trgm_ops);`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "post_content_raw_trgm_idx";`)
    this.addSql(`drop index "post_summary_trgm_idx";`)
    this.addSql(`drop index "post_title_trgm_idx";`)
    // pg_trgm 可能被其他索引/查询共用，回退只删除本次创建的索引，不卸载扩展。
  }
}
