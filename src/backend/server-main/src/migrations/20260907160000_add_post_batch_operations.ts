/**
 * @file 20260907160000_add_post_batch_operations.ts
 * @description 记录批量操作计划和结果，不影响现有内容。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907160000_add_post_batch_operations extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "post_batch_operation" ("id" uuid not null, "actor_id" uuid not null, "actor_name" text not null, "session_version" int not null, "action" text not null, "plan" jsonb not null, "results" jsonb not null, "created_at" timestamptz not null, "expires_at" timestamptz not null, "started_at" timestamptz null, "finished_at" timestamptz null, constraint "post_batch_operation_pkey" primary key ("id"));',
    )
    this.addSql('create index "post_batch_operation_actor_id_index" on "post_batch_operation" ("actor_id");')
    this.addSql('create index "post_batch_operation_created_at_index" on "post_batch_operation" ("created_at");')
  }
  override async down(): Promise<void> {
    this.addSql('drop table "post_batch_operation";')
  }
}
