/**
 * @file 20260907190000_add_admin_sessions.ts
 * @description 为有效旧刷新记录建立稳定会话，保留登录能力；旧 JWT 可通过原 Cookie 刷新升级。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907190000_add_admin_sessions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "admin_session" ("id" uuid not null, "admin_user_id" uuid not null, "device_label" text not null, "login_at" timestamptz null, "created_at" timestamptz not null, "last_refreshed_at" timestamptz not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, constraint "admin_session_pkey" primary key ("id"));',
    )
    this.addSql('create index "admin_session_admin_user_id_index" on "admin_session" ("admin_user_id");')
    this.addSql('create index "admin_session_expires_at_index" on "admin_session" ("expires_at");')
    this.addSql(
      'alter table "admin_session" add constraint "admin_session_admin_user_id_foreign" foreign key ("admin_user_id") references "admin_user" ("id") on update cascade on delete cascade;',
    )
    this.addSql('alter table "refresh_token" add column "session_id" uuid null;')
    this.addSql(
      'update refresh_token set session_id=gen_random_uuid() where revoked_at is null and expires_at > now();',
    )
    this.addSql(
      "insert into admin_session (id,admin_user_id,device_label,created_at,last_refreshed_at,expires_at) select session_id,admin_user_id,'旧会话（设备未知）',now(),created_at,expires_at from refresh_token where session_id is not null;",
    )
    this.addSql(
      'alter table "refresh_token" add constraint "refresh_token_session_id_foreign" foreign key ("session_id") references "admin_session" ("id") on update cascade on delete cascade;',
    )
    this.addSql('create index "refresh_token_session_id_index" on "refresh_token" ("session_id");')
  }
  override async down(): Promise<void> {
    this.addSql('alter table refresh_token drop constraint refresh_token_session_id_foreign;')
    this.addSql('drop index refresh_token_session_id_index;')
    this.addSql('alter table refresh_token drop column session_id;')
    this.addSql('drop table admin_session;')
  }
}
