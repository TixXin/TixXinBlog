/**
 * @file 20260907210000_add_content_context.ts
 * @description 默认兼容现有客户端；完整恢复流程会轮换上下文并要求客户端重新读取。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907210000_add_content_context extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "content_context" ("id" text not null, "generation" uuid not null, "require_context" boolean not null default false, constraint "content_context_pkey" primary key ("id"));',
    )
    this.addSql(
      "insert into content_context (id,generation,require_context) values ('default',gen_random_uuid(),false);",
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table content_context;')
  }
}
