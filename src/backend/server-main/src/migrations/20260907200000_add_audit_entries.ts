/**
 * @file 20260907200000_add_audit_entries.ts
 * @description 新增管理操作审计，不修改现有内容或账号。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907200000_add_audit_entries extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "audit_entry" ("id" uuid not null, "actor_id" uuid null, "actor_name" text null, "session_id" uuid null, "trace_id" uuid null, "action" text not null, "resource_type" text not null, "resource_id" text null, "state" text not null, "status_code" int null, "summary" jsonb not null, "created_at" timestamptz not null, "finished_at" timestamptz null, constraint "audit_entry_pkey" primary key ("id"));',
    )
    for (const field of ['actor_id', 'action', 'state', 'created_at'])
      this.addSql(`create index "audit_entry_${field}_index" on "audit_entry" ("${field}");`)
  }
  override async down(): Promise<void> {
    this.addSql('drop table audit_entry;')
  }
}
