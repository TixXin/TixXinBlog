/** @file 20260911220000_add_operation_tasks.ts @description 博主通知与最小持久任务；默认暂停所有对外投递和自动备份 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260911220000_add_operation_tasks extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table operation_control (id text primary key, generation uuid not null, external_paused boolean not null default true, backup_paused boolean not null default true, revision int not null default 0, reason text not null default 'not_enabled', last_mail_at timestamptz null, updated_at timestamptz not null);`,
    )
    this.addSql(`insert into operation_control (id,generation,updated_at) values ('default',gen_random_uuid(),now());`)
    this.addSql(
      `create table background_task (id uuid primary key, dedupe_key text not null, kind text not null, state text not null, generation uuid not null, payload jsonb not null, result jsonb null, attempts int not null default 0, max_attempts int not null default 3, available_at timestamptz not null, lease_token uuid null, lease_until timestamptz null, started_at timestamptz null, finished_at timestamptz null, error_code text null, created_at timestamptz not null);`,
    )
    this.addSql(`alter table background_task add constraint background_task_dedupe_key_unique unique (dedupe_key);`)
    this.addSql(`create index background_task_due_index on background_task (kind,state,available_at);`)
    this.addSql(
      `create table owner_notification (id uuid primary key, event_key text not null, kind text not null, source_id text not null, reason text not null, read_at timestamptz null, created_at timestamptz not null);`,
    )
    this.addSql(`alter table owner_notification add constraint owner_notification_event_key_unique unique (event_key);`)
    this.addSql(`create index owner_notification_unread_index on owner_notification (read_at,created_at);`)
  }
  override async down(): Promise<void> {
    // 运行历史不可静默删除；停用新功能可回退应用，数据库使用向前修复。
    throw new Error('运行记录迁移不提供破坏性回退，请使用向前修复或隔离备份恢复')
  }
}
